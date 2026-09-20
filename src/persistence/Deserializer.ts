/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICE from '../ICE';
import { SERIALIZATION_VERSION } from './Serializer';
import { toIsoTime } from './document-time';
import { zIndexOf, zIndexForPaintRank } from '../util/data-util';
import { ICE_ERROR_CODES, iceError } from '../util/errors';

/**
 * 序列化格式迁移表：`to` 为目标版本，按升序执行。
 *
 * 需要变更数据格式时，把 SERIALIZATION_VERSION 加 1 并在此追加一条迁移：
 * `SERIALIZATION_MIGRATIONS.push({ to: 2, run: (json) => { ...改写 json 结构... } });`
 * 当前版本为 2（见下方 v1 → v2 的说明）。
 */
export const SERIALIZATION_MIGRATIONS: Array<{ to: number; run: (jsonObj: any) => void }> = [];

/**
 * v1 → v2：把旧文档里的 `zIndex` 按**每个兄弟组**归一化。
 *
 * 背景（2026-09-19）：`zIndex` 的默认值从"构造顺序计数器"改成 `'auto'` 哨兵。
 * v1 文档里的 `198/199/200` 这种数字本来只是"次序"（计数器产物与应用手写的钉子混在一起，
 * 无法区分）；到了 v2 语义下它们会被当成**应用自己钉的正数**，于是新组件（`'auto'` = 0）
 * 会画到它们下面 —— 也就是 v1 时代那个"新建的图元看不见"的症状换个入口回来了
 * （实测复现：旧文档 198/199/200 + 新建 → 新建的在最下面）。
 *
 * 迁移规则（**逐项保持绘制次序**，只换编码）：
 * - 对每个兄弟组，按 v1 口径（数字升序、平手按加入顺序）排好；
 * - 再按 v2 口径重新编号：`-(m-1) … 'auto'`（最上面那个落回 auto 层，默认值直接删字段）。
 * - **整组本来就全是 0 / 没写**（v1 下就是"纯加入顺序"）时不动它 —— 那种文档在 v2 下本来就正确。
 *
 * 代价（有意为之）：v1 文档里"钉在 9999 的浮层"迁移后落回 auto 层，不再有钉子效力。
 * v1 本来也没这个保证 —— 计数器涨过 9999 之后它同样会被新内容盖住。
 */
function migrateZIndexToV2(jsonObj: any): void {
  const walk = (nodes: any[]): void => {
    if (!nodes || !nodes.length) {
      return;
    }
    const count = nodes.length;
    let allAuto = true;
    for (let i = 0; i < count; i++) {
      if (zIndexOf(nodes[i]) !== 0) {
        allAuto = false;
        break;
      }
    }
    if (!allAuto) {
      // v1 口径的绘制次序：数字升序、平手按加入顺序（稳定排序）
      const ordered = nodes.slice().sort((a: any, b: any) => zIndexOf(a) - zIndexOf(b));
      for (let i = 0; i < count; i++) {
        const node: any = ordered[i];
        const state = node && node.state;
        if (!state) {
          continue;
        }
        const next = zIndexForPaintRank(i, count);
        if (next === 'auto') {
          delete state.zIndex; // 默认值不写进文档
        } else {
          state.zIndex = next;
        }
      }
    }
    for (let i = 0; i < count; i++) {
      walk(nodes[i] && nodes[i].childNodes);
    }
  };
  walk(jsonObj && jsonObj.childNodes);
}

SERIALIZATION_MIGRATIONS.push({ to: 2, run: migrateZIndexToV2 });

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
    // 迁移通过之后再记 createTime：版本不支持时 migrate 会抛错，此时不该改动实例上的文档元信息
    this.__rememberCreateTime(jsonObj);
    // 先恢复主题再建组件：preset 与「没写 style」的默认样式都是在构造时展开的
    this.__restoreTheme(jsonObj);

    const childNodes = (jsonObj && jsonObj.childNodes) || [];
    for (let i = 0; i < childNodes.length; i++) {
      this.decodeRecursively(this.ice, childNodes[i]);
    }
  }

  /**
   * 记住文档的「首次创建时间」，供之后 `Serializer` 沿用（见 `ICE.documentMeta`）。
   *
   * - 旧数据里的 `2022/1/1 00:00:00` 这类历史格式会被归一化成 ISO 8601 UTC；
   * - 数据里没有 / 解析不了 → 清掉，让下一次写出取当前时刻（避免沿用上一个文档的时间）。
   */
  private __rememberCreateTime(jsonObj: any): void {
    const ice: any = this.ice;
    if (!ice || typeof ice !== 'object') {
      return;
    }
    if (!ice.documentMeta || typeof ice.documentMeta !== 'object') {
      ice.documentMeta = {};
    }
    const createTime = toIsoTime(jsonObj && jsonObj.createTime);
    if (createTime) {
      ice.documentMeta.createTime = createTime;
    } else {
      delete ice.documentMeta.createTime;
    }
  }

  /**
   * 还原快照里的主题：`{ name }` 按名切换，`{ patch }` 深合并到当前主题。
   *
   * 旧快照没有 theme 字段 → 什么都不做（维持调用方当前的主题），与旧行为一致。
   */
  private __restoreTheme(jsonObj: any): void {
    const snapshot = jsonObj && jsonObj.theme;
    const ice: any = this.ice;
    if (!snapshot || typeof snapshot !== 'object' || !ice || typeof ice.setTheme !== 'function') return;
    // 顺序要紧：先切到命名主题，再叠补丁（补丁是"相对这个命名主题改的那几处"）
    if (snapshot.name) {
      ice.setTheme(snapshot.name);
    }
    if (snapshot.patch && typeof snapshot.patch === 'object') {
      ice.setTheme(snapshot.patch);
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
      throw iceError(
        ICE_ERROR_CODES.DESERIALIZE_VERSION_UNSUPPORTED,
        `不支持的反序列化版本：${version}（当前支持到 ${SERIALIZATION_VERSION}）`,
        { version, supported: SERIALIZATION_VERSION }
      );
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
   * 反序列化**单个子树文档**并挂到指定父节点上（容器组件，或 `ICE` 根本身）。
   *
   * 与整份文档走**同一套还原逻辑**（类型注册表、`getSerializableChildren()` 例外、布局还原都在内），
   * 编码侧对应 `Serializer.encodeSubtree()`；镜像的**结构增量 op** 就靠这对入口，
   * 不必为"加一个节点"重发整份文档（200 节点场景 473KB + worker 冷启动全量重绘）。
   *
   * @param parentNode 目标父组件（或 `ICE` 实例）
   * @param nodeData   `Serializer.encodeSubtree()` 的产物（`{ type, state, childNodes, layout }`）
   * @returns 挂上去的实例；类型未注册时返回 null（并记进 `unknownTypes`，与整份加载同一口径）
   */
  public decodeInto(parentNode: any, nodeData: any): any {
    if (!parentNode || !nodeData) {
      return null;
    }
    return this.decodeRecursively(parentNode, nodeData);
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
    this.__restoreLayout(instance, nodeData.layout);

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

  /**
   * 还原容器的布局策略（`layout: { type, props }`）。
   *
   * 在挂上子节点**之前**恢复：这样后面 `addChild` 就会按策略立刻排一次，
   * 读回来的版式与存盘时一致（子节点的坐标也在 state 里，即使布局类型缺失也不会散架）。
   * 类型未注册 → 与组件同口径：记入 `unknownTypes` + 告警，容器保持"无布局"。
   */
  private __restoreLayout(instance: any, layoutData: any): void {
    if (!layoutData || !layoutData.type || typeof instance.setLayout !== 'function') {
      return;
    }
    const LayoutCtor = this.ice.getType(layoutData.type);
    if (typeof LayoutCtor !== 'function') {
      if (this._unknownTypes.indexOf(layoutData.type) === -1) {
        this._unknownTypes.push(layoutData.type);
      }
      console.warn(`[ICE] 反序列化跳过未注册的布局类型：${layoutData.type}（请先 ice.registerType() 注册）`);
      return;
    }
    instance.setLayout(new LayoutCtor(layoutData.props || {}));
  }
}
