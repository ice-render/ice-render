import { flattenTree, getVal } from './data-util';

describe('flattenTree', () => {
  it('展平单层节点并标注 _level/_pid', () => {
    const tree = [{ id: 'a', childNodes: [] }, { id: 'b', childNodes: [] }];
    const result = flattenTree([], tree);
    expect(result).toHaveLength(2);
    expect(result[0]._level).toBe(1);
    expect(result[0]._pid).toBeNull();
  });

  it('递归展平嵌套子节点并保留父子关系', () => {
    const tree = [
      { id: 'p', childNodes: [{ id: 'c', childNodes: [] }] },
    ];
    const result = flattenTree([], tree);
    expect(result.map((n) => n.id)).toEqual(['p', 'c']);
    expect(result[1]._level).toBe(2);
    expect(result[1]._pid).toBe('p');
  });
});

describe('getVal', () => {
  it('按点路径取值', () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getVal(obj, 'a.b.c')).toBe(42);
  });
  it('路径不存在时抛出', () => {
    const obj = { a: 1 };
    expect(() => getVal(obj, 'a.b.c')).toThrow();
  });
});
