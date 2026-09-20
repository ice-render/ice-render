/**
 * Worker 侧参考宿主：**镜像树 + 渲染 + 位图回传**。
 *
 * 它与主线程的分工严格照 `docs/architecture/10-worker-offscreen.md` §3：
 * - 主线程持有组件树与状态（唯一真相）与命中检测；
 * - 这里只有一棵 `MirrorTarget` 镜像树，收到 `scene` / `ops` 就照做，收到 `frame` 就叫醒一次渲染，
 *   然后把 `OffscreenCanvas` 的画面用 `transferToImageBitmap()` 交给主线程。
 *
 * 零注入：`importScripts` 之前**不再需要** `self.window = self`（2026-09-20 起引擎取 `globalThis`，
 * worker 是一等宿主）。
 */
importScripts('../../dist/index.umd.js');

const ICE = self.ICE;

/** @type {OffscreenCanvas} */
let off = new OffscreenCanvas(1, 1);
let ice = null;
let target = null;
let frames = 0;
let renderMsTotal = 0;

function bootScene(width, height) {
  off = new OffscreenCanvas(width, height);
  const ctx = off.getContext('2d');
  ice = new ICE.ICE();
  // worker 里 `ICE.init(ctx)` 与浏览器主线程同一条路径：DOM 相关的分支（输入、元素样式）
  // 在引擎里都有能力守卫，缺了就直接跳过。
  ice.init(ctx, { renderMode: 'full' });
  target = new ICE.MirrorTarget(ice);
  frames = 0;
  renderMsTotal = 0;
}

/** 收一帧：渲染 + `transferToImageBitmap` + 回传统计。 */
function renderAndPost(seq) {
  const t0 = performance.now();
  // 引擎默认「没有脏组件/活动动画就停帧」，所以这里显式叫醒一次（收到 frame 消息 = 有新状态）
  ICE.FrameManager.wake();
  ice.dirty = true;
  // 直接跑渲染器的帧回调：worker 的节拍由主线程给（不用等定时器兜底那一跳），
  // 采样点也更干净 —— 统计里量的就是"这一帧的渲染耗时"。
  ice.renderer.frameEvtHandler();
  const renderMs = performance.now() - t0;
  frames++;
  renderMsTotal += renderMs;

  const bitmap = off.transferToImageBitmap();
  self.postMessage(
    {
      t: 'rendered',
      v: ICE.MIRROR_PROTOCOL_VERSION,
      // `frame` 消息没有 seq（它不是状态批次）：用单调帧号当序号，宿主对账更直观
      seq: typeof seq === 'number' ? seq : frames,
      bitmap,
      stats: {
        renderMs,
        components: ice.renderer.componentQueue ? ice.renderer.componentQueue.length : 0,
        frames,
        appliedOps: target.appliedOps,
      },
    },
    [bitmap]
  );
}

self.onmessage = function (evt) {
  const msg = evt.data;
  if (!ICE.isMirrorCommand(msg)) {
    self.postMessage({
      t: 'error',
      v: ICE.MIRROR_PROTOCOL_VERSION,
      message: '无法识别的镜像指令',
      code: 'MIRROR_BAD_COMMAND',
    });
    return;
  }
  if (msg.t === 'resize') {
    off.width = Math.max(1, msg.width | 0);
    off.height = Math.max(1, msg.height | 0);
    return;
  }
  if (msg.t === 'frame') {
    if (!ice) {
      self.postMessage({
        t: 'error',
        v: ICE.MIRROR_PROTOCOL_VERSION,
        message: '还没收到场景',
        code: 'MIRROR_NO_SCENE',
      });
      return;
    }
    renderAndPost(msg.seq);
    return;
  }
  if (msg.t === 'scene' && msg.doc && !ice) {
    // 场景消息里带画布尺寸：`scene` 之前主线程会先发 `resize`
    bootScene(off.width, off.height);
  }
  const result = target ? target.applyCommand(msg) : null;
  if (result && result.missing && result.missing.length) {
    self.postMessage({ t: 'missing', v: ICE.MIRROR_PROTOCOL_VERSION, seq: msg.seq, ids: result.missing });
  }
  if (result && result.unknownTypes && result.unknownTypes.length) {
    self.postMessage({
      t: 'error',
      v: ICE.MIRROR_PROTOCOL_VERSION,
      message: `worker 侧有未注册的类型：${result.unknownTypes.join(', ')}`,
      code: 'MIRROR_UNKNOWN_TYPES',
    });
  }
};

self.postMessage({
  t: 'ready',
  v: ICE.MIRROR_PROTOCOL_VERSION,
  caps: {
    offscreen: typeof OffscreenCanvas === 'function',
    path2d: typeof Path2D === 'function',
    pointerEvents: typeof PointerEvent === 'function',
  },
});
