/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE from '../ICE';
import { SERIALIZATION_VERSION } from './Serializer';

/**
 * @class Deserializer
 *
 * 把 JSON 字符串反解析成图形。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class Deserializer {
  private ice: ICE;

  constructor(ice) {
    this.ice = ice;
  }

  public fromJSONObject(jsonObj) {
    // 版本迁移入口：兼容缺失 version 的旧数据（视为版本 1）
    const version = jsonObj.version || 1;
    this.migrate(jsonObj, version);

    const childNodes = jsonObj.childNodes;
    for (let i = 0; i < childNodes.length; i++) {
      this.decodeRecursively(this.ice, childNodes[i]);
    }
  }

  public fromJSONString(jsonStr: string) {
    const jsonObj = JSON.parse(jsonStr);
    this.fromJSONObject(jsonObj);
  }

  /**
   * 版本迁移钩子：当序列化格式版本变化时，在此处按版本逐级升级数据结构。
   * 当前版本为 {@link SERIALIZATION_VERSION}，低于该版本的旧数据在此迁移。
   */
  private migrate(jsonObj, version) {
    if (version > SERIALIZATION_VERSION) {
      throw new Error(`不支持的反序列化版本：${version}（当前支持到 ${SERIALIZATION_VERSION}）`);
    }
    // 未来版本升级示例：
    // if (version < 2) { /* 迁移旧字段 */ jsonObj.version = 2; }
  }

  //递归
  private decodeRecursively(parentNode, nodeData) {
    const Clazz = this.ice.getType(nodeData.type);
    const state = nodeData.state;
    const instance = new Clazz(state);
    parentNode.addChild(instance);

    const childNodes = nodeData.childNodes;
    if (childNodes && childNodes.length) {
      for (let i = 0; i < childNodes.length; i++) {
        this.decodeRecursively(instance, childNodes[i]);
      }
    }
  }
}
