/**
 * 矩阵/坐标热路径微基准。
 *
 * 覆盖：calcLinearMatrix / calcAbsoluteLinearMatrix / composeMatrix /
 * calcLocalOrigin / calcAbsoluteOrigin / localToGlobal / globalToLocal /
 * moveGlobalPosition / setGlobalRotate。
 *
 * 场景：createScene(600) 的真实嵌套树，取最深层叶子组件作为被测对象
 * （其 parentNode 链上有真实的 ICEGroup 变换），先渲染一帧建立矩阵缓存，
 * 再逐个测「稳态单组件」的矩阵运算开销。
 */
import { bench, do_not_optimize } from 'mitata';
import { createScene } from './_fixture.mjs';

function findDeepLeaf(comp) {
  if (!comp.childNodes || comp.childNodes.length === 0) return comp;
  return findDeepLeaf(comp.childNodes[0]);
}

const scene = createScene(600);
const { renderer, ice } = scene;
// 首帧渲染：让每层的 linearMatrix / composedMatrix / localOrigin 等缓存就位
ice.dirty = true;
renderer.frameEvtHandler();

const leaf = findDeepLeaf(scene.rootGroup);
const matrix = leaf.state.composedMatrix;
const leafOrigin = [matrix[4], matrix[5]]; // composedMatrix 的平移 = 绝对原点

// 累计器防 DCE：矩阵/点运算返回值都汇入 sink
let sink = 0;
function keep(v) {
  sink += typeof v === 'number' ? v : v ? v[0] || 0 : 0;
}

bench('calcLinearMatrix (leaf 自身线性矩阵)', () => {
  const m = leaf.calcLinearMatrix();
  keep(m);
  do_not_optimize(sink);
});

bench('calcAbsoluteLinearMatrix (leaf, 深度3嵌套)', () => {
  const m = leaf.calcAbsoluteLinearMatrix();
  keep(m);
  do_not_optimize(sink);
});

bench('composeMatrix (leaf, 含祖先重算)', () => {
  const m = leaf.composeMatrix();
  keep(m);
  do_not_optimize(sink);
});

bench('calcLocalOrigin', () => {
  const o = leaf.calcLocalOrigin();
  keep(o);
  do_not_optimize(sink);
});

bench('calcAbsoluteOrigin', () => {
  const o = leaf.calcAbsoluteOrigin();
  keep(o);
  do_not_optimize(sink);
});

bench('localToGlobal', () => {
  const p = leaf.localToGlobal(10, 20);
  keep(p);
  do_not_optimize(sink);
});

bench('globalToLocal', () => {
  const p = leaf.globalToLocal(50, 60);
  keep(p);
  do_not_optimize(sink);
});

bench('moveGlobalPosition (+1,+1, 含父逆矩阵换算)', () => {
  leaf.moveGlobalPosition(1, 1);
  do_not_optimize(sink);
});

bench('setGlobalRotate (+1, 含祖先旋转抵消)', () => {
  leaf.setGlobalRotate(1);
  do_not_optimize(sink);
});

bench('getMinBoundingBox (refresh 重算)', () => {
  const b = leaf.getMinBoundingBox(true);
  keep([b.tl[0], b.tl[1], b.width, b.height]);
  do_not_optimize(sink);
});

// 顶层组件（parentNode 为 null，parent 分支短路）作为对照
const top = scene.rootGroup;
bench('composeMatrix (顶层 root, 无祖先)', () => {
  const m = top.composeMatrix();
  keep(m);
  do_not_optimize(sink);
});

bench('calcAbsoluteOrigin (顶层 root, 无祖先)', () => {
  const o = top.calcAbsoluteOrigin();
  keep(o);
  do_not_optimize(sink);
});

// 命中检测场景：用缓存的 composedMatrix 反变换一个点
bench('containsPoint (圆形叶子, 本地原点)', () => {
  const hit = leaf.containsPoint(leafOrigin[0], leafOrigin[1]);
  sink += hit ? 1 : 0;
  do_not_optimize(sink);
});

// 保持引用，避免引擎把未用变量标记为死代码
export const _exports = { matrix, leafOrigin };
void _exports;
