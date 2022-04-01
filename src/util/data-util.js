/**
 * 按照指定的路径获取 Object 上的值
 * @param {*} object
 * @param {*} path
 * @returns
 */
export function getVal(object, path) {
  return path.split('.').reduce((res, prop) => res[prop], object);
}

/**
 * @method flattenTree
 *
 * 把 tree 形结构拉平成数组结构。
 *
 * @param result
 * @param childNodes
 * @param level
 * @param pid
 * @returns
 */
export function flattenTree(result = [], childNodes = [], level = 1, pid = null) {
  for (let i = 0; i < childNodes.length; i++) {
    const node = childNodes[i];
    node._level = level;
    node._pid = pid;
    result.push(node);
    flattenTree(result, node.childNodes || [], level + 1, node.id);
  }
  return result;
}
