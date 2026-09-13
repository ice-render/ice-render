/**
 * 文档时间戳归一化（`toIsoTime`）。
 *
 * 序列化产物里的时间统一是 ISO 8601 UTC；读进来时可能是历史格式或脏数据，
 * 这里负责"能解析就转 ISO、解析不了就当没有"。
 */
import { toIsoTime } from '../../src/persistence/document-time';

describe('toIsoTime', () => {
  it('ISO 字符串原样（归一化）返回', () => {
    expect(toIsoTime('2026-09-13T04:12:33.123Z')).toBe('2026-09-13T04:12:33.123Z');
  });

  it('历史格式（toLocaleString 产物）能被解析并转成 ISO', () => {
    const legacy = '2022/1/1 00:00:00';
    expect(toIsoTime(legacy)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(Date.parse(toIsoTime(legacy) as string)).toBe(Date.parse(legacy));
  });

  it('数字（epoch 毫秒）与 Date 都能转', () => {
    expect(toIsoTime(1757731953123)).toBe(new Date(1757731953123).toISOString());
    expect(toIsoTime(new Date('2026-09-13T04:12:33.123Z'))).toBe('2026-09-13T04:12:33.123Z');
  });

  it('空值 / 非法值 / 非时间类型一律返回 undefined', () => {
    expect(toIsoTime(undefined)).toBeUndefined();
    expect(toIsoTime(null)).toBeUndefined();
    expect(toIsoTime('')).toBeUndefined();
    expect(toIsoTime('随便写的')).toBeUndefined();
    expect(toIsoTime({})).toBeUndefined();
    expect(toIsoTime([])).toBeUndefined();
    expect(toIsoTime(NaN)).toBeUndefined();
  });
});
