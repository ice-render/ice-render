/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * 「主线程持有状态、worker 持有镜像」的跨线程协议（v1）。
 *
 * 分工（见 docs/architecture/10-worker-offscreen.md §3）：
 * - **主线程**：DOM 事件、命中检测（铁律不变）、组件树与状态（唯一真相）、图片/字体/文本量测；
 * - **worker**：一棵**镜像树** + `CanvasRenderer` + `OffscreenCanvas`，只负责"把当前状态画出来"。
 *
 * 三条设计纪律：
 *
 * 1. **状态是推过去的，不是拉回来的**。worker 从不回传组件状态 —— 它只回像素（ImageBitmap）与
 *    统计。这样"谁是真相"永远没有歧义，也不需要双向冲突解决。
 * 2. **增量只走 `state` 补丁，结构变更走全量重同步**。v1 的 op 只有 `['state', id, patch]`；
 *    增删子节点/换父容器这类**结构**变化会让镜像失效（id 树对不上），此时桥直接重发 `scene`
 *    （全量文档）—— 结构变更在真实场景里是低频操作，不值得为它先引入一套子树增量协议。
 *    这就是 v1 的诚实边界：**状态是增量的，结构是全量的**。
 * 3. **能过的值必须能过，过不去的要报出来**。`postMessage` 遇到函数/DOM 节点/CanvasGradient
 *    这类值会抛 `DataCloneError`（整帧消息发不出去，症状是"画面卡住不动、控制台一条红"）。
 *    所以消息发出前一律过 `sanitizeTransferable()`：能结构化克隆的照发，克隆不了的值**就地丢弃
 *    并把路径记进 `dropped`**（不静默、也不炸）。v1 的取值域 = 序列化格式的取值域 + 结构化克隆
 *    的基础类型（数组/普通对象/数字/字符串/布尔/null/Date/RegExp/TypedArray/Map/Set）。
 */

/** 协议版本。不匹配时接收方**明确拒绝**（而不是按老规矩猜），避免"字段语义悄悄变了"的静默错位。 */
export const MIRROR_PROTOCOL_VERSION = 1;

/** 状态补丁：`['state', 组件 id, 要合并进 state 的补丁]`（与 `setState` 的浅合并同语义）。 */
export type MirrorOp = ['state', string, any];

/** 主线程 → worker。 */
export type MirrorCommand =
  /** 全量场景：`doc` 是 `ice.toJSONObject()` 的产物（已过 sanitize） */
  | { t: 'scene'; v: number; seq: number; doc: any; dropped?: string[] }
  /** 增量状态补丁：按序应用，`seq` 单调递增（用于对账/丢弃过期消息） */
  | { t: 'ops'; v: number; seq: number; ops: MirrorOp[]; dropped?: string[] }
  /** 渲染节拍：`time` 用主线程的 `DOMHighResTimeStamp`（双时钟会漂，见 §5） */
  | { t: 'frame'; v: number; time: number; full?: boolean }
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
  if (msg.t === 'frame') return typeof msg.time === 'number';
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
  if (op[0] !== 'state') return false;
  if (typeof op[1] !== 'string' || !op[1]) return false;
  return !!op[2] && typeof op[2] === 'object' && !Array.isArray(op[2]);
}
