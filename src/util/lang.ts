/**
 * 轻量工具集：替代 lodash 的 7 个函数（isNil/isString/isUndefined/isEmpty/round/merge/cloneDeep）。
 *
 * 引擎的 props/state 是纯 JSON 可序列化数据（plain object + array + 原始类型），
 * 因此这里的 cloneDeep/merge 只需针对 plain-object/array 递归，语义与 lodash 对齐：
 * - merge 递归合并嵌套对象、数组/原始类型直接覆盖、跳过 undefined 源值、原地修改 target。
 * - cloneDeep 深拷贝 plain object/array。
 */
export function isNil(value: any): boolean {
  return value == null; // 同时命中 null 与 undefined
}

export function isString(value: any): value is string {
  return typeof value === 'string';
}

export function isUndefined(value: any): value is undefined {
  return value === undefined;
}

export function isEmpty(value: any): boolean {
  if (value == null) return true;
  if (Array.isArray(value) || typeof value === 'string') return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return true;
}

/**
 * 四舍五入到指定小数位（与 lodash round 同款实现，用科学计数法规避浮点精度问题）。
 */
export function round(value: number, precision: number = 0): number {
  if (precision === 0) return Math.round(value);
  const [mantissa, expStr] = `${value}`.split('e');
  const exp = expStr ? parseInt(expStr, 10) : 0;
  const scaled = Math.round(Number(`${mantissa}e${exp + precision}`));
  const [m2, e2] = `${scaled}`.split('e');
  return Number(`${m2}e${(e2 ? parseInt(e2, 10) : 0) - precision}`);
}

function isPlainObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void ? I : never;

/**
 * 深合并（对齐 lodash merge）：递归合并嵌套对象；数组/原始类型/null 直接覆盖；
 * 跳过 undefined 源值；原地修改 target。支持多源：merge(target, ...sources)。
 * 返回类型为 target 与所有 source 的交集（与 lodash 一致）。
 */
export function merge<T, S extends any[]>(target: T, ...sources: S): T & UnionToIntersection<S[number]> {
  for (const source of sources) {
    if (source == null) continue;
    for (const k in source) {
      const sv = source[k];
      if (sv === undefined) continue;
      const tv = (target as any)[k];
      if (isPlainObject(sv) && isPlainObject(tv)) {
        // 写时复制：若嵌套对象来自原型链（共享默认值），先在 target 上复制一份再合并，
        // 避免污染所有组件共享的默认 style/transform 等对象。
        if (!Object.prototype.hasOwnProperty.call(target, k)) {
          (target as any)[k] = cloneDeep(tv);
        }
        merge((target as any)[k], sv);
      } else {
        (target as any)[k] = sv;
      }
    }
  }
  return target as any;
}

/**
 * 深拷贝 plain object/array（对齐 lodash cloneDeep 对纯 JSON 数据的行为）。
 */
export function cloneDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => cloneDeep(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: any = {};
    for (const k in value) {
      out[k] = cloneDeep((value as any)[k]);
    }
    return out;
  }
  return value;
}
