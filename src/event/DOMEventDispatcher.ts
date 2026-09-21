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
import { resolveVirtualHit } from '../graphic/virtual/virtual-child-source';
import ICEEvent from './ICEEvent';
import { normalizeInput, applyNormalizedInput, toLegacyMouseName, NormalizedInput } from './input-normalize';
import { isEventNameListened } from './listened-event-names';
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
        //1.0) **事件来源**（`evt.source`）：画布内 vs 画布外。
        //     原始输入监听挂在 window 上（拖拽移出画布也要跟手），所以工具栏按钮 / 页面空白上的
        //     输入也会走到这里 —— 那些事件没有命中组件，`evt.target` 为 null（DOM 元素在
        //     `originalEvent.target`），应用用 `evt.source !== 'canvas'` 一句就能过滤掉。
        //     见 `ICEEvent.source` 的字段说明。
        (evt as any).source = this.__isOutsideCanvas(rawEvt) ? 'window' : 'canvas';
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
          // 控制面板**不参与命中**（`findTargetComponent` 跳过 `isControlPanel`），所以面板盖在
          // 组件上不会挡住点击。（这条以前挂着"面板遮挡导致组件收不到事件"的待办，
          // 2026-09-08 修掉之后回归钉在 `tests/event/DOMEventDispatcher.test.ts`：
          // 面板覆盖父容器包围盒时，点击子组件仍命中子组件。）
          componentCache = this.findTargetComponent(evt);
          /**
           * **虚拟化：命中批量图元 → 物化它，并把事件重定向到那个真组件**（P1）。
           *
           * 只在这一支（按下 / 点击 / 右键这类"落到具体对象上"的事件）做 —— **移动类事件根本不做命中检测**
           * （高频 + 脏矩形，见上一条注释），所以 hover 不会因为划过就批量物化。
           * 物化之后 `componentCache` 就是那个真组件，后续的 mousemove / mouseup 自然落到它身上
           * （引擎的拖拽归属靠 `componentCache` 跨事件保持），于是选中 / 控制面板 / 拖动与普通组件逐条同义。
           */
          componentCache = resolveVirtualHit(componentCache);
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
   *
   * 组件**按树冒泡**（命中组件 → 各级父容器），总线最后收一次。
   *
   * 两条语义要分清：
   * - 组件链上的 `stopPropagation()` 只阻止**继续向祖先冒泡**（同层其他监听器照常执行，
   *   语义与 W3C 一致）；
   * - **总线一定会收到一次**，不受 `stopPropagation()` 影响 —— 总线是引擎内部通道
   *   （控制面板选中、连线插槽、悬停、键盘作用域都挂在上面），让组件里的一次
   *   `stopPropagation()` 把它整条掐掉，会变成"看着只是阻止冒泡，实际引擎失灵"。
   */
  private __dispatch(evtName: string, evt: any, target: any): void {
    /**
     * **按需派发**（2026-09-20）：这个名字没人听 → 整段早退。
     *
     * 一次原生指针输入会被派发**两个名字**（原生名 `pointermove` + 兼容名 `mousemove`），
     * 而引擎自己的默认处理器挂在鼠标名上、应用通常只用其中一套 —— 没人听的那一次
     * 白走一条"祖先链数组 + 每层 trigger"（`trigger` 因无监听者会早退，但遍历与分配已经付了）。
     * 指针移动是每帧级高频，这里省的是热路径上的一半。
     *
     * 判定依据是 `listened-event-names.ts` 的单向登记表（只增不减，理由见那里的说明）。
     */
    if (!isEventNameListened(evtName)) {
      return;
    }
    if (target) {
      this.__dispatchThroughTree(evtName, evt, target);
    }
    /**
     * 总线本身一定会触发一次（鼠标 / 键盘 / 指针 / 触摸 / 滚轮都是）。
     *
     * ⚠️ 触发前把相位归零：**总线是传播的终点，不在任何传播段里**。
     * 不归零会出现"同一个字段两种含义"——组件链有命中时末尾已归零（总线看到 0），
     * 而没有命中组件时（画布外输入 / 点空白）根本走不到组件链，相位就沿用原始 DOM 事件的
     * `BUBBLING_PHASE(3)`。应用按 `eventPhase` 判断"这是不是冒泡段"就会踩坑（2026-09 实测）。
     */
    evt.eventPhase = 0;
    evt.currentTarget = null;
    this.ice.evtBus.trigger(evtName, evt, { component: target });
  }

  /**
   * 沿组件树冒泡派发：命中组件（`AT_TARGET`）→ 父容器 → 祖父 ……（`BUBBLING_PHASE`）。
   *
   * 为什么必须冒泡：canvas 内部的组件树就是 DOM 树的对应物，"子组件上的点击父容器也能知道"
   * 是容器型组件（面板 / 卡片 / 抽屉 / 巡览）唯一能用的组合方式 —— 旧实现只把事件投给命中组件，
   * 于是 `ice-web-components` 里出现了"在面板自己身上再挂一次 click 去 stopPropagation"这类
   * **既无效（没有冒泡可阻止）又危险（ICEEvent 的桩方法会抛异常）**的写法。
   */
  private __dispatchThroughTree(evtName: string, evt: any, target: any): void {
    // param 在组件路径与总线路径保持一致（旧实现里组件路径拿不到 param，只有总线有）
    evt.param = { ...(evt.param || {}), component: target };
    const path: any[] = [];
    let node: any = target;
    while (node && path.indexOf(node) === -1) {
      path.push(node);
      node = node.parentNode || null;
    }
    for (let i = 0; i < path.length; i++) {
      const current = path[i];
      evt.target = target;
      evt.__iceTarget = target;
      evt.eventPhase = i === 0 ? 2 : 3; // 2 = AT_TARGET，3 = BUBBLING_PHASE
      current.trigger(evtName, evt);
      if (evt.__iceStopped) {
        break;
      }
    }
    evt.eventPhase = 0;
    evt.currentTarget = null;
  }

  /** 只派发给指定组件（不触发总线）——"拖拽归属"补派抬起事件用。 */
  private __dispatchToComponentOnly(evtName: string, evt: any, component: any): void {
    // 与正常路径同源：补派的抬起事件同样沿树冒泡（否则"按下 A、松手在 B"时 A 的父容器收不到）
    this.__dispatchThroughTree(evtName, evt, component);
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

  /**
   * 事件是不是**打在本实例 canvas 之外**（工具栏按钮 / 页面空白 / 别的元素）。
   *
   * 用途：写 `evt.source`（`'window'` vs `'canvas'`）。原始输入监听挂在 window 上，
   * 画布外的输入也会被转发到总线 —— 那种事件没有命中组件，应用多半要忽略它。
   *
   * 判据与 `__isForeignCanvasTarget` 同一套（本 canvas / canvas 内的元素算"内"）；
   * 取不到 target 时按"内"处理（键盘事件没有元素目标，按画布内交互对待）。
   */
  private __isOutsideCanvas(rawEvt: any): boolean {
    const canvasEl: any = (this.ice as any).canvasEl;
    const target: any = rawEvt && rawEvt.target;
    if (!canvasEl || !target || target === canvasEl) {
      return false;
    }
    if (typeof canvasEl.contains === 'function' && canvasEl.contains(target)) {
      return false;
    }
    return true;
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
