/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE from '../ICE';
import { toIsoTime } from './document-time';

/**
 * 序列化时排除的运行时缓存/计算值：这些值在反序列化后会由引擎重新计算，
 * 序列化它们只会增大 JSON 体积、并在反序列化时污染 props。
 */
const NON_SERIALIZABLE_KEYS = [
  'linearMatrix',
  'composedMatrix',
  'localOrigin',
  'absoluteOrigin',
  'dots',
  'textHeight',
  'lines', // 换行结果是派生缓存，反序列化后由 measureText 重算
];

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

  /**
   * 本次序列化中遇到的、未注册的组件类型名（去重）。
   *
   * 未注册类型只能回退写出 `constructor.name`，而下游打包器会 mangle 类名——写出去的
   * 名字**下次不一定读得回来**。这里记录并告警，让应用层有机会提示用户先
   * `ice.registerType('your-namespace:Type', Type)`。
   */
  private _unregisteredTypes: string[] = [];

  public get unregisteredTypes(): string[] {
    return this._unregisteredTypes;
  }

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
    this._unregisteredTypes = [];
    // 时间戳用 **ISO 8601 UTC**（`2026-09-13T04:12:33.123Z`）：
    // - 与运行环境的语言/时区无关（旧实现用 `toLocaleString()`，同一份工程在 zh-CN 机器上写
    //   `2026/9/13 12:12:33`、在 en-US 机器上写 `9/13/2026, 12:12:33 PM`，同一份数据换个机器就不一样）；
    // - 定长、字典序即时间序，可直接排序/比对；
    // - 任何语言、任何工具（`new Date()`、dayjs、SQL、Python）都能直接解析，也是 JSON Schema 的 `date-time` 形态。
    // 不用 epoch 毫秒（`Date.now()`）：这里的字段是**给人看的导出元信息**，JSON 里可读性比省 10 个字节重要。
    // 语义：`createTime` = 这份文档首次创建的时刻（载入时从数据里读回来，见 ICE.documentMeta），
    //       `lastModifyTime` = 这一次写出的时刻。因此「打开 → 编辑 → 保存」只有一个字段在动。
    // 需要「同一次编辑导出结果逐字节相同」的场景（如编辑器的去重/签名），由消费方丢弃 `lastModifyTime`
    // 即可（`createTime` 跨保存稳定，不必丢）——ice-entity-designer 的 FlowDesigner 就是这么做的。
    const now = new Date().toISOString();
    // createTime = 「这份文档首次被创建的时刻」：
    // - 载入别人的数据时由 Deserializer 读回来（记在 ice.documentMeta 上）；
    // - 全新文档在**首次写出时定下并记住**，因此同一会话里反复序列化结果稳定（不是每次取 now）。
    // 只有 lastModifyTime 是"这一次写出"的时刻。
    let createTime = toIsoTime(this.ice && this.ice.documentMeta && this.ice.documentMeta.createTime);
    if (!createTime) {
      createTime = now;
      const meta: any = this.ice && this.ice.documentMeta;
      if (meta && typeof meta === 'object') {
        meta.createTime = createTime;
      }
    }
    const result: any = {
      version: SERIALIZATION_VERSION,
      createTime,
      lastModifyTime: now,
      childNodes: [],
    };
    // 主题进快照：文档存盘之后，「它是按哪个主题设计的」不能丢。
    // 组件里的颜色是各自 state 的副本，所以旧快照照样能回放外观；这里存的是
    // 「还原时该把实例主题设成什么」，让新加的图元、主题引用与外壳一起对上。
    // 形态：{ name, patch? } —— patch 是相对命名主题的真实差异（见 ICE.themeSnapshot）
    const themeSnapshot = this.ice && typeof this.ice.themeSnapshot === 'function' ? this.ice.themeSnapshot() : null;
    if (themeSnapshot) result.theme = themeSnapshot;

    for (let i = 0; i < this.ice.childNodes.length; i++) {
      const child = this.ice.childNodes[i];
      this.encodeRecursively(child, result);
    }
    return result;
  }

  //递归序列化  //递归序列化
  private encodeRecursively(component, parentData) {
    // 优先用注册表反查稳定 typeId（与类名解耦，压缩改名不破坏数据）；
    // 未注册的自定义类型回退到 constructor.name（保持既有约定），但会记录 + 告警：
    // 这类数据（尤其是被 mangle 过的类名）下次可能读不回来。
    const registeredTypeId = this.ice.getTypeId(component.constructor);
    const typeId = registeredTypeId || component.constructor.name;
    if (!registeredTypeId) {
      const fallbackName = String(typeId);
      if (this._unregisteredTypes.indexOf(fallbackName) === -1) {
        this._unregisteredTypes.push(fallbackName);
        console.warn(
          `[ICE] 序列化遇到未注册的类型：${fallbackName}，已回退写出类名（可能受打包改名影响）。` +
            `建议先 ice.registerType('your-namespace:Type', Type) 注册。`
        );
      }
    }
    const currentData = {
      state: this.pickSerializableState(component.state),
      type: typeId,
      childNodes: [],
    };

    parentData.childNodes.push(currentData);

    // 复合组件的内部子组件是派生的（构造函数会按 state 重建），不写入文档：
    // 否则反序列化时会「构造函数建一份 + Deserializer 再挂一份」导致重复。
    // 复合组件默认只写自己的 state（子节点是派生结果）；**同时又是容器**的组件
    // （流程图 / BPMN 节点与池）可以实现 getSerializableChildren() 返回真实子节点，
    // 否则泳道、泳道里的节点会在快照往返时整套丢失。
    const derived = typeof component.hasDerivedChildren === 'function' && component.hasDerivedChildren();
    const customChildren =
      typeof component.getSerializableChildren === 'function' ? component.getSerializableChildren() : null;
    const children = customChildren || (derived ? [] : component.childNodes);
    if (children && children.length) {
      for (let i = 0; i < children.length; i++) {
        this.encodeRecursively(children[i], currentData);
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
