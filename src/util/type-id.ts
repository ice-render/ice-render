/**
 * 组件类型标识（typeId）的格式契约。
 *
 * 统一格式：`namespace:Type`
 *
 * - namespace：小写字母开头，只允许小写字母、数字、连字符。
 * - Type：字母或下划线开头，允许字母、数字、下划线、连字符。
 *
 * 例：`ice-render:Rect`、`ice-entity-designer:FlowNode`、
 * `ice-chart:PlotArea`、`my-company:Widget`。
 */
export const TYPE_ID_PATTERN = /^[a-z][a-z0-9-]*:[A-Za-z_][A-Za-z0-9_-]*$/;

export function isTypeId(value: unknown): value is string {
  return typeof value === 'string' && TYPE_ID_PATTERN.test(value);
}

export function assertTypeId(value: unknown, label: string = 'typeId'): asserts value is string {
  if (!isTypeId(value)) {
    throw new Error(
      `${label} 必须是 "namespace:Type" 格式（namespace 用小写字母/数字/连字符，Type 用字母/数字/下划线/连字符）：${String(
        value
      )}`
    );
  }
}

export function parseTypeId(typeId: string): { namespace: string; type: string } {
  assertTypeId(typeId);
  const index = typeId.indexOf(':');
  return {
    namespace: typeId.slice(0, index),
    type: typeId.slice(index + 1),
  };
}

export function makeTypeId(namespace: string, type: string): string {
  const typeId = `${namespace}:${type}`;
  assertTypeId(typeId);
  return typeId;
}
