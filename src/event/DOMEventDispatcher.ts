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
import { flattenTree } from '../util/data-util';
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

        const dispatchTarget = isWheel ? null : componentCache;
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
   * 移动类事件频率高（每帧可能多次），复用缓存；其余事件刷新一次，
   * 保证页面滚动 / 布局变化后命中检测不错位。
   */
  private __resolveCanvasRect(nativeEvtName: string): any {
    const isMove = nativeEvtName === 'pointermove' || nativeEvtName === 'mousemove' || nativeEvtName === 'touchmove';
    const ice: any = this.ice;
    if (!isMove && ice && typeof ice.updateCanvasBoundingRect === 'function') {
      return ice.updateCanvasBoundingRect();
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
    const [x, y] = this.ice.screenToWorld(offsetX, offsetY);

    const arr1 = flattenTree([], this.ice.childNodes);
    const arr2 = flattenTree([], this.ice.toolNodes);
    const arr = [...arr1, ...arr2];
    arr.sort((a, b) => {
      return a.state.zIndex - b.state.zIndex;
    });

    //@perf 命中预筛：复用渲染快照的世界盒（含 paint pad）做 O(1) 拒绝。
    // 命中检测此前对每个组件都要做矩阵反变换 + 形状判定；有了预筛，屏外/远离的组件
    // 直接被盒判定挡掉。组件从未上屏（无快照）时不预筛，保证正确性优先。
    const renderer: any = (this.ice as any).renderer;
    const canScreen = renderer && typeof renderer.getWorldBox === 'function';

    for (let i = 0; i < arr.length; i++) {
      const component: any = arr[i];
      // 控制面板本体是覆盖在目标组件之上的工具层，不作为命中目标；否则面板(zIndex 最高)会
      // 遮挡住被选组件及其子组件，导致 N 层嵌套下点击子组件无法命中。面板的子手柄(ResizeControl/
      // RotateControl)不是 isControlPanel，仍会参与命中，保证缩放/旋转可用。
      if (component.isControlPanel) continue;
      const { interactive, display } = component.state;
      if (!interactive || !display) continue;
      if (canScreen) {
        const box: any = renderer.getWorldBox(component);
        if (
          box &&
          (x < box[0] - HIT_BOX_TOLERANCE ||
            x > box[2] + HIT_BOX_TOLERANCE ||
            y < box[1] - HIT_BOX_TOLERANCE ||
            y > box[3] + HIT_BOX_TOLERANCE)
        ) {
          continue;
        }
      }
      if (component.containsPoint(x, y)) {
        this.selectionCandidates.push(component);
      }
    }

    const component = this.selectionCandidates.pop();
    this.selectionCandidates = [];
    return component;
  }
}

export default DOMEventDispatcher;
