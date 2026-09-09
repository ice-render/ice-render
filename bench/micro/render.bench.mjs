/**
 * 渲染链路整体微基准（stub ctx，只测引擎 JS 层）。
 *
 * 参数化组件规模 N：
 *  - static：稳态单帧重绘（仅 ice.dirty，走渲染队列缓存 + 复用矩阵缓存）。
 *  - anim：  每帧所有组件 dirty（最差情况，逐组件 composeMatrix）。
 *  - refreshQueue cached：结构未变，O(n) zIndex 稳定性比对。
 *  - refreshQueue rebuild：markQueueDirty 后重建 flattenTree + sort。
 */
import { bench, do_not_optimize } from 'mitata';
import { createScene } from './_fixture.mjs';

bench('static 稳态重绘', function* (state) {
  const n = state.get('n');
  const s = createScene(n);
  // 首帧（建立队列缓存 / 矩阵缓存）
  s.ice.dirty = true;
  s.renderer.frameEvtHandler();
  yield () => {
    s.ice.dirty = true;
    s.renderer.frameEvtHandler();
    do_not_optimize(s.ice.dirty);
  };
}).args('n', [500, 2000, 5000]);

bench('anim 每帧全量 compose', function* (state) {
  const n = state.get('n');
  const s = createScene(n);
  s.ice.dirty = true;
  s.renderer.frameEvtHandler();
  yield () => {
    s.markAllDirty();
    s.ice.dirty = true;
    s.renderer.frameEvtHandler();
    do_not_optimize(s.ice.dirty);
  };
}).args('n', [500, 2000, 5000]);

bench('refreshQueue 稳态 (cached)', function* () {
  const s = createScene(5000);
  s.renderer.refreshQueue();
  yield () => {
    s.renderer.refreshQueue();
    do_not_optimize(s.renderer);
  };
});

bench('refreshQueue 重建 (markQueueDirty)', function* () {
  const s = createScene(5000);
  s.renderer.refreshQueue();
  yield () => {
    s.renderer.markQueueDirty();
    s.renderer.refreshQueue();
    do_not_optimize(s.renderer);
  };
});
