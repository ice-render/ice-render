/**
 * bench/micro 微基准共享 fixture。
 *
 * 加载构建产物 dist/index.cjs（CJS），构造 stub ctx 驱动的引擎场景，
 * 供各 .bench.mjs 用例使用。注意：
 *  - 微基准直接消费 dist，改动 src/ 后需先 `npm run build` 再跑 `npm run bench:micro`。
 *  - 本套件只测「引擎 JS 逻辑层」开销，不含真实 canvas 光栅化（ctx 为 no-op 桩）。
 *    真实光栅化/帧预算见 examples/performance/bench-scene.html + e2e/visual/perf.spec.ts。
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

export const mod = require(path.resolve(__dirname, '..', '..', 'dist', 'index.cjs.js'));
export const { ICE, ICEGroup, ICERect, ICECircle, ICEStar, ICEPolyLine, EventBus, CanvasRenderer } = mod;

/** no-op ctx 桩：只提供引擎用到的属性和方法。 */
export function makeCtx() {
  const ctx = {};
  const noop = () => {};
  [
    'clearRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fill',
    'arc', 'rect', 'save', 'restore', 'setTransform', 'translate', 'rotate',
    'scale', 'fillRect', 'strokeRect', 'ellipse', 'arcTo', 'quadraticCurveTo',
    'bezierCurveTo', 'clip', 'drawImage', 'measureText',
  ].forEach((m) => (ctx[m] = noop));
  ctx.setLineDash = noop;
  ctx.fillStyle = 0;
  ctx.strokeStyle = 0;
  ctx.lineWidth = 1;
  ctx.font = '';
  return ctx;
}

export function walk(node, fn) {
  fn(node);
  if (node.childNodes) {
    for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], fn);
  }
}

/**
 * 构造一棵确定性嵌套树（与 bench/render.cjs 同构）：
 * rootGroup(1) → topGroups 个顶层组 → 每个含 subPerTop 个子组 → 每个含若干叶子形状。
 * 叶子形状依次循环 ICECircle / ICEStar / ICERect。
 */
export function buildTree(targetN) {
  const root = new ICEGroup({ width: 2000, height: 2000, style: { fillStyle: '#ccc' } });
  let count = 1;
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

/**
 * 组装 harness（不调用 ICE.init，避免 rAF/DOM）并挂上 CanvasRenderer。
 * @returns {{ ice:any, renderer:any, rootGroup:any, ctx:any, totalCount:number, markAllDirty:()=>void }}
 */
export function createScene(targetN) {
  const ctx = makeCtx();
  const ice = new ICE();
  ice.childNodes = [];
  ice.toolNodes = [];
  ice.root = global;
  ice.ctx = ctx;
  ice.canvasWidth = 2000;
  ice.canvasHeight = 2000;
  ice.evtBus = new EventBus();
  ice.dirty = true;

  const rootGroup = buildTree(targetN);
  ice.addChild(rootGroup);
  // 兜底：确保整棵树都被注入 ice/ctx/evtBus（深层嵌套保险）
  walk(rootGroup, (n) => {
    n.ice = ice;
    n.ctx = ctx;
    n.evtBus = ice.evtBus;
  });

  const renderer = new CanvasRenderer(ice);
  renderer.start();

  let totalCount = 0;
  walk(rootGroup, () => totalCount++);

  return {
    ice,
    renderer,
    rootGroup,
    ctx,
    totalCount,
    markAllDirty() {
      walk(rootGroup, (n) => (n.dirty = true));
    },
  };
}
