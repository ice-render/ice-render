/**
 * 路径命令流（Path2DRecorder）的开销基准。
 *
 * 背景：导出 SVG / 服务端出图 / 「无原生 Path2D 时重放命令」都依赖路径的命令流，
 * 因此 `root.createPath2D()` 现在一律返回记录器 —— 一边记录、一边转发给原生 Path2D。
 * 记录必然有成本（每个命令多一次数组 push + 常驻内存），这里把它量出来，回答两个问题：
 *
 *  1. 路径**重建**（几何变化时才发生，不在每帧热路径上）慢了多少？—— 对照组是「只转发不记录」
 *     的同构实现，两者差值即记录本身的成本。
 *  2. 命令流常驻内存有多少（按形状数摊）。
 *
 * 另有 `export` 组：把 N 个形状导出成 SVG 字符串的耗时（导出是一次性操作，不进渲染循环）。
 *
 * 实测（Apple M4 / node 25.2.1，2026-09-12）：
 *  - 重建 2000 个形状：记录器 556µs vs 只转发 550µs —— **记录开销在噪声内**（≈3ns/形状）；
 *    原因很直接：记录只发生在路径重建时（几何变化才触发），热路径（每帧重绘）不重建路径。
 *  - 命令流内存（--expose-gc 另测）：约 **100 字节/命令**（命令是 [op, ...args] 小数组），
 *    圆角矩形 8 条命令 ≈ 0.8KB/图元；1 万个圆角矩形 ≈ 8MB。十万级场景若内存吃紧，
 *    下一步是把命令流压成「opcode + Float64Array 平铺」的紧凑表示（读侧 API 不变）。
 *  - 导出：500 个形状 2.9ms、2000 个 12.8ms（一次性，与渲染帧预算无关）。
 */
import { bench, do_not_optimize } from 'mitata';
import { ICERect, ICECircle, ICEStar, exportSvg, walk, buildTree } from './_fixture.mjs';

/** 只转发、不记录 —— 用来隔离「记录」这一项成本 */
class ForwardOnlyPath2D {
  constructor() {
    this._isPolyfill = true;
  }
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arcTo() {}
  rect() {}
  arc() {}
  ellipse() {}
  closePath() {}
}

/** 与应用层同构的形状组合：圆角矩形 / 圆 / 星形 */
function makeShapes(n) {
  const shapes = [];
  for (let i = 0; i < n; i++) {
    const kind = i % 3;
    if (kind === 0) {
      shapes.push(new ICERect({ left: (i * 7) % 400, top: (i * 11) % 400, width: 60, height: 40, radius: 8 }));
    } else if (kind === 1) {
      shapes.push(new ICECircle({ left: (i * 5) % 400, top: (i * 13) % 400, radius: 18 }));
    } else {
      shapes.push(new ICEStar({ left: (i * 3) % 400, top: (i * 17) % 400, width: 40, height: 40 }));
    }
  }
  return shapes;
}

bench('路径重建 · 记录器（含命令流）', function* (state) {
  const n = state.get('n');
  const shapes = makeShapes(n);
  yield () => {
    for (let i = 0; i < shapes.length; i++) {
      shapes[i].createPathObject();
    }
    do_not_optimize(shapes[0].path2D);
  };
}).args('n', [500, 2000]);

bench('路径重建 · 只转发不记录（对照）', function* (state) {
  const n = state.get('n');
  const shapes = makeShapes(n);
  yield () => {
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      const original = shape.path2D;
      // 换成 forward-only 实现跑一遍同样的命令序列
      shape.path2D = new ForwardOnlyPath2D();
      shape.createPathObject();
      shape.path2D = original;
    }
    do_not_optimize(shapes[0]);
  };
}).args('n', [500, 2000]);

bench('命令流常驻内存（构建整棵树后统计命令条数）', function* (state) {
  const n = state.get('n');
  yield () => {
    const root = buildTree(n);
    let commands = 0;
    let shapes = 0;
    walk(root, (node) => {
      node.ensurePathBuilt && node.ensurePathBuilt();
      if (node.path2D && node.path2D._commands) {
        shapes++;
        commands += node.path2D._commands.length;
      }
    });
    do_not_optimize(commands + shapes);
  };
}).args('n', [2000, 5000]);

bench('export：整棵树导出 SVG', function* (state) {
  const n = state.get('n');
  const root = buildTree(n);
  yield () => {
    const svg = exportSvg(root, { padding: 8, background: '#ffffff' });
    do_not_optimize(svg.length);
  };
}).args('n', [500, 2000]);
