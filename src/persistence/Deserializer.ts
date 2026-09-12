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
 * 序列化格式迁移表：`to` 为目标版本，按升序执行。
 *
 * 需要变更数据格式时，把 SERIALIZATION_VERSION 加 1 并在此追加一条迁移：
 * `SERIALIZATION_MIGRATIONS.push({ to: 2, run: (json) => { ...改写 json 结构... } });`
 * 当前版本为 1，尚无迁移（仅保留机制与回归用例）。
 */
export const SERIALIZATION_MIGRATIONS: Array<{ to: number; run: (jsonObj: any) => void }> = [];

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

  /** 本次反序列化中遇到的、未注册的组件类型名（去重）。供应用层提示用户 registerType 后重载。 */
  private _unknownTypes: string[] = [];

  public get unknownTypes(): string[] {
    return this._unknownTypes;
  }

  public fromJSONObject(jsonObj) {
    this._unknownTypes = [];
    // 版本迁移入口：兼容缺失 version 的旧数据（视为版本 1）
    const version = jsonObj && jsonObj.version ? jsonObj.version : 1;
    this.migrate(jsonObj, version);

    const childNodes = (jsonObj && jsonObj.childNodes) || [];
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
    // 逐级升级：按 to 升序执行所有「目标版本 > 数据版本」的迁移。
    // 下游若 fork 了数据格式，可 push 自己的迁移到 SERIALIZATION_MIGRATIONS。
    for (let i = 0; i < SERIALIZATION_MIGRATIONS.length; i++) {
      const m = SERIALIZATION_MIGRATIONS[i];
      if (version < m.to) {
        m.run(jsonObj);
        version = m.to;
      }
    }
    jsonObj.version = version;
  }

  /**
   * 递归反序列化。
   *
   * 容错：遇到未注册的类型时**跳过该节点（含其子树）并记录**，而不是抛错终止整图加载
   * （旧实现直接 `new undefined(...)` 抛 TypeError，一个未知组件会导致整份数据打不开）。
   * 注意：生产构建会用 rollup-plugin-strip 去掉 console.*，因此告警也可能消失；
   * 应用层应以 `deserializer.unknownTypes` 为准做提示。
   *
   * @returns 创建出的实例；跳过时返回 null
   */
  private decodeRecursively(parentNode, nodeData) {
    if (!nodeData || !nodeData.type) {
      return null;
    }
    const Clazz = this.ice.getType(nodeData.type);
    if (typeof Clazz !== 'function') {
      if (this._unknownTypes.indexOf(nodeData.type) === -1) {
        this._unknownTypes.push(nodeData.type);
      }
      console.warn(`[ICE] 反序列化跳过未注册的组件类型：${nodeData.type}（请先 ice.registerType() 注册）`);
      return null;
    }

    const instance = new Clazz(nodeData.state);
    parentNode.addChild(instance);

    // 复合组件的子节点由构造函数按 state 重建；即使旧文档里带了 childNodes 也不能再挂一遍
    // （否则重复）。这类组件通过 hasDerivedChildren() 声明自己，见 ICEComponent 的注释。
    //
    // 例外：**同时又是容器**的复合组件（流程图 / BPMN 节点与池）实现了 getSerializableChildren()，
    // 文档里的 childNodes 是它的真实子节点（泳道 / 泳道里的节点），必须还原。
    const declaresChildren = typeof instance.getSerializableChildren === 'function';
    if (!declaresChildren && typeof instance.hasDerivedChildren === 'function' && instance.hasDerivedChildren()) {
      return instance;
    }

    const childNodes = nodeData.childNodes;
    if (childNodes && childNodes.length) {
      for (let i = 0; i < childNodes.length; i++) {
        this.decodeRecursively(instance, childNodes[i]);
      }
    }
    return instance;
  }
}
