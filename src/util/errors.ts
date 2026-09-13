/**
 * 引擎错误的**稳定错误码**。
 *
 * 为什么需要：引擎不做 i18n（词条归应用层），但引擎抛出的错误/告警是**用户可见**的
 * （应用层常把它直接弹给用户）。如果只有一句中文 message，应用层要翻译就只能去匹配字符串 ——
 * 那是必然失效的做法（改一个字就崩）。所以引擎给出：
 *
 * - `code`：稳定标识（`ICE_*`，永不变更语义），应用层据此映射到自己的语言包；
 * - `message`：默认中文，仅作为「没有做映射时的兜底」，不是契约的一部分；
 * - `details`：结构化补充（typeId、插件名、版本号等），便于拼装提示。
 *
 * ```ts
 * import { getICEErrorCode, ICE_ERROR_CODES } from 'ice-render';
 *
 * try { ice.registerType('Badge', Badge); }
 * catch (err) {
 *   if (getICEErrorCode(err) === ICE_ERROR_CODES.TYPE_ID_INVALID) {
 *     toast(t('error.typeIdFormat'));   // 应用层自己的词条
 *   }
 * }
 * ```
 */

export const ICE_ERROR_CODES = {
  /** `typeId` 不符合 `namespace:Type` 格式。 */
  TYPE_ID_INVALID: 'ICE_TYPE_ID_INVALID',
  /** `registerType` 的第二个参数不是构造函数。 */
  TYPE_CTOR_INVALID: 'ICE_TYPE_CTOR_INVALID',
  /** 同一个 typeId 已经注册了**另一个**构造函数。 */
  TYPE_ID_CONFLICT: 'ICE_TYPE_ID_CONFLICT',
  /** 同一个构造函数已经注册了**另一个** typeId（反查会歧义）。 */
  TYPE_CTOR_CONFLICT: 'ICE_TYPE_CTOR_CONFLICT',
  /** `ICE.init()` 没有拿到可用的 canvas / ctx。 */
  INIT_TARGET_REQUIRED: 'ICE_INIT_TARGET_REQUIRED',
  /** 同一个 ICE 实例已经绑定到别的 canvas。 */
  INIT_ALREADY_BOUND: 'ICE_INIT_ALREADY_BOUND',
  /** `ICE.use(plugin)` 缺少插件名。 */
  PLUGIN_NAME_REQUIRED: 'ICE_PLUGIN_NAME_REQUIRED',
  /** 插件声明的组件类型注册失败（details.pluginName / details.cause）。 */
  PLUGIN_COMPONENT_REGISTER_FAILED: 'ICE_PLUGIN_COMPONENT_REGISTER_FAILED',
  /** 反序列化数据的 `version` 高于当前引擎支持的版本。 */
  DESERIALIZE_VERSION_UNSUPPORTED: 'ICE_DESERIALIZE_VERSION_UNSUPPORTED',
  /** 当前运行时没有可用的 `Image` 构造器。 */
  IMAGE_CONSTRUCTOR_MISSING: 'ICE_IMAGE_CONSTRUCTOR_MISSING',
  /** 当前运行时拿不到 2d 离屏上下文。 */
  OFFSCREEN_CONTEXT_UNSUPPORTED: 'ICE_OFFSCREEN_CONTEXT_UNSUPPORTED',
  /** 当前运行时没有可用的离屏 canvas。 */
  OFFSCREEN_CANVAS_UNSUPPORTED: 'ICE_OFFSCREEN_CANVAS_UNSUPPORTED',
  /** `registerEasing()` 的名字/函数非法。 */
  ANIM_EASING_INVALID: 'ICE_ANIM_EASING_INVALID',
  /** `registerEasing()` 的名字已被内置缓动占用，或重复注册。 */
  ANIM_EASING_NAME_CONFLICT: 'ICE_ANIM_EASING_NAME_CONFLICT',
} as const;

export type ICEErrorCode = (typeof ICE_ERROR_CODES)[keyof typeof ICE_ERROR_CODES];

export interface ICEErrorDetails {
  [key: string]: unknown;
}

export type ICEError = Error & { code: ICEErrorCode; details?: ICEErrorDetails };

/**
 * 构造带稳定错误码的 `Error`。
 *
 * @param code 稳定错误码（见 {@link ICE_ERROR_CODES}）
 * @param message 默认中文文案（兜底，不是契约）
 * @param details 结构化补充信息
 */
export function iceError(code: ICEErrorCode, message: string, details?: ICEErrorDetails): ICEError {
  const err = new Error(message) as ICEError;
  err.name = 'ICEError';
  err.code = code;
  if (details) {
    err.details = details;
  }
  return err;
}

/** 取错误的 `ICE_*` 错误码；不是引擎错误时返回 `undefined`。 */
export function getICEErrorCode(err: unknown): ICEErrorCode | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const code = (err as any).code;
  return typeof code === 'string' && code.indexOf('ICE_') === 0 ? (code as ICEErrorCode) : undefined;
}

/** 判断是否是指定错误码的引擎错误（不传 `code` 时只判断「是不是引擎错误」）。 */
export function isICEError(err: unknown, code?: ICEErrorCode): boolean {
  const got = getICEErrorCode(err);
  return code === undefined ? got !== undefined : got === code;
}
