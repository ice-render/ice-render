/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { buildDomEventList, MOVE_ICE_EVENTS } from '../consts/DOM_EVENT_MAPPING_CONSTS';
import root from '../cross-platform/root';
import ICE from '../ICE';
import { hitTestComponents } from '../util/data-util';
import ICEEvent from './ICEEvent';
import { normalizeInput, applyNormalizedInput, toLegacyMouseName, NormalizedInput } from './input-normalize';
import { HIT_BOX_TOLERANCE } from '../renderer/dirty-rect-util';

/**
 * @class DOMEventDispatcher
 *
 * - DOM 事件派发器，监听事件总线上的输入事件，派发给 canvas 内指定的组件。
 * - 鼠标 / 指针 / 触摸 / 滚轮 / 键盘事件都通过此工具类派发。
 *
 * 输入归一化（本类的关键职责）：
 * - 底层无论 pointer / mouse / touch，都在这里统一成 canvas 内坐标
 *   （`clientX - canvasRect.left`）与屏幕位移 movement，然后写回事件对象。
 *   这样组件、拖拽、变换手柄、对齐吸附、命中检测都无需区分输入源。
 * - pointer / touch 会额外以「鼠标语义名」（mousedown/mousemove/mouseup）再派发一次，
 *   保证既有 `on('mousedown', ...)` 代码零改动即可在触摸设备上工作。
 * - 命中检测用的 canvas 矩形在非移动类事件上刷新，页面滚动 / 布局变化后仍正确。
 *
 * @see {DOMEventInterceptor}
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class DOMEventDispatcher {
  private selectionCandidates: Array<any> = [];
  private ice: ICE;
  private _stopped: boolean = false;
  /** 上一次归一化输入，用于在原生 movement 缺失（触摸）时补算位移。 */
  private __lastInput: NormalizedInput | null = null;
  /**
   * 键盘事件的焦点组件（无障碍 / 键盘导航）。
   * 由应用层通过 `ICE.setFocusedComponent()` 设置；为 null 时维持既有行为
   * ——键盘事件派发给「上次点击命中的组件」。
   */
  public focusedComponent: any = null;

  constructor(ice: ICE) {
    this.ice = ice;
  }

  start() {
    let componentCache = null; //缓存上次被点击的组件
    /**
     * 本次按下的组件 = **拖拽 owner**。
     *
     * 为什么需要：抬起事件按当前位置重新命中检测，于是"按下 A → 拖到 B 上松手"时 A 收不到 mouseup。
     * 对连线端点手柄（ICELinkHook）是致命的：它的 mouseup → HOOK_MOUSEUP → ICELinkSlotManager
     * 才去把连线改接到落点插槽，收不到就"拖得动、放不下"。
     */
    let pressedComponent: any = null;
    const hasPointerEvent = typeof root.PointerEvent === 'function';
    const domEvts = buildDomEventList(hasPointerEvent);
    for (let i = 0; i < domEvts.length; i++) {
      const evtMapping = domEvts[i];
      const nativeEvtName = evtMapping[0]; //原生事件名，同时也是组件层的事件名
      const iceEvtName = evtMapping[1]; //总线上用于转发的内部事件名
      const legacyMouseName = toLegacyMouseName(nativeEvtName); //pointer/touch → 鼠标语义名

      this.ice.evtBus.on(iceEvtName, (evt: ICEEvent) => {
        if (this._stopped) {
          return;
        }

        const rawEvent: any = (evt as any).originalEvent || evt;
        const isKeyboardEvt = iceEvtName.indexOf('KEY') !== -1;
        const isWheelEvt = iceEvtName === 'ICE_WHEEL';
        const isPressEvt = /DOWN|START/.test(iceEvtName);
        const isReleaseEvt = /UP|END|CANCEL/.test(iceEvtName);

        //0) **事件归属**（同页多 ICE 实例 / 分层渲染的前提）：
        //   全局拦截器把原生事件广播给所有总线，若不做归属过滤，按住上层画布会同时驱动下层实例
        //   的命中检测（坐标还按各自 rect 算）——分层里"上层 pointer-events:none"就形同虚设。
        //   只在**按下/滚轮**这两个"决定归属"的事件上过滤；移动/抬起不过滤，避免拖拽途中
        //   指针划过另一张画布时丢事件（无 PointerCapture 的 mouse 回退路径尤其重要）。
        if ((isPressEvt || isWheelEvt) && this.__isForeignCanvasTarget(rawEvent)) {
          return;
        }

        //1) 归一化坐标与位移（pointer/mouse/touch 统一）。键盘等无坐标事件返回 null。
        const rawEvt: any = rawEvent;
        //0) 指针捕获：拖拽时必须捕获，否则指针移出画布就收不到后续事件
        this.__handlePointerCapture(iceEvtName, rawEvt);
        const input = normalizeInput(rawEvt, this.__resolveCanvasRect(nativeEvtName), this.__lastInput);
        if (input) {
          applyNormalizedInput(evt, input);
          this.__lastInput = input;
        }

        const isMove = MOVE_ICE_EVENTS.indexOf(iceEvtName) !== -1;
        const isKeyboard = isKeyboardEvt;
        //! 滚轮是高频事件，且语义是「视口操作」而非「作用于某个组件」：只发总线，不做命中检测，
        //! 也不派发给上一次选中的组件（否则会给无关组件投递滚轮事件）。
        const isWheel = isWheelEvt;
        //! 移动类事件触发频率极高，不执行 findTargetComponent()；
        //! 键盘事件必须先选中组件再派发才有意义，同样不做命中检测。
        if (!isMove && !isKeyboard && !isWheel) {
          componentCache = this.findTargetComponent(evt); //FIXME: TransformControlPanel 会遮挡住组件，导致组件收不到鼠标事件，需要做一些处理。
        }

        // 交互状态自动驱动（默认关闭，`ice.enableInteractionStates()` 打开）：
        // 移动时更新 hover、按下/抬起时更新 active。**刻意只在开关打开时做命中检测** ——
        // 引擎的 mousemove 本来是不做命中测试的（高频 + 脏矩形，全场景命中是实打实的开销）。
        if (this.ice.interactionStatesEnabled && isMove && input) {
          this.ice.updateHoverState(this.findTargetComponent(evt));
        }

        // 键盘事件优先派发给「焦点组件」（无障碍），未设置焦点时维持既有行为
        let dispatchTarget = componentCache;
        if (isWheel) {
          dispatchTarget = null;
        } else if (isKeyboard && this.focusedComponent) {
          dispatchTarget = this.focusedComponent;
        }
        // 拖拽归属：抬起事件先回到"按下的那个组件"，再按命中结果派发（总线仍只触发一次）
        if (isPressEvt) {
          pressedComponent = componentCache;
          if (
            this.ice.interactionStatesEnabled &&
            componentCache &&
            typeof componentCache.setInteractionState === 'function'
          ) {
            componentCache.setInteractionState('active', true);
          }
        } else if (isReleaseEvt) {
          if (
            this.ice.interactionStatesEnabled &&
            pressedComponent &&
            typeof pressedComponent.setInteractionState === 'function'
          ) {
            pressedComponent.setInteractionState('active', false);
          }
          if (pressedComponent && pressedComponent !== dispatchTarget) {
            const rawTarget = evt.target;
            this.__dispatchToComponentOnly(nativeEvtName, evt, pressedComponent);
            if (legacyMouseName && legacyMouseName !== nativeEvtName) {
              this.__dispatchToComponentOnly(legacyMouseName, evt, pressedComponent);
            }
            evt.target = rawTarget; // 总线事件仍按"命中组件"语义，不受这次补派影响
          }
          pressedComponent = null;
        }
        //2) 原生名派发（新代码可用 pointerdown/pointermove/... 或 touchstart/...）
        this.__dispatch(nativeEvtName, evt, dispatchTarget);
        //3) 兼容名派发：pointer/touch 映射成 mousedown/mousemove/mouseup，既有组件零改动
        if (legacyMouseName && legacyMouseName !== nativeEvtName) {
          this.__dispatch(legacyMouseName, evt, dispatchTarget);
        }
      });
    }
    return this;
  }

  /**
   * 指针捕获：`pointerdown` 时把指针捕获到画布，`pointerup` / `pointercancel` 时释放。
   *
   * 为什么需要：拖组件、拖变换手柄、拖连线钩子时，指针很容易移出画布范围。没有捕获就会出现
   * 「拖着拖着不跟手」甚至「松开鼠标了还在拖」—— 因为后续 `pointermove` / `pointerup`
   * 被派发到了画布之外的元素上。捕获后这些事件会被重定向回画布。
   *
   * 只处理 Pointer Events 通道：mouse/touch 旧通道的 move/up 会冒泡到 window，本来就不会丢。
   */
  private __handlePointerCapture(iceEvtName: string, rawEvt: any): void {
    const el: any = (this.ice as any).canvasEl;
    if (!el || typeof el.setPointerCapture !== 'function') {
      return;
    }
    const pointerId = rawEvt && rawEvt.pointerId;
    if (typeof pointerId !== 'number') {
      return;
    }
    try {
      if (iceEvtName === 'ICE_POINTERDOWN') {
        // 只在「按下的目标就是画布（或画布内的元素）」时捕获。
        // 监听器挂在 window 上，画布外的 DOM UI（工具栏按钮、面板下拉）也会走到这里；
        // 无条件捕获会把后续 pointerup/click 重定向到画布，**按钮的 click 就不再触发**。
        const target = rawEvt && rawEvt.target;
        if (target && target !== el && !(el.contains && el.contains(target))) {
          return;
        }
        el.setPointerCapture(pointerId);
      } else if (iceEvtName === 'ICE_POINTERUP' || iceEvtName === 'ICE_POINTERCANCEL') {
        if (typeof el.releasePointerCapture === 'function' && el.hasPointerCapture && el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId);
        }
      }
    } catch (e) {
      // 元素已脱离文档 / 运行时不支持真实指针捕获：忽略，不影响事件派发本身
    }
  }

  /**
   * 把事件派发给命中的组件与事件总线。
   * 组件先收到，总线后收到（与既有语义一致：总线始终会收到一次）。
   */
  private __dispatch(evtName: string, evt: any, componentCache: any): void {
    if (componentCache) {
      evt.target = componentCache;
      componentCache.trigger(evtName, evt);
    }
    //this.ice.evtBus 本身一定会触发一次鼠标和键盘事件。
    this.ice.evtBus.trigger(evtName, evt, { component: componentCache });
  }

  /** 只派发给指定组件（不触发总线）——"拖拽归属"补派抬起事件用。 */
  private __dispatchToComponentOnly(evtName: string, evt: any, component: any): void {
    evt.target = component;
    component.trigger(evtName, evt);
  }

  /**
   * 取 canvas 矩形用于坐标换算。
   *
   * **移动类事件也必须刷新**（走 `refreshInputRect` 轻量路径：只重读一次
   * `getBoundingClientRect`，尺寸没变就平移已缓存的内容盒、不读 computedStyle），
   * 其余事件走完整 `updateCanvasBoundingRect`。
   *
   * 为什么不做「一帧一次」的节流：布局变化（页面滚动、画布上方插入内容）可能就发生在
   * 两次事件之间，节流会让第二次事件继续用过期矩形 —— 命中检测整体偏移、悬停直接落空。
   * 实测一次 `getBoundingClientRect()` 在布局干净时约 0.22µs、强制重排的最坏情况约 2.8µs，
   * 相对每帧渲染可忽略（见 AGENTS「性能相关铁律」）。
   */
  private __resolveCanvasRect(nativeEvtName: string): any {
    const isMove = nativeEvtName === 'pointermove' || nativeEvtName === 'mousemove' || nativeEvtName === 'touchmove';
    const ice: any = this.ice;
    if (isMove) {
      if (ice && typeof ice.refreshInputRect === 'function') {
        ice.refreshInputRect();
      } else if (ice && typeof ice.updateCanvasBoundingRect === 'function') {
        // 兼容性兜底：老版本 ICE 没有轻量路径时退化成完整刷新（慢一点但正确）
        ice.updateCanvasBoundingRect();
      }
    } else if (ice && typeof ice.updateCanvasBoundingRect === 'function') {
      ice.updateCanvasBoundingRect();
    }
    // 用「内容盒左上角」而非 border-box：画布带 border/padding 时坐标不应把边框算进去
    if (ice && typeof ice.getInputRect === 'function') {
      return ice.getInputRect();
    }
    return ice ? ice.canvasBoundingClientRect || null : null;
  }

  /**
   * 事件目标是否属于「别的 canvas」（同页另一个 ICE 实例的绘制面）。
   *
   * - 目标是本实例的 canvas、或本实例 canvas 内的元素 → 不是"外来"事件；
   * - 目标不是 canvas（body / window / 工具栏按钮等）→ 不是"外来"事件（键盘、合成事件照旧）；
   * - 目标正是**另一个 canvas 元素** → 外来事件，本实例应忽略。
   */
  private __isForeignCanvasTarget(rawEvt: any): boolean {
    const canvasEl: any = (this.ice as any).canvasEl;
    const target: any = rawEvt && rawEvt.target;
    if (!canvasEl || !target) {
      return false;
    }
    if (target === canvasEl) {
      return false;
    }
    if (typeof canvasEl.contains === 'function' && canvasEl.contains(target)) {
      return false;
    }
    const tag = target.tagName ? String(target.tagName).toUpperCase() : '';
    return tag === 'CANVAS';
  }

  public set stopped(flag: boolean) {
    this._stopped = flag;
  }

  public get stopped() {
    return this._stopped;
  }

  /**
   * @method findTargetComponent
   *
   * 找到被点击的对象，用代码触发 click 事件。
   * 在点击状态下，每次只能点击一个对象，当前不支持 DOM 冒泡特性。
   *
   * 坐标约定：`evt.offsetX/offsetY` 已由输入归一化保证是「canvas 内坐标」。
   *
   * @returns
   */
  private findTargetComponent(evt) {
    if (this._stopped) return null;

    const { offsetX, offsetY } = evt;
    if (typeof offsetX !== 'number' || typeof offsetY !== 'number') {
      return null;
    }
    // 命中检测在「世界坐标」进行：屏幕像素坐标先经视口逆变换回世界。
    // 具体扫描逻辑收敛在 hitTestComponents（与 ICE.hitTest 共用同一份实现）
    const [x, y] = this.ice.screenToWorld(offsetX, offsetY);
    return hitTestComponents(this.ice, x, y, HIT_BOX_TOLERANCE);
  }
}

export default DOMEventDispatcher;
