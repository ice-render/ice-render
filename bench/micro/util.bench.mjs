/**
 * 状态/工具函数微基准。
 *
 * 覆盖：setState（叶子 vs 容器递归标脏）、applyStyleToCtx、getMinBoundingBox、
 * getMaxBoundingBox、getRotateAngle、flattenTree、Serializer 整树序列化。
 * 注：util/lang 的 merge/cloneDeep 只参与构造与序列化路径、不在帧热路径，
 * 且未从 dist 导出，故不在此处单独测量（被 setState/构造间接覆盖）。
 */
import { bench, do_not_optimize } from 'mitata';
import { createScene, walk, mod } from './_fixture.mjs';

const { Serializer } = mod; // 若 dist 版本未导出则为 undefined（util.bench 会自动跳过该用例）

const scene = createScene(1000);
scene.ice.dirty = true;
scene.renderer.frameEvtHandler();

// 找：一个顶层容器组 / 它下面的一个子容器 / 一个最深层叶子
const topGroup = scene.rootGroup.childNodes[0];
const midGroup = topGroup.childNodes[0];
let deepLeaf = null;
walk(scene.rootGroup, (n) => {
  if (!deepLeaf && (!n.childNodes || n.childNodes.length === 0)) deepLeaf = n;
});

const scene2 = createScene(1000);
scene2.ice.dirty = true;
scene2.renderer.frameEvtHandler();
const styleLeaf = scene2.rootGroup.childNodes[0].childNodes[0].childNodes[0];

let sink = 0;
function keep(v) {
  sink += typeof v === 'number' ? v : Array.isArray(v) ? v.length : 1;
}

bench('setState (叶子, 浅合并+自身标脏)', () => {
  deepLeaf.setState({ left: (deepLeaf.state.left + 1) % 100 });
  do_not_optimize(sink);
});

bench('setState (容器, 递归标记整棵子树)', () => {
  midGroup.setState({ left: (midGroup.state.left + 1) % 100 });
  do_not_optimize(sink);
});

bench('applyStyleToCtx (遍历 style 写 ctx)', () => {
  styleLeaf.applyStyleToCtx();
  do_not_optimize(styleLeaf.ctx);
});

bench('getMinBoundingBox (缓存矩阵, 顶层组)', () => {
  const b = topGroup.getMinBoundingBox();
  keep([b.width, b.height]);
  do_not_optimize(sink);
});

bench('getMaxBoundingBox (缓存矩阵, 顶层组)', () => {
  const b = topGroup.getMaxBoundingBox();
  keep([b.width, b.height]);
  do_not_optimize(sink);
});

bench('getRotateAngle (从矩阵解析角度)', () => {
  const a = topGroup.getRotateAngle();
  sink += a;
  do_not_optimize(sink);
});

bench('flattenTree 等价递归展平 (1000 节点)', () => {
  const out = [];
  const nodes = scene.rootGroup.childNodes;
  (function rec(list) {
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      out.push(node);
      if (node.childNodes && node.childNodes.length) rec(node.childNodes);
    }
  })(nodes);
  keep(out.length);
  do_not_optimize(sink);
});

// Serializer 未从 dist 导出时跳过该用例
if (typeof Serializer === 'function') {
  bench('Serializer.toJSONObject (1000 节点树)', () => {
    const serializer = new Serializer(scene.ice);
    const obj = serializer.toJSONObject();
    keep(obj.childNodes.length);
    do_not_optimize(sink);
  });
}
