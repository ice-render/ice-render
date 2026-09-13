/**
 * 缓动注册表：内置缓动 + **应用层自定义缓动**。
 *
 * 为什么要开放这一层（用户目标②「应用层有机会自定义动画」）：
 * 内置只有十几个 easing，产品想表达自己的手感（品牌回弹、机械式阶跃、物理曲线）时，
 * 最自然的方式是**给一个函数**，而不是"只能从枚举里挑"。
 *
 * 用法：
 * ```js
 * ICE.registerEasing('brandSpring', (t) => 1 - Math.pow(1 - t, 3) * Math.cos(t * 6));
 * new ICERect({ animations: { left: { from: 0, to: 100, duration: 400, easing: 'brandSpring' } } });
 * // 也可以直接传函数（只对这一条动画生效，不用注册）：
 * animations: { left: { from: 0, to: 100, duration: 400, easing: (t) => t * t } }
 * ```
 *
 * 注册的**不覆盖内置**（内置是引擎契约的一部分，被偷偷替换会让同一份文档在不同应用里表现不同）；
 * 重名注册会明确抛错（`ICE_ANIM_EASING_NAME_CONFLICT`）。
 */
import { EasingProgress } from './Easing';
import { ICE_ERROR_CODES, iceError } from '../util/errors';

/** 自定义缓动表：名字 → 归一化进度函数（`t: [0,1]`，可短暂 >1 表示过冲）。 */
const customEasings: Record<string, EasingProgress> = {};

/**
 * 注册一个自定义缓动。
 *
 * @param name 缓动名（非空字符串；不能与**内置**缓动重名，也不能重复注册同一个名字）
 * @param fn   归一化进度函数 `(t) => number`
 */
export function registerEasing(name: string, fn: EasingProgress): void {
  if (typeof name !== 'string' || !name.trim()) {
    throw iceError(ICE_ERROR_CODES.ANIM_EASING_INVALID, 'registerEasing 需要非空字符串名字');
  }
  if (typeof fn !== 'function') {
    throw iceError(ICE_ERROR_CODES.ANIM_EASING_INVALID, `registerEasing('${name}') 需要传入函数 (t) => number`);
  }
  if (EasingProgress[name] || customEasings[name]) {
    throw iceError(ICE_ERROR_CODES.ANIM_EASING_NAME_CONFLICT, `缓动名「${name}」已被占用（内置缓动不可覆盖）`);
  }
  customEasings[name] = fn;
}

/** 注销自定义缓动（内置缓动不可注销）；返回是否真的移除了。 */
export function unregisterEasing(name: string): boolean {
  if (!customEasings[name]) {
    return false;
  }
  delete customEasings[name];
  return true;
}

/**
 * 解析缓动：**函数**原样返回（临时自定义）、字符串查内置 → 自定义；没有就返回 null
 * （调用方决定是回退 linear 还是报错）。
 */
export function resolveEasing(nameOrFn: any): EasingProgress | null {
  if (typeof nameOrFn === 'function') {
    return nameOrFn as EasingProgress;
  }
  if (typeof nameOrFn !== 'string') {
    return null;
  }
  return EasingProgress[nameOrFn] || customEasings[nameOrFn] || null;
}

/** 当前可用的缓动名（内置 + 自定义），用于校验提示与文档。 */
export function easingNames(): string[] {
  return Object.keys(EasingProgress).concat(Object.keys(customEasings));
}

/** 只列出应用层注册的缓动名（调试 / 测试用）。 */
export function customEasingNames(): string[] {
  return Object.keys(customEasings);
}
