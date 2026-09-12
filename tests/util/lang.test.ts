import { merge, cloneDeep, round, isNil, isString, isUndefined, isEmpty } from '../../src/util/lang';

describe('lang.merge 深合并（替代 lodash merge）', () => {
  it('递归合并嵌套对象，保留 target 未覆盖的键', () => {
    const target = { transform: { translate: [0, 0], scale: [1, 1], rotate: 0 }, left: 0 };
    const result = merge(target, { transform: { rotate: 90 }, left: 10 });
    expect(result.transform.rotate).toBe(90);
    expect(result.transform.scale).toEqual([1, 1]); // 未覆盖的键保留
    expect(result.transform.translate).toEqual([0, 0]);
    expect(result.left).toBe(10);
  });

  it('跳过 undefined 源值（对齐 lodash 语义）', () => {
    const target: any = { a: 1 };
    merge(target, { a: undefined, b: 2 });
    expect(target.a).toBe(1);
    expect(target.b).toBe(2);
  });

  it('数组整体覆盖（不做按索引递归合并）', () => {
    const target: any = { scale: [1, 1] };
    merge(target, { scale: [2, 2] });
    expect(target.scale).toEqual([2, 2]);
  });

  it('多源合并：merge(target, defaults, props)', () => {
    const result = merge({}, { style: { fill: 'red', stroke: 'blue' } }, { style: { stroke: 'green' }, width: 10 });
    expect((result as any).style.fill).toBe('red');
    expect((result as any).style.stroke).toBe('green');
    expect((result as any).width).toBe(10);
  });
});

describe('lang.cloneDeep 深拷贝（替代 lodash cloneDeep）', () => {
  it('嵌套对象/数组深隔离', () => {
    const src = { a: { b: [1, 2] }, c: 3 };
    const cloned = cloneDeep(src);
    expect(cloned).toEqual(src);
    expect(cloned).not.toBe(src);
    expect(cloned.a).not.toBe(src.a);
    expect(cloned.a.b).not.toBe(src.a.b);
  });

  it('原始类型直接返回', () => {
    expect(cloneDeep(1)).toBe(1);
    expect(cloneDeep('x')).toBe('x');
  });
});

describe('lang 基础工具', () => {
  it('round 精度（科学计数法规避浮点误差）', () => {
    expect(round(1.005, 2)).toBe(1.01);
    expect(round(3.14159, 3)).toBe(3.142);
    expect(round(4.5)).toBe(5);
  });

  it('isNil 命中 null 与 undefined', () => {
    expect(isNil(null)).toBe(true);
    expect(isNil(undefined)).toBe(true);
    expect(isNil(0)).toBe(false);
    expect(isNil('')).toBe(false);
  });

  it('isString / isUndefined / isEmpty', () => {
    expect(isString('a')).toBe(true);
    expect(isString(1)).toBe(false);
    expect(isUndefined(undefined)).toBe(true);
    expect(isUndefined(null)).toBe(false);
    expect(isEmpty([])).toBe(true);
    expect(isEmpty([1])).toBe(false);
    expect(isEmpty(undefined)).toBe(true);
  });

  it('类实例不被深合并/深拷贝（按引用覆盖）—— CanvasGradient 这类对象不能被剥成残壳', () => {
    class FakeGradient {
      public stops: any[] = [];
      addColorStop(offset: number, color: string) {
        this.stops.push([offset, color]);
      }
    }
    const gradient = new FakeGradient();
    gradient.addColorStop(0, '#f00');

    const target: any = { style: { fillStyle: '#000' } };
    merge(target, { style: { fillStyle: gradient } });

    // 旧实现（isPlainObject 只判「非数组对象」）会把它合并成 { addColorStop }——
    // 原型与身份全丢：画布上 fillStyle 赋值静默失效（沿用上一个组件的颜色），导出时变成 [object Object]。
    expect(target.style.fillStyle).toBe(gradient);
    expect(target.style.fillStyle).toBeInstanceOf(FakeGradient);

    // 普通对象/数组的老行为不变
    const nested: any = { transform: { rotate: 0 } };
    merge(nested, { transform: { scale: [2, 2] } });
    expect(nested.transform).toEqual({ rotate: 0, scale: [2, 2] });
  });
});
