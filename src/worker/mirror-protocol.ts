/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * 「主线程持有状态、worker 持有镜像」的跨线程协议（v2）。
 *
 * 分工（见 docs/architecture/10-worker-offscreen.md §3）：
 * - **主线程**：DOM 事件、命中检测（铁律不变）、组件树与状态（唯一真相）、图片/字体/文本量测；
 * - **worker**：一棵**镜像树** + `CanvasRenderer` + `OffscreenCanvas`，只负责"把当前状态画出来"。
 *
 * 三条设计纪律：
 *
 * 1. **状态是推过去的，不是拉回来的**。worker 从不回传组件状态 —— 它只回像素（ImageBitmap）与
 *    统计。这样"谁是真相"永远没有歧义，也不需要双向冲突解决。
 * 2. **状态与结构都走增量**（v2 起）。op 有三种：`['state', id, patch]`、
 *    `['add', parentId, 子树文档]`、`['remove', id]` —— "加/删一个图元"只发一条几 KB 的 op，
 *    不再重发整份文档（实测 IED 200 节点场景：**1037 B vs 485 924 B ≈ 470×**，且省掉 worker 侧
 *    一次 `clearAll()` + 整树重建 + 冷启动全量重绘，那一帧实测 130~161ms）。
 *    **全量 `scene` 退化为兜底与自愈**：拿不到可寻址的 id、子树编码失败、worker 报 `missing`
 *    （结构真的错位了）、或宿主显式要求（`resyncOnStructureChange: true`）时才发。
 *    v1 的边界因此作废 —— 那时的 op 只有状态补丁，结构一变只能整份重发。
 * 3. **能过的值必须能过，过不去的要报出来**。`postMessage` 遇到函数/DOM 节点/CanvasGradient
 *    这类值会抛 `DataCloneError`（整帧消息发不出去，症状是"画面卡住不动、控制台一条红"）。
 *    所以消息发出前一律过 `sanitizeTransferable()`：能结构化克隆的照发，克隆不了的值**就地丢弃
 *    并把路径记进 `dropped`**（不静默、也不炸）。v1 的取值域 = 序列化格式的取值域 + 结构化克隆
 *    的基础类型（数组/普通对象/数字/字符串/布尔/null/Date/RegExp/TypedArray/Map/Set）。
 */

/**
 * 协议版本。不匹配时接收方**明确拒绝**（而不是按老规矩猜），避免"字段语义悄悄变了"的静默错位。
 *
 * - v1（2026-09-20，ice-render 4.0.0）：只有状态补丁，**结构变更 = 重发整份文档**。
 * - v2（2026-09-20）：新增结构增量 op（`add` / `remove`）—— "加/删一个节点"不再重发整份文档。
 *   第三方自写的 v1 worker 遇到 v2 宿主会被版本校验拒绝，而宿主会**自动回退主线程渲染**
 *   （见 `MirrorHost` 的兼容保护），不会静默画错。
 */
export const MIRROR_PROTOCOL_VERSION = 2;

/** 根容器的地址：op 里的 `parentId` 用它表示"挂在 ICE 根下"。 */
export const MIRROR_ROOT_ID = '#root';

/**
 * 一条增量 op，按序应用。三种：
 *
 * | op | 形状 | 语义 |
 * |---|---|---|
 * | 状态补丁 | `['state', 组件 id, 补丁]` | 与 `setState` 的浅合并同语义 |
 * | 加子树 | `['add', 父 id（`'#root'` = ICE 根）, 子树文档]` | 挂在父容器**末尾**（与 `addChild` 同语义），子树文档由 `Serializer.encodeSubtree()` 产出 |
 * | 删子树 | `['remove', 组件 id]` | 按 id 摘除该组件及其后代 |
 *
 * 为什么 `add` 不需要 index：引擎的 `addChild()` 只有"追加"这一种语义（`this.childNodes.push`），
 * 绘制次序由 `zIndex` 决定、相等时按数组次序 —— 两边都追加，次序自然一致。
 */
export type MirrorOp = ['state', string, any] | ['add', string, any] | ['remove', string];

/**
 * 一条字体下发的记录（见 `fonts` 消息）。
 *
 * `source` 用**字节**而不是 URL：worker 里没有主线程的 `document.fonts` 与同源策略上下文，
 * 让宿主在主线程把字体取好、把字节推过来，worker 只负责注册 —— 与"图片/字体解码留在宿主侧"的
 * 分工一致（见 `docs/architecture/10-worker-offscreen.md` §2 的边界表）。
 */
export type MirrorFontSource = {
  family: string;
  /** 字体字节（`FontFace` 的 source 参数支持 ArrayBuffer） */
  source: ArrayBuffer | ArrayBufferView;
  style?: string;
  weight?: string;
  unicodeRange?: string;
};

/** 主线程 → worker。 */
export type MirrorCommand =
  /** 全量场景：`doc` 是 `ice.toJSONObject()` 的产物（已过 sanitize） */
  | { t: 'scene'; v: number; seq: number; doc: any; dropped?: string[] }
  /** 增量状态补丁：按序应用，`seq` 单调递增（用于对账/丢弃过期消息） */
  | { t: 'ops'; v: number; seq: number; ops: MirrorOp[]; dropped?: string[] }
  /**
   * 选择状态（`ids` 是选中组件的 id；空数组 = 取消选择）。
   *
   * worker 侧用**自己的**控制面板画手柄（工具层不序列化）—— 这条消息就是"选中了谁"。
   */
  | { t: 'selection'; v: number; seq: number; ids: string[] }
  /**
   * 渲染视口（缩放 / 平移）。
   *
   * 编辑器里缩放/平移是最常见的重型负载（视口一变，缓存整批失效、所有图元都要按新栅格重画）——
   * 镜像侧必须跟着走，否则"主线程看得见的画面"和"worker 画的"不是同一个视口。
   */
  | { t: 'viewport'; v: number; seq: number; scale: number; tx: number; ty: number }
  /**
   * **文本绘制语言**（`lang` / `dir`）：worker 里没有主画布元素可继承，
   * 不推过去的话同一个汉字会按运行时默认语言选字形，与主线程分叉（简/繁/日/韩）。
   */
  | { t: 'text'; v: number; seq: number; lang: string; dir: string }
  /**
   * **字体下发**：主线程把用到的字体**字节**推给 worker，worker 用自己的
   * `FontFace` + `self.fonts` 注册 —— 字体族一致，字形栅格化才谈得上与主线程一致。
   *
   * `source` 是 `ArrayBuffer`（宿主在主线程取好字节；URL/Blob 由宿主解析，避免 worker 侧
   * 再走一遍网络与 CORS）。结构化克隆会复制字节，发完之后宿主那边的 buffer 仍然可用。
   */
  | { t: 'fonts'; v: number; seq: number; fonts: MirrorFontSource[] }
  /**
   * **直绘模式**：主线程把可见画布整块 `transferControlToOffscreen()` 交给 worker，
   * worker 直接往它上面画 —— 省掉每帧"位图回传 + 主线程合成"这一跳（端到端少一次往返）。
   *
   * 代价（宿主必须知道）：这块画布主线程**再也拿不到**（读像素 / 截图要用页面级截图），
   * 且只在这条消息里传一次（`transfer` 列表），后续 `resize` 改的是 worker 侧它的尺寸。
   */
  | { t: 'attach-canvas'; v: number; seq: number; canvas: any }
  /**
   * 渲染节拍：`time` 用主线程的 `DOMHighResTimeStamp`（双时钟会漂，见 §5）。
   *
   * `seq` 与其它消息同源（单调递增），worker 在 `rendered` 里**原样回传**。宿主据此判断
   * "手上这张位图是哪一帧的"：位图是**背压**的（worker 渲染要几毫秒，而主线程可以每帧都发），
   * 在途位图可能有好几张 —— 只看"收到一张新位图"会把**上一步**的状态当成当前状态
   * （真实踩坑：静止态几何对账里读出"镜像落后一帧"，差点被当成状态分叉）。
   */
  | { t: 'frame'; v: number; seq: number; time: number; full?: boolean }
  /** 画布尺寸变化（设备像素） */
  | { t: 'resize'; v: number; width: number; height: number };

/** worker 的渲染统计。 */
export type MirrorStats = {
  /** 收到 frame 到渲染完成（含真实光栅化）的毫秒数 */
  renderMs: number;
  /** 本帧渲染的组件数（渲染队列长度） */
  components: number;
  /** 累计渲染帧数 */
  frames: number;
  /** 已应用的 op 条数（累计） */
  appliedOps: number;
  /** 已应用的选择状态条数（累计） */
  appliedSelections?: number;
  /** 已应用的视口变更条数（累计） */
  appliedViewports?: number;
};

/** worker → 主线程。 */
export type MirrorEvent =
  | { t: 'ready'; v: number; caps: { offscreen: boolean; path2d: boolean; pointerEvents: boolean } }
  | { t: 'rendered'; v: number; seq: number; stats: MirrorStats }
  /** 镜像里找不到这些 id → 结构已错位，主线程应当重发全量 `scene` */
  | { t: 'missing'; v: number; seq: number; ids: string[] }
  | { t: 'error'; v: number; message: string; code?: string };

/** 克隆不了的值：把路径记下来（`state.style.fillStyle` 这种），别让宿主对着"画面少了一块"猜。 */
export type DroppedValue = string;

const DROPPED_LIMIT = 20;

function recordDropped(dropped: DroppedValue[] | null, path: string): void {
  if (!dropped || dropped.length >= DROPPED_LIMIT) return;
  if (dropped.indexOf(path) === -1) dropped.push(path);
}

/** 能不能安全地交给结构化克隆（`postMessage` 的默认序列化算法）。 */
function isCloneableValue(value: any): boolean {
  if (value === null) return true;
  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean' || type === 'bigint') return true;
  if (value instanceof Date || value instanceof RegExp) return true;
  // TypedArray / DataView / ArrayBuffer：克隆语义明确，且引擎的 `dots` / 矩阵可能用到
  if (ArrayBuffer.isView(value)) return true;
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) return true;
  if (value instanceof Map || value instanceof Set) return true;
  return false;
}

/**
 * 把任意值转成"能过 `postMessage`"的副本。
 *
 * - 普通对象 / 数组：递归
 * - 克隆不了的值（函数、Symbol、DOM 节点、`CanvasGradient`、循环引用……）：**丢掉并记路径**
 * - `undefined` 的键：与 `JSON.stringify` 同口径，直接不出现在结果里（`setState` 也不会因此把
 *   旧值改成 undefined）
 *
 * @param value 待处理的值
 * @param dropped 收集被丢弃的路径（可为 null 表示不关心）
 * @param path 当前路径（报错用，如 `state.style.fillStyle`）
 * @param seen 循环引用检测
 */
export function sanitizeTransferable(
  value: any,
  dropped: DroppedValue[] | null = null,
  path = '',
  seen: WeakSet<object> = new WeakSet()
): any {
  if (value === undefined) return undefined;
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'function' || typeof value === 'symbol') {
      recordDropped(dropped, path);
      return undefined;
    }
    return value;
  }
  if (isCloneableValue(value)) {
    return value;
  }
  if (seen.has(value)) {
    recordDropped(dropped, path ? `${path} (循环引用)` : '(循环引用)');
    return undefined;
  }
  const proto = Object.getPrototypeOf(value);
  const isPlain = proto === Object.prototype || proto === null;
  if (!Array.isArray(value) && !isPlain) {
    // 宿主对象（HTMLElement / CanvasGradient / Image……）：结构化克隆会抛，直接丢
    recordDropped(
      dropped,
      path
        ? `${path} (${String((value.constructor && value.constructor.name) || '主机对象')})`
        : String((value.constructor && value.constructor.name) || '主机对象')
    );
    return undefined;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    const out = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const item = sanitizeTransferable(value[i], dropped, `${path}[${i}]`, seen);
      out[i] = item === undefined ? null : item; // 数组元素不能缺位（否则稀疏数组过克隆会变 null，行为不一致）
    }
    seen.delete(value);
    return out;
  }
  const out: any = {};
  for (const key in value) {
    if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
    const item = sanitizeTransferable(value[key], dropped, path ? `${path}.${key}` : key, seen);
    if (item !== undefined) out[key] = item;
  }
  seen.delete(value);
  return out;
}

/** 主线程 → worker 的消息校验（接收方先验版本，再验形状）。 */
export function isMirrorCommand(msg: any): boolean {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.v !== MIRROR_PROTOCOL_VERSION) return false;
  if (msg.t === 'scene') return !!msg.doc && typeof msg.doc === 'object';
  if (msg.t === 'ops') return Array.isArray(msg.ops);
  if (msg.t === 'selection') return Array.isArray(msg.ids);
  if (msg.t === 'viewport')
    return typeof msg.scale === 'number' && typeof msg.tx === 'number' && typeof msg.ty === 'number';
  // 文本语言：lang / dir 都是字符串（空串合法 —— 宿主没写就发空串，worker 侧不动默认值）
  if (msg.t === 'text') return typeof msg.lang === 'string' && typeof msg.dir === 'string';
  // 直绘：只需要一个"像画布"的对象（worker 侧会 getContext('2d') 校验）
  if (msg.t === 'attach-canvas') return !!msg.canvas && typeof msg.canvas.getContext === 'function';
  // 字体下发：数组 + 每条都要有 family 与字节 source
  if (msg.t === 'fonts') {
    if (!Array.isArray(msg.fonts)) return false;
    for (const font of msg.fonts) {
      if (!font || typeof font.family !== 'string' || !font.family) return false;
      const source = font.source;
      const isBuffer =
        (typeof ArrayBuffer === 'function' && source instanceof ArrayBuffer) ||
        (typeof ArrayBuffer === 'function' && ArrayBuffer.isView && ArrayBuffer.isView(source));
      if (!isBuffer) return false;
    }
    return true;
  }
  // `seq` 是宿主判断"手上这张位图是哪一帧"的依据（见 MirrorHost.renderedSeq），缺了它
  // 静止态/截图的对齐就只能靠猜 —— 所以它是必需字段，不是可选装饰。
  if (msg.t === 'frame') return typeof msg.seq === 'number' && typeof msg.time === 'number';
  if (msg.t === 'resize') return typeof msg.width === 'number' && typeof msg.height === 'number';
  return false;
}

/** worker → 主线程 的消息校验。 */
export function isMirrorEvent(msg: any): boolean {
  if (!msg || typeof msg !== 'object') return false;
  if (msg.v !== MIRROR_PROTOCOL_VERSION) return false;
  if (msg.t === 'ready') return !!msg.caps;
  if (msg.t === 'rendered') return typeof msg.seq === 'number' && !!msg.stats;
  if (msg.t === 'missing') return Array.isArray(msg.ids);
  if (msg.t === 'error') return typeof msg.message === 'string';
  return false;
}

/** op 的形状校验（worker 侧应用前过一遍，坏数据要报错而不是把镜像改坏）。 */
export function isValidOp(op: any): op is MirrorOp {
  if (!Array.isArray(op)) return false;
  const kind = op[0];
  // id / parentId 一律要求**非空字符串**（`'#root'` 也是非空字符串，天然通过）
  if (typeof op[1] !== 'string' || !op[1]) return false;
  if (kind === 'state') {
    return !!op[2] && typeof op[2] === 'object' && !Array.isArray(op[2]);
  }
  if (kind === 'add') {
    // 子树文档必须是对象（`{ type, state, childNodes }`）；类型字段缺失由 worker 侧跳过并上报
    return !!op[2] && typeof op[2] === 'object' && !Array.isArray(op[2]);
  }
  if (kind === 'remove') {
    return op.length >= 2;
  }
  return false;
}
