/**
 * 命中检测微基准。
 *
 * containsPoint 的两种路径都会被测到：
 *  1) 命中发生在渲染之后：用缓存的 composedMatrix 反变换 + containsLocalPoint（引擎常规路径）。
 *  2) 从未渲染过的组件（无 composedMatrix）：退化为包围盒判定。
 * 场景覆盖矩形 / 圆形 / 星形 / 折线等不同 containsLocalPoint 实现。
 */
import { bench, do_not_optimize } from 'mitata';
import { createScene, makeCtx, mod } from './_fixture.mjs';

const { ICE, ICEGroup, ICERect, ICECircle, ICEStar, ICEPolyLine, EventBus, CanvasRenderer } = mod;

function freshHarness() {
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
  const renderer = new CanvasRenderer(ice);
  renderer.start();
  return { ice, renderer };
}

function renderOnce(ice, renderer) {
  ice.dirty = true;
  renderer.frameEvtHandler();
}

let sink = 0;

// ---- 渲染后的精确命中（真实路径：矩阵反变换 + 形状判定）----
const hitScene = createScene(200);
renderOnce(hitScene.ice, hitScene.renderer);
const comps = [];
(function collect(c) {
  if (!c.childNodes || c.childNodes.length === 0) comps.push(c);
  else c.childNodes.forEach(collect);
})(hitScene.rootGroup);
const rectLike = comps.find((c) => c.props.width === 14); // 树里矩形叶子宽 14
const circleLike = comps.find((c) => c instanceof ICECircle);
const starLike = comps.find((c) => c instanceof ICEStar);

function originPoint(c) {
  const m = c.state.composedMatrix;
  return [m[4], m[5]];
}
const rectPt = originPoint(rectLike);
const circlePt = originPoint(circleLike);
const starPt = originPoint(starLike);

bench('containsPoint 矩形 (矩阵反变换 + AABB)', () => {
  sink += rectLike.containsPoint(rectPt[0], rectPt[1]) ? 1 : 0;
  do_not_optimize(sink);
});

bench('containsPoint 圆形 (矩阵反变换 + 椭圆方程)', () => {
  sink += circleLike.containsPoint(circlePt[0], circlePt[1]) ? 1 : 0;
  do_not_optimize(sink);
});

bench('containsPoint 星形 (矩阵反变换 + 射线法)', () => {
  sink += starLike.containsPoint(starPt[0], starPt[1]) ? 1 : 0;
  do_not_optimize(sink);
});

// ---- 未渲染组件的包围盒退化命中 ----
function benchUnrendered(kind, Clazz, props) {
  const c = new Clazz({ left: 100, top: 100, ...props });
  const cx = 100 + props.width / 2;
  const cy = 100 + props.height / 2;
  bench(`containsPoint ${kind} (未渲染, 包围盒退化)`, () => {
    sink += c.containsPoint(cx, cy) ? 1 : 0;
    do_not_optimize(sink);
  });
}
benchUnrendered('矩形', ICERect, { width: 60, height: 40 });
benchUnrendered('圆形', ICECircle, { radius: 30, width: 60, height: 60 });
benchUnrendered('星形', ICEStar, { outerRadius: 30, innerRadius: 12, width: 60, height: 60 });

// ---- 折线命中：点到线段距离 ----
const polyHarness = freshHarness();
const line = new ICEPolyLine({
  points: [
    [100, 100],
    [200, 100],
    [200, 200],
  ],
  lineWidth: 4,
  style: { lineWidth: 4 },
});
polyHarness.ice.addChild(line);
renderOnce(polyHarness.ice, polyHarness.renderer);
bench('containsPoint 折线 (点-线段距离)', () => {
  sink += line.containsPoint(150, 100) ? 1 : 0;
  do_not_optimize(sink);
});

// ---- 命中前的矩阵反变换本身 ----
const sceneForInvert = createScene(200);
renderOnce(sceneForInvert.ice, sceneForInvert.renderer);
const someComp = sceneForInvert.rootGroup;
bench('containsPoint 前置: composedMatrix 逆变换', () => {
  const composed = someComp.state.composedMatrix;
  sink += composed && composed.length ? 1 : 0;
  someComp.containsPoint(1000, 1000);
  do_not_optimize(sink);
});
