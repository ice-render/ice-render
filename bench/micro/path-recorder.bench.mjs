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
 * 实测（Apple M4 / node 25.2.1，2026-09-20）：
 *  - 重建 500 / 2000 个形状：记录器 **90µs / 373µs**，只转发 **15µs / 61µs**
 *    —— 记录的边际成本 ≈ **156ns/形状**（≈11ns/命令）。它只发生在**路径重建**时
 *    （几何变化才触发），稳态重绘不重建路径，因此不进每帧预算。
 *  - 圆角矩形改用平台 `roundRect` 后，同一组形状（1/3 是圆角矩形）的重建从
 *    **127.9µs → 88.0µs**（n=500，与 `bench/micro/baseline.json` 的 3.0.0 基线同机对照）。
 *  - 命令流规模：圆角矩形从「4 次 arcTo 展开」的 **14 条命令**降到 `roundRect` 的 **1 条**
 *    （2026-09-20 起走平台 `roundRect`，见 `src/util/round-rect.ts`）。1000 个圆角矩形：
 *    14000 条 → 1000 条。命令是 `[op, ...args]` 小数组，按 ≈100 字节/命令估，
 *    这一步省掉的是**每图元约 1.3KB** —— 流程图这类"满地圆角卡片"的场景最吃这个。
 *    十万级场景若内存仍吃紧，下一步是把命令流压成「opcode + Float64Array 平铺」（读侧 API 不变）。
 *  - 导出：500 个形状 2.9ms、2000 个 12.8ms（一次性，与渲染帧预算无关）。
 *
 * ⚠️ 「只转发不记录」的对照组必须换掉 **工厂**（`global.createPath2D`），不能只塞一个
 * `shape.path2D`：`createPathObject()` 第一句就是 `this.path2D = root.createPath2D()`，
 * 塞进去的对象下一行就被覆盖 —— 那样两个基准测的是同一件事，差值只是噪声（2026-09-20 修）。
 */
import { bench, do_not_optimize } from 'mitata';
import { ICERect, ICECircle, ICEStar, exportSvg, walk, buildTree } from './_fixture.mjs';

/** 只转发、不记录 —— 用来隔离「记录」这一项成本 */
class ForwardOnlyPath2D {
  constructor() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arcTo() {}
  rect() {}
  roundRect() {}
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
  // 对照组必须换掉**工厂**，不能只塞一个 `shape.path2D`：
  // 每个 `createPathObject()` 第一句就是 `this.path2D = root.createPath2D()`，
  // 塞进去的对象在下一行就被覆盖了 —— 那样两个基准测的是同一件事（这正是此前的问题）。
  // Node 里引擎的 `root` 就是 `global`，所以直接换 global.createPath2D 即可生效。
  const realCreatePath2D = global.createPath2D;
  yield () => {
    global.createPath2D = () => new ForwardOnlyPath2D();
    try {
      for (let i = 0; i < shapes.length; i++) {
        shapes[i].createPathObject();
      }
    } finally {
      global.createPath2D = realCreatePath2D;
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
