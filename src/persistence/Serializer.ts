/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE from '../ICE';

/**
 * @class Serializer
 *
 * 把图形序列化成 JSON 字符串。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class Serializer {
  private ice: ICE;

  constructor(ice) {
    this.ice = ice;
  }

  /**
   * 把对象序列化成 JSON 字符串：
   * - 容器型组件需要负责子节点的序列化操作
   * - 如果组件不需要序列化，需要返回 null
   * @returns Object
   */
  public toJSONString(): string {
    return JSON.stringify(this.toJSONObject());
  }

  /**
   * 把对象序列化成 JSON 对象：
   * - 容器型组件需要负责子节点的序列化操作
   * - 如果组件不需要序列化，需要返回 null
   * @returns Object
   */
  public toJSONObject(): object {
    let result = {
      createTime: new Date().toLocaleString(),
      lastModifyTime: new Date().toLocaleString(),
      childNodes: [],
    };

    for (let i = 0; i < this.ice.childNodes.length; i++) {
      const child = this.ice.childNodes[i];
      this.encodeRecursively(child, result);
    }
    return result;
  }

  //递归序列化
  private encodeRecursively(component, parentData) {
    let currentData = {
      state: component.state, //FIXME:只把 props 上的属性序列化，其它属性忽略。
      type: component.constructor.name,
      childNodes: [],
    };

    parentData.childNodes.push(currentData);

    if (component.childNodes && component.childNodes.length) {
      for (let i = 0; i < component.childNodes.length; i++) {
        this.encodeRecursively(component.childNodes[i], currentData);
      }
    }
  }
}
