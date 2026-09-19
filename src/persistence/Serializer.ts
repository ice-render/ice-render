/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE from '../ICE';
import { toIsoTime } from './document-time';
import ICELayoutManager from '../layout/ICELayoutManager';
import { zIndexOf } from '../util/data-util';

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

    this.__encodeChildren(this.ice.childNodes, result);
    return result;
  }

  /**
   * 序列化一批兄弟节点。
   *
   * `zIndex` 的写法（2026-09-19 起，与"默认值是 0 / auto 层"配套）：
   * - **默认值（0）不写**：读回时就是默认值，文档更干净，也不会出现一整片 `zIndex: 0`；
   * - **显式值原样写**（含 `bringToFront()` 之类重排 API 落下的负数）：次序信息本来就在这些数里，
   *   不归一化、不改写 —— 文档里"写的就是用户/API 表达的次序本身"。
   *
   * 为什么不再归一化成 `0..n-1`：归一化存在的理由是"默认 `zIndex` 是进程级计数器，
   * 会把构造顺序留下的大数字写进文档"。**计数器已经删掉**（默认 0），文档里不可能再出现
   * 那种天文数字；此时归一化反而会把应用刻意钉的浮层值（如 `zIndex: 9000`）改写成小整数，
   * 把"钉住"这件事丢掉。读回时子节点按文件顺序构造（= 加入次序），配合写下的数值，
   * 往返之后绘制次序逐项不变。
   */
  private __encodeChildren(children: any[], parentData: any): void {
    if (!children || !children.length) {
      return;
    }
    for (let i = 0; i < children.length; i++) {
      this.encodeRecursively(children[i], parentData);
    }
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
    const currentData: any = {
      state: this.pickSerializableState(component.state),
      type: typeId,
      childNodes: [],
      // 容器的布局策略属于文档内容（"怎么排"），见 __encodeLayout
      layout: undefined,
    };
    // zIndex 默认值（0 = auto 层）不进文档；显式值原样保留（口径见 __encodeChildren）
    if (zIndexOf(component) === 0) {
      delete currentData.state.zIndex;
    }
    this.__encodeLayout(component, currentData);

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
      this.__encodeChildren(children, currentData);
    }
  }

  /**
   * 写出容器的布局策略：`layout: { type, props }`。
   *
   * 布局是"怎么排"，和坐标一样属于文档内容 —— 不写出来的话「存盘再打开」版式就散了
   * （旧行为）。读回时由 `Deserializer` 按 `type` 反查构造函数、用 `props` 重建。
   *
   * **没注册的布局不写**（2026-09-15 起，原先是回退写类名）：回退写类名看着"能读回"，
   * 但下游打包改名之后那份数据就是废的（引擎 AGENTS 记过同类事故）。宁可当场少一个"活布局"
   * —— 子项的 `left/top` 照旧在快照里，读回来版式不变、只是不再自动重排 —— 也不要存一份
   * 到了下游才炸的数据。想保住布局，先 `ice.registerType('your-ns:MyLayout', MyLayout)`。
   */
  private __encodeLayout(component: any, nodeData: any): void {
    const manager = component && component.layoutManager;
    if (!manager) {
      nodeData.layout = undefined;
      return;
    }
    const registeredTypeId = this.ice.getTypeId(manager.constructor);
    const hasToJSON = typeof manager.toJSON === 'function';
    // 只调一次 toJSON()：它可能被第三方实现成有副作用的函数，调两次既不必要也不礼貌
    const props = hasToJSON ? manager.toJSON() : undefined;

    // ① 显式"不进文档"：`toJSON()` 返回 null 表示这个策略由组件在构造时重建（内部策略，
    //    参数已经活在组件的 state 里）。这类布局既不写、也不告警 —— 它不是"忘了实现"。
    if (props === null) {
      nodeData.layout = undefined;
      return;
    }

    // ② 未注册：**不写**（回退写类名会产出"下游打包改名后就废"的数据）
    if (!registeredTypeId) {
      const fallbackName = String((manager.constructor && manager.constructor.name) || 'UnknownLayout');
      if (this._unregisteredTypes.indexOf(fallbackName) === -1) {
        this._unregisteredTypes.push(fallbackName);
        console.warn(
          `[ICE] 序列化跳过未注册的布局类型：${fallbackName}（快照里只保留坐标，读回后不再自动排布）。` +
            `要保住布局请先 ice.registerType('your-namespace:MyLayout', MyLayout) 注册。`
        );
      }
      nodeData.layout = undefined;
      return;
    }

    // ③ 连 toJSON 都没有（JS 写的第三方布局）：不写 + 告警
    if (!hasToJSON) {
      if (this._unregisteredTypes.indexOf(registeredTypeId) === -1) {
        this._unregisteredTypes.push(registeredTypeId);
        console.warn(
          `[ICE] 布局 ${registeredTypeId} 没有实现 toJSON()，快照里只保留坐标（布局参数会丢）。` +
            `无参布局也请显式实现 toJSON() { return {}; }。`
        );
      }
      nodeData.layout = undefined;
      return;
    }

    // ④ 用的还是基类默认实现：无参布局这样写没问题，**有参布局的参数会静默丢掉**（不报错、版式却变了）
    if (manager.toJSON === ICELayoutManager.prototype.toJSON) {
      const key = `default-toJSON:${registeredTypeId}`;
      if (this._unregisteredTypes.indexOf(key) === -1) {
        this._unregisteredTypes.push(key);
        console.warn(
          `[ICE] 布局 ${registeredTypeId} 用的是基类默认 toJSON()：如果你有构造参数，它们不会进快照。` +
            `无参布局请显式实现 toJSON() { return {}; } 以表明"确实没有参数"。`
        );
      }
    }
    nodeData.layout = { type: registeredTypeId, props: props === undefined ? {} : props };
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
