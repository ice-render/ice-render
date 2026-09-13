/**
 * 表达力（⑤）的两块纯逻辑：
 * - **插值器**：数值 / 等长数组 / **颜色** / 带单位数字串；
 * - **缓动注册表**：内置名 + 应用层注册名 + 直接传函数。
 */
import {
  classifyValue,
  formatColor,
  interpolateValue,
  isInterpolatable,
  parseColor,
  parseNumberWithUnit,
} from '../../src/animation/interpolators';
import {
  customEasingNames,
  easingNames,
  registerEasing,
  resolveEasing,
  unregisterEasing,
} from '../../src/animation/easing-registry';
import { getICEErrorCode } from '../../src/util/errors';

describe('插值器：颜色', () => {
  it('解析各种颜色写法（#rgb / #rgba / #rrggbb / #rrggbbaa / rgb() / rgba()）', () => {
    expect(parseColor('#f00')).toEqual([255, 0, 0, 1]);
    expect(parseColor('#ff0000')).toEqual([255, 0, 0, 1]);
    expect(parseColor('#f00f')).toEqual([255, 0, 0, 1]);
    expect(parseColor('#ff000080')).toEqual([255, 0, 0, 128 / 255]);
    expect(parseColor('rgb(0, 128, 255)')).toEqual([0, 128, 255, 1]);
    expect(parseColor('rgba(0, 128, 255, 0.5)')).toEqual([0, 128, 255, 0.5]);
    expect(parseColor('not-a-color')).toBeNull();
    expect(parseColor('#12345')).toBeNull();
  });

  it('颜色插值：红→蓝 50% 得到中值；alpha 也插值', () => {
    expect(classifyValue('#ff0000')).toBe('color');
    expect(isInterpolatable('#ff0000', 'rgb(0, 0, 255)')).toBe(true);
    expect(interpolateValue('#ff0000', '#0000ff', 0.5)).toBe('rgb(128, 0, 128)');
    expect(interpolateValue('rgba(255,0,0,0)', 'rgba(0,0,255,1)', 0.5)).toBe('rgba(128, 0, 128, 0.5)');
  });

  it('终点精确：p=1 时给的是 to 的颜色（alpha=1 输出 rgb()）', () => {
    expect(interpolateValue('#123456', '#abcdef', 1)).toBe('rgb(171, 205, 239)');
    expect(formatColor([10.4, 20.5, 30.6, 1])).toBe('rgb(10, 21, 31)');
  });
});

describe('插值器：数值 / 数组 / 带单位数字串', () => {
  it('数值与等长数组照旧', () => {
    expect(interpolateValue(0, 100, 0.25)).toBe(25);
    expect(interpolateValue([0, 10], [10, 30], 0.5)).toEqual([5, 20]);
    expect(isInterpolatable([1, 1], [2, 2, 2])).toBe(false);
  });

  it('带单位数字串：同单位可插值，单位不一致则不可', () => {
    expect(parseNumberWithUnit('12px')).toEqual({ number: 12, unit: 'px' });
    expect(parseNumberWithUnit('1.5em')).toEqual({ number: 1.5, unit: 'em' });
    expect(classifyValue('12px')).toBe('length');
    expect(isInterpolatable('12px', '20px')).toBe(true);
    expect(isInterpolatable('12px', '2em')).toBe(false);
    expect(interpolateValue('10px', '20px', 0.5)).toBe('15px');
  });

  it('不可插值的取值（字符串/对象/NaN）分类为 null', () => {
    ['hello', {}, [], [1, 'a'], NaN, Infinity].forEach((value) => {
      expect(classifyValue(value)).toBeNull();
    });
  });
});

describe('缓动注册表', () => {
  afterEach(() => {
    customEasingNames().forEach((name) => unregisterEasing(name));
  });

  it('注册后能按名字解析；内置缓动仍在', () => {
    const fn = (t: number): number => t * t;
    registerEasing('brandEase', fn);
    expect(resolveEasing('brandEase')).toBe(fn);
    expect(easingNames()).toContain('brandEase');
    expect(easingNames()).toContain('linear');
    expect(resolveEasing('linear')).toBeTruthy();
  });

  it('直接传函数：原样返回（不进注册表，只对这条动画生效）', () => {
    const fn = (t: number): number => 1 - t;
    expect(resolveEasing(fn)).toBe(fn);
    expect(customEasingNames()).toEqual([]);
  });

  it('重名 / 覆盖内置 / 非法入参 → 抛稳定错误码', () => {
    const codeOf = (fn: () => void): string | null => {
      try {
        fn();
        return null;
      } catch (err) {
        return getICEErrorCode(err);
      }
    };
    registerEasing('brandEase', (t) => t);
    expect(codeOf(() => registerEasing('brandEase', (t) => t))).toBe('ICE_ANIM_EASING_NAME_CONFLICT');
    expect(codeOf(() => registerEasing('linear', (t) => t))).toBe('ICE_ANIM_EASING_NAME_CONFLICT'); // 内置不可覆盖
    expect(codeOf(() => registerEasing('', (t) => t))).toBe('ICE_ANIM_EASING_INVALID');
    expect(codeOf(() => registerEasing('bad', null as any))).toBe('ICE_ANIM_EASING_INVALID');
    // 非法注册不会污染注册表
    expect(customEasingNames()).toEqual(['brandEase']);
  });

  it('注销自定义缓动；内置不可注销', () => {
    registerEasing('temp', (t) => t);
    expect(unregisterEasing('temp')).toBe(true);
    expect(resolveEasing('temp')).toBeNull();
    expect(unregisterEasing('linear')).toBe(false);
  });
});
