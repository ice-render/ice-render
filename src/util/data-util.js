/**
 * 按照指定的路径获取 Object 上的值
 * @param {*} object
 * @param {*} path
 * @returns
 */
export function getVal(object, path) {
  return path.split('.').reduce((res, prop) => res[prop], object);
}
