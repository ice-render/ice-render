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
    // 注意：真实组件的 id 定义在 props 上（旧实现取 node.id 恒为 undefined，父子关系丢失）；
    // 同时兼容「普通对象 + 顶层 id」的调用方式（如单测夹具、外部把扁平数据当树用的场景）。
    const childPid = node.props && node.props.id !== undefined ? node.props.id : node.id;
    flattenTree(result, node.childNodes || [], level + 1, childPid);
  }
  return result;
}
