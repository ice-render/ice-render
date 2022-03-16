/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEControlPanel from '../actions/ICEControlPanel';
import ICEBaseComponent from '../graphic/ICEBaseComponent';
import ICELinkHook from '../graphic/linkable/ICELinkHook';
import ICELinkSlot from '../graphic/linkable/ICELinkSlot';
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
   * @returns JSONObject
   */
  public toJSON(): string {
    let result = {
      createTime: new Date().toLocaleString(),
      lastModifyTime: new Date().toLocaleString(),
      childNodes: [],
    };
    this.ice.childNodes.forEach((child: ICEBaseComponent) => {
      if (
        child instanceof ICEControlPanel ||
        child.parentNode instanceof ICEControlPanel ||
        child instanceof ICELinkSlot ||
        child instanceof ICELinkHook
      ) {
        console.warn('控制手柄类型的组件不需要存储...', child);
        return;
      }
      this.encodeRecursively(child, result);
    });
    console.log(result);
    return JSON.stringify(result);
  }

  //递归序列化
  private encodeRecursively(component, parentData) {
    let currentData = {
      state: component.state,
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
