/**
 * 文档时间戳工具。
 *
 * 序列化产物里的 `createTime` / `lastModifyTime` 统一是 **ISO 8601 UTC**
 * （`2026-09-13T04:12:33.123Z`）：与运行环境的语言/时区无关、定长、字典序即时间序、任何工具都能解析。
 *
 * 但读进来的数据可能是历史格式（例如 `2022/1/1 00:00:00`），所以这里统一做一次归一化：
 * 能解析成合法时间就转成 ISO，解析不了就当作"没有这个信息"（调用方回退到当前时刻）。
 */

/**
 * 把任意历史时间值归一化成 ISO 8601 UTC 字符串。
 *
 * @param value 待归一化的值（字符串 / 数字 / Date 都可以，其它类型一律视为无值）
 * @returns ISO 字符串；无法解析时返回 `undefined`
 */
export function toIsoTime(value: unknown): string | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
    return undefined;
  }
  // 数字按 **epoch 毫秒**解释（`Date.now()` / `getTime()` 的产物）；
  // 字符串交给 `Date.parse`（同时能吃 ISO 与 `2022/1/1 00:00:00` 这类历史格式）。
  const ms = value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value);
  if (!isFinite(ms)) {
    return undefined;
  }
  return new Date(ms).toISOString();
}
