/**
 * 最小可行性原型：把 ice-render 的确定性场景渲染搬到 Web Worker + OffscreenCanvas。
 *
 * 验证点：
 *  1) 引擎 dist（UMD）在 worker 内**零注入**可加载并驱动：
 *     原型的宿主侧注入（`self.window = self; self.global = self;`）已于 2026-09-20 删除 ——
 *     `cross-platform/root.ts` 改为取 `globalThis`（浏览器 window / worker self / Node global 同一个入口），
 *     worker 因此成为**一等宿主**，不再需要宿主先给引擎伪造全局。
 *  2) OffscreenCanvas 2D ctx 上走 ICE 组件树 + CanvasRenderer 真实光栅化。
 *  3) worker 内同步测 static/anim/drag 单帧 p50（含真实光栅化）。
 *  4) 通过 transferToImageBitmap 逐帧把画面送主线程展示。
 *
 * 明确不做：树/事件双端同步、文本/图片/字体/面板（见 docs/architecture/10-worker-offscreen.md）。
 */
importScripts('../../dist/index.umd.js');

const ICE = self.ICE;
const PALETTE = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#EC4899', '#6366F1'];

const W = 1024;
const H = 768;
const N = 5000;

const off = new OffscreenCanvas(W, H);
const ctx = off.getContext('2d');
ctx.fillStyle = '';
ctx.strokeStyle = '';
ctx.lineWidth = 1;

/**
 * 引擎自证「我就是跑在 worker 里的」这几项，随结果一起回传主线程（供 e2e 断言）。
 *
 * 为什么值得单独上报：这四项只要有一项是假的，「worker 能跑」就可能是宿主补丁撑出来的假象 ——
 * 改造前正是靠 `self.window = self` 伪造全局；现在若 `root` 又退回双探测，`flat[0].root` 会是
 * 那个兜底空对象 `{}`，`path2D.native` 直接变 null（形状连一笔都画不出来），这里立刻能看见。
 */
const probe = (() => {
  const componentRoot = (function () {
    // 组件构造时会把**模块级 root** 记在自己身上（ICEComponent 的 `this.root = root`）
    const probeShape = new ICE.ICERect({ width: 4, height: 4 });
    return probeShape.root;
  })();
  let offscreenOk = false;
  try {
    const small = componentRoot.createOffscreenCanvas(8, 8);
    offscreenOk = !!(small && small.ctx && typeof small.canvas.getContext === 'function');
  } catch (e) {
    offscreenOk = false;
  }
  return {
    hostInjectedGlobals: typeof self.window !== 'undefined' || typeof self.global !== 'undefined',
    engineRootIsSelf: componentRoot === self,
    offscreenCanvasInWorker: offscreenOk,
  };
})();

// ---- 组装 harness（不调用 ICE.init，避免 FrameManager/rAF/DOM，仿 bench/render.cjs）----
const ice = new ICE.ICE();
ice.childNodes = [];
ice.toolNodes = [];
ice.root = self;
ice.ctx = ctx;
ice.canvasWidth = W;
ice.canvasHeight = H;
ice.evtBus = new ICE.EventBus();
ice.dirty = true;
const renderer = new ICE.CanvasRenderer(ice);
renderer.start();

// ---- 确定性「全不透明」场景（矩形/圆形；无文本/点集/半透明 → 脏矩形局部可生效）----
function buildTree(targetN) {
  const root = new ICE.ICEGroup({
    width: 2000,
    height: 1000,
    style: { fillStyle: '#ffffff', strokeStyle: '#E5E7EB', lineWidth: 1 },
  });
  let count = 1;
  const topGroups = 10;
  const subPerTop = 5;
  const leavesPerSub = Math.max(1, Math.floor((targetN - count) / (topGroups * subPerTop)));
  for (let t = 0; t < topGroups && count < targetN; t++) {
    const g = new ICE.ICEGroup({
      left: t * 40,
      top: 0,
      width: 200,
      height: 200,
      style: { fillStyle: '#ffffff', strokeStyle: '#D1D5DB', lineWidth: 1 },
    });
    count++;
    for (let s = 0; s < subPerTop && count < targetN; s++) {
      const sg = new ICE.ICEGroup({
        left: 0,
        top: s * 20,
        width: 80,
        height: 80,
        style: { fillStyle: '#ffffff', strokeStyle: '#D1D5DB', lineWidth: 1 },
      });
      count++;
      for (let l = 0; l < leavesPerSub && count < targetN; l++) {
        const color = PALETTE[(l + s + t) % PALETTE.length];
        const left = (l * 7) % 60;
        const top = (l * 11) % 60;
        const leaf =
          l % 2 === 0
            ? new ICE.ICECircle({ left, top, width: 10, height: 10, style: { fillStyle: color } })
            : new ICE.ICERect({ left, top, width: 14, height: 14, style: { fillStyle: color } });
        sg.addChild(leaf);
        count++;
      }
      g.addChild(sg);
    }
    root.addChild(g);
  }
  return root;
}

const flat = [];
function collect(node) {
  flat.push(node);
  if (node.childNodes) node.childNodes.forEach(collect);
}
const rootGroup = buildTree(N);
ice.addChild(rootGroup);
collect(rootGroup);
for (let i = 0; i < flat.length; i++) {
  flat[i].ice = ice;
  flat[i].ctx = ctx;
  flat[i].evtBus = ice.evtBus;
}

function markAllDirty() {
  for (let i = 0; i < flat.length; i++) flat[i].dirty = true;
}

/**
 * 抽查 worker 画布上**真的落了墨**。
 *
 * 这不是"性能指标"，是一条防空转护栏：如果引擎在 worker 里取不到原生 `Path2D`
 * （`root` 又退回双探测的假象），`ICEPath.doRender` 会安静地跳过 fill/stroke ——
 * 帧照样 post、位图照样传、耗时数字照样好看，只有画面是空的。
 */
function sampleInk() {
  const d = ctx.getImageData(0, 0, W, H).data;
  let ink = 0;
  for (let i = 3; i < d.length; i += 4 * 4) {
    if (d[i] > 8) ink++;
  }
  return ink;
}

// drag 目标：深嵌套矩形叶子
const dragTarget =
  flat.find((c) => c.constructor && c.constructor.name === 'ICERect' && c.parentNode && c.parentNode.childNodes) ||
  flat[flat.length - 1];

function stats(samples) {
  const s = samples.slice().sort((a, b) => a - b);
  return {
    avg: s.reduce((x, y) => x + y, 0) / s.length,
    p50: s[Math.floor(s.length / 2)],
  };
}

function measure(mode) {
  function step() {
    if (mode === 'anim') markAllDirty();
    if (mode === 'drag') dragTarget.moveGlobalPosition(1, 0);
    ice.dirty = true;
    renderer.frameEvtHandler();
  }
  for (let i = 0; i < 15; i++) step();
  const samples = [];
  for (let i = 0; i < 120; i++) {
    const t0 = performance.now();
    step();
    samples.push(performance.now() - t0);
  }
  return stats(samples);
}

// 首帧建立缓存
ice.dirty = true;
renderer.frameEvtHandler();

const staticMs = measure('static');
const animMs = measure('anim');
const dragMs = measure('drag');

// 持续动画并逐帧上传位图（展示 live 传输）
let liveFrames = 0;
let sampledInk = 0;
const liveTarget = 24;
function liveFrame() {
  markAllDirty();
  ice.dirty = true;
  renderer.frameEvtHandler();
  // 抽样必须在 transfer 之前：transferToImageBitmap() 会把画布内容交出去并清空它，
  // 传完之后再读 getImageData 只会读到一片透明黑（第一次就踩了这个坑）。
  if (liveFrames === 0) {
    sampledInk = sampleInk();
  }
  const bitmap = off.transferToImageBitmap();
  self.postMessage({ type: 'bitmap', bitmap }, [bitmap]);
  liveFrames++;
  if (liveFrames >= liveTarget) {
    self.postMessage({
      type: 'result',
      stats: {
        n: flat.length,
        staticP50Ms: staticMs.p50,
        animP50Ms: animMs.p50,
        dragP50Ms: dragMs.p50,
        liveFrames,
        ...probe,
        // 形状的路径对象里有没有**原生 Path2D**：没有的话引擎根本不上屏（只有命令流）
        nativePath2D: !!(flat[0] && flat[0].path2D && flat[0].path2D.native),
        // 每 4 个像素抽一个数 alpha：只要 > 0 就说明画布上真有内容
        sampledInk,
      },
    });
    return;
  }
  setTimeout(liveFrame, 16);
}
setTimeout(liveFrame, 30);
