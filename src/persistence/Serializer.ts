/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE from '../ICE';

/**
 * 序列化时排除的运行时缓存/计算值：这些值在反序列化后会由引擎重新计算，
 * 序列化它们只会增大 JSON 体积、并在反序列化时污染 props。
 */
const NON_SERIALIZABLE_KEYS = ['linearMatrix', 'composedMatrix', 'localOrigin', 'absoluteOrigin', 'dots', 'textHeight'];

/**
 * 序列化格式版本号。数据结构发生变化时递增，并在 Deserializer 中做对应迁移。
 */
export const SERIALIZATION_VERSION = 1;

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
    const result = {
      version: SERIALIZATION_VERSION,
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
    const currentData = {
      state: this.pickSerializableState(component.state),
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

  /**
   * 只序列化用户数据，排除运行时缓存/计算值（linearMatrix/composedMatrix/localOrigin/
   * absoluteOrigin/dots/textHeight 等）。
   */
  private pickSerializableState(state) {
    const result = {};
    for (const key in state) {
      if (NON_SERIALIZABLE_KEYS.indexOf(key) !== -1) {
        continue;
      }
      result[key] = state[key];
    }
    return result;
  }
}
