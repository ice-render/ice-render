/**
 * 按照指定的路径获取 Object 上的值
 */
export function getVal(object: any, path: string): any {
  return path.split('.').reduce((res: any, prop: string) => res[prop], object);
}

/**
 * @method flattenTree
 *
 * 把 tree 形结构拉平成数组结构。
 */
export function flattenTree(result: any[] = [], childNodes: any[] = [], level: number = 1, pid: any = null): any[] {
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    node._level = level;
    node._pid = pid;
    result.push(node);
    flattenTree(result, node.childNodes || [], level + 1, node.id);
  }
  return result;
}
