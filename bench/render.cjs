/**
 * ice-render 内核渲染热路径基准测试（零依赖，node 内置 hrtime）。
 *
 * 直接在 node 中消费构建产物 dist/index.cjs，用 stub ctx 驱动渲染循环，
 * 测量每帧 CPU 开销（引擎 JS 开销：flattenTree+sort、矩阵组合、属性赋值）。
 * 注意：本脚本只测「引擎 JS 逻辑层」开销，不含真实 canvas 光栅化（ctx 为 no-op 桩）。
 * 光栅化/帧预算需在浏览器用 DevTools Performance 面板另测。
 *
 * 用法：
 *   node bench/render.cjs [组件数N] [distPath]
 * 示例：
 *   node bench/render.cjs 5000
 *   node bench/render.cjs 5000 ./dist/index.cjs
 *
 * 场景：
 *   A) 静态重绘：首帧全量 compose，之后每帧仅置 ice.dirty（模拟选中/悬停/resize 触发的整屏重绘）
 *   B) 动画：每帧所有组件 dirty（最差情况，composeMatrix 每帧执行）
 */
const path = require('path');

global.Path2D = class {
  rect() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  ellipse() {}
  arcTo() {}
  quadraticCurveTo() {}
  bezierCurveTo() {}
  addPath() {}
  roundRect() {}
};

// 离屏缓存需要 document.createElement('canvas') 得到可用的 2d ctx；
// ICEText.measureText 需要 document.createElement('div') 得到可量测的 DOM 节点。
const benchOffCtx = () => ({
  scale: () => {},
  setTransform: () => {},
  fillText: () => {},
  strokeText: () => {},
  setLineDash: () => {},
  save: () => {},
  restore: () => {},
  beginPath: () => {},
  moveTo: () => {},
  lineTo: () => {},
  stroke: () => {},
  fill: () => {},
  lineWidth: 1,
  fillStyle: '',
  strokeStyle: '',
});
const benchDocument = {
  getElementById: () => null,
  createElement: (tag) => {
    if (tag === 'canvas') {
      return { width: 0, height: 0, getContext: () => benchOffCtx() };
    }
    return {
      style: {},
      setAttribute: () => {},
      contenteditable: false,
      innerHTML: '',
      offsetWidth: 80,
      offsetHeight: 20,
    };
  },
  body: { appendChild: () => {} },
};
global.window = { document: benchDocument, devicePixelRatio: 1 };
global.document = benchDocument;

const TARGET_N = parseInt(process.argv[2] || '1000', 10);
const distPath =
  process.argv[3] || path.resolve(__dirname, '..', 'dist', 'index.cjs');

const iceMod = require(distPath);
const { ICE, ICEGroup, ICERect, ICECircle, ICEStar, ICEText, EventBus } = iceMod;

function makeCtx() {
  const ctx = {};
  const noop = () => {};
  [
    'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fill',
    'arc', 'rect', 'save', 'restore', 'setTransform', 'translate', 'rotate',
    'scale', 'fillRect', 'strokeRect', 'ellipse', 'arcTo', 'quadraticCurveTo',
    'bezierCurveTo', 'clip', 'drawImage',
  ].forEach((m) => (ctx[m] = noop));
  ctx.fillStyle = 0;
  ctx.strokeStyle = 0;
  ctx.lineWidth = 1;
  return ctx;
}

function walk(node, fn) {
  fn(node);
  if (node.childNodes) {
    for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], fn);
  }
}

// 构造一棵嵌套树：若干顶层 ICEGroup，每个含若干子组，子组含若干叶子形状。
function buildTree(targetN) {
  const root = new ICEGroup({ width: 2000, height: 2000, style: { fillStyle: '#ccc' } });
  let count = 1; // root group
  const topGroups = 10;
  const subPerTop = 5;
  const leavesPerSub = Math.max(1, Math.floor((targetN - count) / (topGroups * subPerTop)));
  for (let t = 0; t < topGroups && count < targetN; t++) {
    const g = new ICEGroup({ left: t * 40, top: 0, width: 200, height: 200, style: { fillStyle: 'blue' } });
    count++;
    for (let s = 0; s < subPerTop && count < targetN; s++) {
      const sg = new ICEGroup({ left: 0, top: s * 20, width: 80, height: 80, style: { fillStyle: 'green' } });
      count++;
      for (let l = 0; l < leavesPerSub && count < targetN; l++) {
        const leaf =
          l % 3 === 0
            ? new ICECircle({ left: (l * 7) % 60, top: (l * 11) % 60, width: 10, height: 10 })
            : l % 3 === 1
            ? new ICEStar({ left: (l * 7) % 60, top: (l * 11) % 60, width: 12, height: 12 })
            : new ICERect({ left: (l * 7) % 60, top: (l * 11) % 60, width: 14, height: 14 });
        sg.addChild(leaf);
        count++;
      }
      g.addChild(sg);
    }
    root.addChild(g);
  }
  return root;
}

// 文本场景：每个 ICEText 默认 width/height=10（sentinel），渲染时触发 measureText。
// 用于观察离屏缓存命中 vs 每帧重建的 JS 开销差异（静态命中跳过 measureText+fillText）。
function buildTextTree(targetN) {
  const root = new ICEGroup({ width: 2000, height: 2000, style: { fillStyle: '#ffffff' } });
  const cols = 40;
  for (let i = 0; i < targetN; i++) {
    const t = new ICEText({
      left: (i % cols) * 45,
      top: Math.floor(i / cols) * 28,
      text: '文本' + i,
      style: { fontSize: 16, fillStyle: '#111827' },
    });
    root.addChild(t);
  }
  return root;
}

// ---- 组装 harness（不调用 ICE.init，避免 rAF / DOM）----
const ctx = makeCtx();
const harness = new ICE();
harness.childNodes = [];
harness.toolNodes = [];
harness.root = global;
harness.ctx = ctx;
harness.canvasWidth = 2000;
harness.canvasHeight = 2000;
harness.evtBus = new EventBus();
harness.dirty = true;

const rootGroup = buildTree(TARGET_N);
harness.addChild(rootGroup); // 触发 afterAddHandler，同步子树事件
// 兜底：确保整棵树都被注入 ice/ctx/evtBus（深层嵌套保险）
walk(rootGroup, (n) => {
  n.ice = harness;
  n.ctx = ctx;
  n.evtBus = harness.evtBus;
});

const renderer = new iceMod.CanvasRenderer(harness);
renderer.start();

let totalCount = 0;
walk(rootGroup, () => totalCount++);

function createTextHarness(targetN) {
  const ctx = makeCtx();
  const harness = new ICE();
  harness.childNodes = [];
  harness.toolNodes = [];
  harness.root = global.window;
  harness.ctx = ctx;
  harness.canvasWidth = 2000;
  harness.canvasHeight = 2000;
  harness.evtBus = new EventBus();
  harness.dirty = true;

  const textRoot = buildTextTree(targetN);
  harness.addChild(textRoot);
  walk(textRoot, (n) => {
    n.ice = harness;
    n.ctx = ctx;
    n.evtBus = harness.evtBus;
  });

  const renderer = new iceMod.CanvasRenderer(harness);
  renderer.start();

  let textCount = 0;
  walk(textRoot, () => textCount++);
  return { harness, renderer, textRoot, totalCount: textCount };
}

function now() {
  return Number(process.hrtime.bigint()) / 1e6; // ms
}

function renderStatic() {
  harness.dirty = true;
  renderer.frameEvtHandler();
}
function markAllDirty() {
  walk(rootGroup, (n) => (n.dirty = true));
}
function renderAnimated() {
  markAllDirty();
  harness.dirty = true;
  renderer.frameEvtHandler();
}

function bench(fn, warmup, iters) {
  for (let i = 0; i < warmup; i++) fn();
  const samples = [];
  for (let i = 0; i < iters; i++) {
    const t0 = now();
    fn();
    const t1 = now();
    samples.push(t1 - t0);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];
  const avg = samples.reduce((s, v) => s + v, 0) / samples.length;
  return { median, avg, min: samples[0], max: samples[samples.length - 1] };
}

function benchRefreshQueue(warmup, iters) {
  for (let i = 0; i < warmup; i++) renderer.refreshQueue();
  const samples = [];
  for (let i = 0; i < iters; i++) {
    const t0 = now();
    renderer.refreshQueue();
    const t1 = now();
    samples.push(t1 - t0);
  }
  samples.sort((a, b) => a - b);
  return {
    median: samples[Math.floor(samples.length / 2)],
    avg: samples.reduce((s, v) => s + v, 0) / samples.length,
  };
}

console.log('========================================================');
console.log('ice-render 渲染热路径基准测试');
console.log('dist:', distPath);
console.log('组件总数 N =', totalCount, '(目标', TARGET_N + ')');
console.log('========================================================');

const WARM = 80;
const ITERS = 300;

markAllDirty();
renderStatic(); // 首帧（建立缓存）
const aSteady = bench(renderStatic, WARM, ITERS);
const bAnim = bench(renderAnimated, WARM, ITERS);
const q = benchRefreshQueue(WARM, ITERS);

// ---- 文本离屏缓存对比：静态命中（跳过 measureText/fillText） vs 每帧重建 ----
const textN = Math.min(TARGET_N, 500);
const th = createTextHarness(textN);
const renderTextStatic = () => {
  th.harness.dirty = true;
  th.renderer.frameEvtHandler();
};
const renderTextAnim = () => {
  walk(th.textRoot, (n) => (n.dirty = true));
  th.harness.dirty = true;
  th.renderer.frameEvtHandler();
};
renderTextStatic(); // 首帧建立文本离屏缓存
const cTextStatic = bench(renderTextStatic, WARM, ITERS);
const dTextAnim = bench(renderTextAnim, WARM, ITERS);

const f = (x) => x.toFixed(4).padStart(9);
console.log('');
console.log('场景 A 静态重绘 (稳态, 仅 ice.dirty) :  median=' + f(aSteady.median) + 'ms  avg=' + f(aSteady.avg) + 'ms  min=' + f(aSteady.min) + '  max=' + f(aSteady.max));
console.log('场景 B 动画     (每帧全量 compose)   :  median=' + f(bAnim.median) + 'ms  avg=' + f(bAnim.avg) + 'ms  min=' + f(bAnim.min) + '  max=' + f(bAnim.max));
console.log('refreshQueue (flattenTree+sort) 单次 :  median=' + f(q.median) + 'ms  avg=' + f(q.avg) + 'ms');
console.log('场景 C 文本静态 (离屏缓存命中, N=' + th.totalCount + ') :  median=' + f(cTextStatic.median) + 'ms  avg=' + f(cTextStatic.avg) + 'ms');
console.log('场景 D 文本动画 (每帧重建缓存, N=' + th.totalCount + ') :  median=' + f(dTextAnim.median) + 'ms  avg=' + f(dTextAnim.avg) + 'ms');
console.log('  文本缓存命中加速比: ' + (dTextAnim.median / cTextStatic.median).toFixed(2) + 'x');
console.log('');
console.log('等效帧率上限 (sceneA 稳态): ' + (1000 / aSteady.median).toFixed(0) + ' fps (仅引擎 JS 开销, 不含光栅化)');
console.log('等效帧率上限 (sceneB 动画): ' + (1000 / bAnim.median).toFixed(0) + ' fps (仅引擎 JS 开销, 不含光栅化)');
console.log('========================================================');
