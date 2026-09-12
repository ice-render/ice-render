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

        //1) 归一化坐标与位移（pointer/mouse/touch 统一）。键盘等无坐标事件返回 null。
        const rawEvt: any = (evt as any).originalEvent || evt;
        //0) 指针捕获：拖拽时必须捕获，否则指针移出画布就收不到后续事件
        this.__handlePointerCapture(iceEvtName, rawEvt);
        const input = normalizeInput(rawEvt, this.__resolveCanvasRect(nativeEvtName), this.__lastInput);
        if (input) {
          applyNormalizedInput(evt, input);
          this.__lastInput = input;
        }

        const isMove = MOVE_ICE_EVENTS.indexOf(iceEvtName) !== -1;
        const isKeyboard = iceEvtName.indexOf('KEY') !== -1;
        //! 滚轮是高频事件，且语义是「视口操作」而非「作用于某个组件」：只发总线，不做命中检测，
        //! 也不派发给上一次选中的组件（否则会给无关组件投递滚轮事件）。
        const isWheel = iceEvtName === 'ICE_WHEEL';
        //! 移动类事件触发频率极高，不执行 findTargetComponent()；
        //! 键盘事件必须先选中组件再派发才有意义，同样不做命中检测。
        if (!isMove && !isKeyboard && !isWheel) {
          componentCache = this.findTargetComponent(evt); //FIXME: TransformControlPanel 会遮挡住组件，导致组件收不到鼠标事件，需要做一些处理。
        }

        // 键盘事件优先派发给「焦点组件」（无障碍），未设置焦点时维持既有行为
        let dispatchTarget = componentCache;
        if (isWheel) {
          dispatchTarget = null;
        } else if (isKeyboard && this.focusedComponent) {
          dispatchTarget = this.focusedComponent;
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
