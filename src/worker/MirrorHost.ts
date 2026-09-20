/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import MirrorBridge from './MirrorBridge';
import { MIRROR_PROTOCOL_VERSION, MirrorEvent, MirrorStats } from './mirror-protocol';

export type MirrorHostOptions = {
  /** 可见画布：既显示 worker 回传的位图，也是**输入矩形**的来源（DOM 事件按它换算坐标） */
  canvas: any;
  /** 主线程的 ICE（唯一真相，通常已经 `init(canvas)` 过） */
  ice: any;
  /** worker 脚本地址（同源；经典 worker，内部 `importScripts` 加载引擎 UMD） */
  workerUrl?: string;
  /** 自己造 worker（测试里可以注入假的传输层；给了它就不用 workerUrl） */
  workerFactory?: () => any;
  /** 是否自动按 rAF 驱动节拍，默认 true；false = 由宿主自己调 `frame()` */
  autoFrame?: boolean;
  /** 收到 worker 位图时回调（在合成到可见画布**之前**）。宿主可用来取像素/二次合成 */
  onBitmap?: (bitmap: any, stats: MirrorStats) => void;
  /** 统计回调（每帧 rendered 事件一次） */
  onStats?: (stats: MirrorStats) => void;
  /** 错误/协议事件回调 */
  onEvent?: (evt: MirrorEvent) => void;
};

/**
 * **主线程侧的镜像宿主**：把「可见画布 / 主线程几何通道 / worker 渲染」三件事接起来。
 *
 * 分工（见 docs/architecture/10-worker-offscreen.md §3）：
 *
 * ```
 * 主线程                                      worker
 *  ├─ DOM 事件 → 命中检测（读渲染期快照盒）      ├─ 镜像树（MirrorTarget）
 *  ├─ 组件树与状态（唯一真相）                   ├─ CanvasRenderer + OffscreenCanvas
 *  ├─ 几何通道：跑渲染管线但**不产出像素**  ──►  ├─ 真实光栅化
 *  └─ 可见画布：只负责把 worker 位图贴上去  ◄──  └─ transferToImageBitmap
 * ```
 *
 * 三个关键决定：
 *
 * 1. **主线程仍然跑渲染管线**（否则命中检测会瞎），但把落墨换成一个"吞掉绘制调用"的上下文
 *    —— `CanvasRenderer.getWorldBox()` 读的是**渲染期快照**（`__snap`），不跑管线世界盒就是空的，
 *    命中直接失效。见 `ICE.setPaintTarget()` 与下面的 `createGeometryOnlyContext()`。
 * 2. **主线程关掉离屏位图缓存**（`cache.isCachable = () => false`）：既然不产出像素，位图缓存只是
 *    白白占用主线程 CPU（它的收益是"少画几次"，而这里的绘制本来就不产生像素）。
 * 3. **输入不跨线程**：worker 只收渲染节拍与状态，DOM 事件永远在主线程处理 —— 这就是
 *    "命中检测铁律不变"的落地方式（也意味着不存在坐标换算的双份实现）。
 */
export default class MirrorHost {
  public readonly ice: any;
  public readonly canvas: any;
  public bridge: MirrorBridge;

  private worker: any = null;
  private options: MirrorHostOptions;
  private rafId: any = null;
  private running = false;
  /** 几何通道（吞掉绘制、保留 measureText）：`stop()` 时用来还原 */
  private geometryCtx: any = null;
  private originalCtx: any = null;
  private originalIsCachable: any = null;
  private bitmapCtx: any = null;
  private lastStats: MirrorStats | null = null;
  private receivedFrames = 0;
  /** 最后收到的位图对应的 `frame.seq`（worker 原样回传；见 MirrorBridge.lastFrameSeq） */
  private lastRenderedSeq = 0;
  /** 首帧 / 重同步之后即便"没有变化"也要发一帧（见 `frame()` 的空闲门控） */
  private __paintPending = true;
  /**
   * **至多一帧在途**（背压）。
   *
   * worker 一帧要几毫秒（真实应用实测 2~3ms），而主线程按 rAF 或交互节奏每 ~1ms 就能发一帧；
   * 不设背压时 `frame` 消息会越排越多 —— 实测一个 30 帧的基准跑完，worker 那边积压了两百多条
   * `frame`（`renderedSeq=45` vs `lastFrameSeq=240`）：镜像要好几秒才追上，期间画出来的每一帧
   * 都是**过时**的状态，静止态对账还会把它误读成"状态分叉"。
   *
   * 有了它，镜像的滞后上界是**一次往返**，而且总是拿最新状态画（这才是"镜像"该有的语义）。
   */
  private __frameInFlight = false;
  /** 有帧在途时又被要求画：等这一帧回来立刻补一帧（不排队，只记一次） */
  private __frameQueued = false;

  constructor(options: MirrorHostOptions) {
    if (!options || !options.canvas) {
      throw new Error('[ice-render] MirrorHost: 需要 canvas（可见画布）。');
    }
    if (!options.ice) {
      throw new Error('[ice-render] MirrorHost: 需要 ice（主线程的 ICE 实例）。');
    }
    if (!options.workerUrl && !options.workerFactory) {
      throw new Error('[ice-render] MirrorHost: 需要 workerUrl 或 workerFactory。');
    }
    this.options = options;
    this.canvas = options.canvas;
    this.ice = options.ice;
    this.bridge = new MirrorBridge(this.ice, {
      send: (msg) => this.__post(msg),
      onEvent: (evt) => this.__onEvent(evt),
    });
  }

  /** 已收到的 worker 帧数（宿主做 FPS 面板用）。 */
  public get frames(): number {
    return this.receivedFrames;
  }

  /**
   * 手上这张位图对应的 `frame.seq`。
   *
   * 与 `bridge.lastFrameSeq` 比较即可判断"排空"：位图是背压的（worker 一帧要几毫秒，
   * 主线程每帧都发），"又来了一张位图"并不等于"它已经是当前状态" —— 截图 / 像素验收 /
   * 几何对账都必须等这个水印追平。
   */
  public get renderedSeq(): number {
    return this.lastRenderedSeq;
  }

  public get stats(): MirrorStats | null {
    return this.lastStats;
  }

  /** 启动：接管落墨通道、拉起 worker、开始按 rAF 驱动节拍。 */
  public start(): this {
    if (this.running) return this;
    this.running = true;

    // 1) 主线程改走"几何通道"：跑管线、算世界盒，但不产出像素
    this.originalCtx = this.ice.ctx;
    this.geometryCtx = createGeometryOnlyContext(this.originalCtx);
    this.ice.setPaintTarget(this.geometryCtx);
    const cache: any = this.ice.renderer && this.ice.renderer.cache;
    if (cache && typeof cache.isCachable === 'function') {
      this.originalIsCachable = cache.isCachable.bind(cache);
      cache.isCachable = () => false;
    }

    // 2) 可见画布只负责贴位图（优先位图渲染上下文，退回 2d）
    this.bitmapCtx = (typeof this.canvas.getContext === 'function' && this.canvas.getContext('bitmaprenderer')) || null;

    // 3) 拉起 worker
    this.worker = this.options.workerFactory ? this.options.workerFactory() : new Worker(this.options.workerUrl);
    this.worker.onmessage = (evt: any) => this.__onMessage(evt && evt.data);
    this.worker.onerror = (e: any) => {
      this.__onEvent({
        t: 'error',
        v: MIRROR_PROTOCOL_VERSION,
        message: (e && e.message) || 'worker 运行错误',
        code: 'MIRROR_WORKER_ERROR',
      });
    };

    // 4) 尺寸 + 首帧
    this.bridge.resize(this.canvas.width || this.ice.canvasWidth, this.canvas.height || this.ice.canvasHeight);
    // `prime()` 而不是 `markSceneNeeded()`：宿主可能是应用跑了一阵之后才接上来的，
    // 视口/选择要一起对齐（否则新镜像从默认视口出发，两边看的是不同区域）
    this.bridge.prime();
    this.__paintPending = true;
    this.frame();

    // 5) 节拍：主线程的 rAF 是唯一时钟（worker 只在这条消息之后画）
    if (this.options.autoFrame !== false && typeof requestAnimationFrame === 'function') {
      const tick = () => {
        this.rafId = requestAnimationFrame(tick);
        this.frame();
      };
      this.rafId = requestAnimationFrame(tick);
    }
    return this;
  }

  /**
   * 手动驱动一帧（`autoFrame: false` 时由宿主调）。先补发状态，再发节拍。
   *
   * **空闲门控**：没有任何待发消息、主线程也没有脏组件/活动动画时，直接不发 ——
   * 场景静止占绝大多数时间，60fps 空发 `frame` 只会白烧 postMessage 与 worker 的一次渲染。
   * （引擎自己有"空闲停帧"，这里把同一条纪律延伸到跨线程那一侧。）
   */
  public frame(time?: number): void {
    if (!this.running) return;
    if (this.__frameInFlight) {
      this.__frameQueued = true;
      return;
    }
    const needsPaint = typeof this.ice.needsFrame === 'function' ? this.ice.needsFrame() : true;
    if (!this.__paintPending && !this.bridge.hasPending() && !needsPaint) {
      this.__frameQueued = false;
      return;
    }
    this.__paintPending = false;
    this.__frameInFlight = true;
    this.bridge.frame(typeof time === 'number' ? time : now());
  }

  /** 画布尺寸变了：同步给 worker（它会重建 OffscreenCanvas）。 */
  public resize(width: number, height: number): void {
    this.bridge.resize(width, height);
    this.__paintPending = true; // 尺寸变了必须重画一帧
  }

  /**
   * 强制渲染一帧（**忽略空闲门控**）。
   *
   * 空闲门控的依据是"没有待发消息、主线程也没有脏组件/活动动画"；宿主自己知道得更多时
   * （例如它刚改了只影响渲染的宿主侧状态、或需要立刻刷新一次），用这个入口显式要一帧。
   */
  public paint(time?: number): void {
    if (!this.running) return;
    this.__paintPending = true;
    this.frame(time);
  }

  /** 停掉：取消节拍、结束 worker、把落墨通道还原（宿主可能继续用主线程渲染）。 */
  public stop(): void {
    if (!this.running) return;
    this.running = false;
    this.__frameInFlight = false;
    this.__frameQueued = false;
    if (this.rafId !== null && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.worker && typeof this.worker.terminate === 'function') {
      this.worker.terminate();
    }
    this.worker = null;
    const cache: any = this.ice.renderer && this.ice.renderer.cache;
    if (cache && this.originalIsCachable) {
      cache.isCachable = this.originalIsCachable;
      this.originalIsCachable = null;
    }
    if (this.originalCtx) {
      this.ice.setPaintTarget(this.originalCtx);
      this.originalCtx = null;
    }
    this.bridge.detach();
  }

  private __post(msg: any): void {
    if (this.worker && typeof this.worker.postMessage === 'function') {
      this.worker.postMessage(msg);
    }
  }

  private __onMessage(msg: any): void {
    if (msg && msg.bitmap) {
      this.receivedFrames++;
      this.lastRenderedSeq = typeof msg.seq === 'number' ? msg.seq : this.lastRenderedSeq;
      this.lastStats = msg.stats || null;
      this.__frameInFlight = false;
      if (this.options.onBitmap) {
        this.options.onBitmap(msg.bitmap, msg.stats);
      }
      this.__composite(msg.bitmap);
      if (this.options.onStats && msg.stats) {
        this.options.onStats(msg.stats);
      }
      /**
       * 这一帧在路上时又被要求画 → 现在补一帧。
       *
       * 补帧放在**合成之后**：可见画布先拿到刚落地的这张，再让 worker 去画下一张，
       * 这样"贴图"和"发下一帧"不会互相插队（否则画面会跳过一帧）。
       */
      if (this.__frameQueued) {
        this.__frameQueued = false;
        this.frame();
      }
      return;
    }
    if (msg && typeof msg.t === 'string') {
      this.bridge.handleEvent(msg);
    }
  }

  /** 把 worker 的位图贴到可见画布上（位图渲染上下文是零拷贝路径）。 */
  private __composite(bitmap: any): void {
    if (this.bitmapCtx && typeof this.bitmapCtx.transferFromImageBitmap === 'function') {
      // 位图渲染上下文是"整块替换"语义：没有变换、没有形状状态，直接交出去最省
      this.bitmapCtx.transferFromImageBitmap(bitmap);
      return;
    }
    const ctx = this.canvas.getContext && this.canvas.getContext('2d');
    if (ctx && typeof ctx.drawImage === 'function') {
      /**
       * **必须先 `setTransform` 到单位矩阵**（2026-09-20 由 ice-entity-designer 的流程图抓出来）。
       *
       * 主画布的 2d 上下文里可能还留着**上一个组件的 CTM**（渲染器逐组件设完变换就继续，不负责复位）；
       * 带着那个变换去 `drawImage`，整张位图会被平移/缩放地贴上去 —— 症状是"镜像画面整体错位"，
       * 而用隐藏画布取像素的比对看不出来（那张画布的上下文是干净的）。
       *
       * 顺带复位可能残留的裁剪与透明度：合成是"整块替换"，任何残留状态都不该影响它。
       */
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.drawImage(bitmap, 0, 0);
      ctx.restore();
    }
    if (bitmap && typeof bitmap.close === 'function') {
      bitmap.close();
    }
  }

  private __onEvent(evt: MirrorEvent): void {
    if (this.options.onEvent) {
      this.options.onEvent(evt);
    }
  }
}

function now(): number {
  return typeof performance !== 'undefined' && performance && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

/**
 * 「几何通道」上下文：**吞掉一切绘制调用**，但保留文本量测。
 *
 * 为什么需要它：主线程必须继续跑渲染管线（命中检测读渲染期的世界盒快照），但又不能真的光栅化
 * ——那正是要交给 worker 的部分。把落墨换成本桩之后，管线照跑（矩阵、路径、快照盒都算），
 * 绘制调用落到空处。
 *
 * 两处**不能**吞：
 * - `measureText`：文本盒高/宽度靠它（引擎的量测会读 `actualBoundingBox*`）；
 * - `create*Gradient`：渐变对象要能 `addColorStop`，否则样式应用阶段就抛。
 * 两者都委派给传入的真实上下文（可见画布的 ctx），语义与"真的画一遍"一致。
 */
export function createGeometryOnlyContext(realCtx: any): any {
  const noop = function () {};
  const ctx: any = {
    canvas: realCtx && realCtx.canvas,
    // 文本状态：引擎会读写这些属性
    font: (realCtx && realCtx.font) || '10px sans-serif',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    direction: 'inherit',
    letterSpacing: '0px',
    wordSpacing: '0px',
    fontKerning: 'auto',
    fontStretch: 'normal',
    fontVariantCaps: 'normal',
    textRendering: 'auto',
    // 样式状态：真实上下文里是访问器，这里就是普通字段（引擎只写不读像素）
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    miterLimit: 10,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    filter: 'none',
    lineDashOffset: 0,
    shadowBlur: 0,
    shadowColor: 'rgba(0,0,0,0)',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
  };
  /** 引擎实际用到的 canvas 方法（见下方守卫测试；`measureText` 在下面单独委派）。 */
  const methods = [
    'clearRect',
    'fillRect',
    'strokeRect',
    'beginPath',
    'closePath',
    'moveTo',
    'lineTo',
    'rect',
    'roundRect',
    'arc',
    'arcTo',
    'ellipse',
    'bezierCurveTo',
    'quadraticCurveTo',
    'fill',
    'stroke',
    'clip',
    'save',
    'restore',
    'setTransform',
    'resetTransform',
    'translate',
    'rotate',
    'scale',
    'drawImage',
    'setLineDash',
    'getLineDash',
    'putImageData',
    'createPattern',
    'createImageData',
    'isPointInPath',
    'isPointInStroke',
    // 文本绘制必须吞掉（主线程不再产出像素），但 measureText 例外 —— 它在下面单独委派
    'fillText',
    'strokeText',
  ];
  for (let i = 0; i < methods.length; i++) {
    ctx[methods[i]] = noop;
  }
  // 量测与渐变委派给真实上下文（见上面的说明）
  ctx.measureText = function (text: string) {
    if (realCtx && typeof realCtx.measureText === 'function') {
      // 量测前把文本状态同步过去：字体/字间距不同，量出来的结果就不同
      try {
        realCtx.font = ctx.font;
        if ('letterSpacing' in realCtx) realCtx.letterSpacing = ctx.letterSpacing;
        if ('direction' in realCtx) realCtx.direction = ctx.direction;
      } catch (err) {
        /* 只读环境：忽略，量测仍用真实上下文的当前状态 */
      }
      return realCtx.measureText(text);
    }
    return { width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 };
  };
  ctx.getTransform = function () {
    return realCtx && typeof realCtx.getTransform === 'function'
      ? realCtx.getTransform()
      : { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  };
  // 读像素在几何通道里没有意义，但不能让调用方拿到 undefined 再去取 .data（那是另一类崩溃）
  ctx.getImageData = function (x: number, y: number, w: number, h: number) {
    const width = Math.max(0, w | 0);
    const height = Math.max(0, h | 0);
    return { data: new Uint8ClampedArray(width * height * 4), width, height, colorSpace: 'srgb' };
  };
  const gradient = () => ({ addColorStop: noop });
  ctx.createLinearGradient = gradient;
  ctx.createRadialGradient = gradient;
  ctx.createConicGradient = gradient;
  return ctx;
}
