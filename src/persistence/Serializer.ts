/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEBaseComponent from '../graphic/ICEBaseComponent';
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
   * 递归序列化
   * @param pdata
   * @param component
   */
  private serializeRecursively(pdata, component) {
    let currentData = { props: component.props, state: component.state, childNodes: [] };
    pdata.childNodes.push(currentData);
    if (component.childNodes && component.childNodes.length) {
      component.childNodes.forEach((child) => {
        this.serializeRecursively(currentData, child);
      });
    }
  }

  public toJSON(): string {
    let result = { time: new Date().toLocaleString(), childNodes: [] };
    this.ice.childNodes.forEach((child: ICEBaseComponent) => {
      //子组件的 root/ctx/evtBus/ice 这4个属性总是和父组件保持一致
      child.root = child.root;
      child.ctx = child.ctx;
      child.evtBus = child.evtBus;
      child.ice = child.ice;
      this.serializeRecursively(result, child);
    });

    console.log(result);

    return JSON.stringify(result);
  }
}
