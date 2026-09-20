/**
 * 输入派发微基准：**「有人听的那一次」值多少、「没人听的那一次」省掉多少**。
 *
 * 背景（2026-09-20 起的行为）：一次原生指针输入会被派发**两个名字** ——
 * 原生名（`pointermove`）+ 兼容名（`mousemove`，见 `DOMEventDispatcher` 的"兼容名派发"）。
 * 这两个名字通常只有一个有人听：**引擎自己的默认处理器挂在鼠标名上**
 *（`ICEComponent` 构造期 `mousedown/keydown/keyup`，拖拽开始时再登记 `mousemove/mouseup`），
 * 应用要么用鼠标名（老代码）要么用指针名（新代码）。没人听的那一次以前要白跑
 * "祖先链数组 + 每层 trigger + 总线触发"；现在派发器按 `listened-event-names` 的表整段早退。
 *
 * 三条基准（互不依赖执行顺序；本文件**不登记 `pointermove`**，用它代表"没人听"）：
 *  - 有人听：祖先链 4 层 + 每层 trigger + 总线（省不掉的那一次）
 *  - 没人听：改造后只剩一次表查询（≈0）
 *  - 全链路：`ICE_POINTERMOVE` 从派发器入口走完（典型场景 = 一次有人听 + 一次没人听）
 *
 * 改造前的全链路 ≈ 「有人听」× 2 + 归一化，所以"典型场景"的派发部分是**减半**。
 */
import { bench, do_not_optimize } from 'mitata';
import { createScene, mod } from './_fixture.mjs';

const { DOMEventDispatcher } = mod;

// 声明 PointerEvent：让派发器订阅指针通道（与浏览器实际一致）
global.PointerEvent = global.PointerEvent || function () {};

const RECT = { left: 0, top: 0 };

/** 造一个装了渲染器、可选订阅指针名的场景 + 启动派发器。 */
function makeHarness(targetN = 200) {
  const scene = createScene(targetN);
  const ice = scene.ice;
  ice.canvasBoundingClientRect = RECT;
  ice.updateCanvasBoundingRect = () => RECT;
  ice.refreshInputRect = () => RECT;
  ice.getInputRect = () => RECT;
  ice.canvasEl = { tagName: 'CANVAS', contains: () => false };

  // 找一个叶子当派发目标（命中检测在移动类事件上本就不做，这里只是要个真实组件）
  let leaf = null;
  (function find(node) {
    if (leaf) return;
    if (!node.childNodes || node.childNodes.length === 0) {
      leaf = node;
      return;
    }
    node.childNodes.forEach(find);
  })(scene.rootGroup);

  const dispatcher = new DOMEventDispatcher(ice);
  dispatcher.start();
  // 命中检测有它自己的基准（hit-test.bench.mjs）：这里把"按下命中谁"钉死，
  // 让基准只反映**派发**成本（否则按下是否命中会让移动事件的目标在 null / 组件之间跳）
  dispatcher.findTargetComponent = () => leaf;
  return { ice, leaf, dispatcher };
}

const typical = makeHarness(200); // 只有鼠标名有人听（引擎默认）

// 按下一次，让派发器记住"上一次按下的组件"（移动类事件的派发目标来自它）
typical.ice.evtBus.trigger('ICE_POINTERDOWN', {
  type: 'pointerdown',
  clientX: 4,
  clientY: 4,
  pointerId: 1,
  pointerType: 'mouse',
});

const moveRaw = () => ({
  type: 'pointermove',
  clientX: 8,
  clientY: 8,
  pointerId: 1,
  pointerType: 'mouse',
});

const evt = { type: 'pointermove', bubbles: true, cancelable: true };

// ---- 单次派发：有人听（祖先链 + 总线）----
bench('派发 · 有人听（祖先链 + 每层 trigger + 总线）', () => {
  typical.dispatcher.__dispatch('mousemove', evt, typical.leaf);
  do_not_optimize(evt);
});

// ---- 单次派发：没人听（改造后早退）----
bench('派发 · 没人听（按需派发早退）', () => {
  typical.dispatcher.__dispatch('pointermove', evt, typical.leaf);
  do_not_optimize(evt);
});

// ---- 全链路：ICE_POINTERMOVE 从派发器入口走完（典型场景）----
bench('全链路 · ICE_POINTERMOVE（典型：pointer 名没人听）', () => {
  typical.ice.evtBus.trigger('ICE_POINTERMOVE', moveRaw());
});
