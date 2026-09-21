/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
export { default as AnimationManager } from './animation/AnimationManager';
export {
  validateAnimations,
  classifyAnimationValue,
  isInterpolatablePair,
  ICE_ANIMATION_DIAGNOSTIC_CODES,
} from './animation/validate-animations';
export {
  registerEasing,
  unregisterEasing,
  resolveEasing,
  easingNames,
  customEasingNames,
} from './animation/easing-registry';
export { default as AnimationTimeline } from './animation/AnimationTimeline';
export type { TimelineOptions } from './animation/AnimationTimeline';
export { EasingProgress } from './animation/Easing';
export {
  classifyValue as classifyAnimationValueKind,
  interpolateValue as interpolateAnimationValue,
  isInterpolatable as isAnimationValueInterpolatable,
  parseColor,
  parseNumberWithUnit,
} from './animation/interpolators';
export type {
  ICEAnimationDiagnostic,
  ICEAnimationDiagnosticCode,
  ValidateAnimationsOptions,
} from './animation/validate-animations';
export { default as ICEControlPanel } from './control-panel/ICEControlPanel';
export { default as ICEControlPanelManager } from './control-panel/ICEControlPanelManager';
export { default as AlignmentGuideManager } from './control-panel/AlignmentGuideManager';
export { default as LineControlPanel } from './control-panel/link-controls/LineControlPanel';
export { default as ResizeControl } from './control-panel/transform-controls/ResizeControl';
export { default as RotateControl } from './control-panel/transform-controls/RotateControl';
export { default as TransformControlPanel } from './control-panel/transform-controls/TransformControlPanel';
export { default as DOMEventDispatcher } from './event/DOMEventDispatcher';
export { default as DOMEventInterceptor } from './event/DOMEventInterceptor';
export { default as EventBus } from './event/EventBus';
export { default as ICEEventTarget } from './event/ICEEventTarget';
// 事件对象本身（应用要类型标注 / 自造事件并 dispatchEvent 时用得到）
export { default as ICEEvent } from './event/ICEEvent';
/**
 * 事件名 / 事件对象的类型（应用侧写 TS 时用得到）：
 * `ICEEventName`（引擎内置 + DOM 语义名）、`ICEEventOf<K>`（按名取事件类型）、
 * `ICEEventParamMap`（事件名 → `evt.param` 形状）、`ICEEventListenerOptions`（`on`/`addEventListener` 的选项）、
 * `ICEDOMEventName`、`ICEEventSource`（`evt.source`：canvas / window / engine）。见 docs/architecture/05-event-system.md。
 */
export type {
  ICEEventName,
  ICEEventOf,
  ICEEventParamMap,
  ICEEventListenerOptions,
  ICEDOMEventName,
  ICEEventSource,
} from './event/event-types';
export type { ICEEngineEventNameConst } from './consts/ICE_EVENT_NAME_CONSTS';
export { default as GeoLine } from './geometry/GeoLine';
export { default as GeoPoint } from './geometry/GeoPoint';
export { default as GeoUtil } from './geometry/GeoUtil';
export { default as ICEBoundingBox } from './geometry/ICEBoundingBox';
export { default as ICEGroup } from './graphic/container/ICEGroup';
export { default as ICEVirtualLayer } from './graphic/container/ICEVirtualLayer';
export type { VirtualChildSource, VirtualChildView } from './graphic/virtual/virtual-child-source';
export {
  childSourceOf,
  setChildSourceFor,
  visibleLocalRect,
  lastVirtualWindow,
  materializeVirtualChild,
  releaseVirtualChild,
  materializedIndexOf,
  materializedIndices,
  materializedChild,
  applyVirtualPatch,
  syncVirtualWindow,
  diagnoseVirtualSource,
  resolveVirtualHit,
  setVirtualHitPolicy,
  virtualHitPolicyOf,
  virtualHitIndexOf,
  registerVirtualSource,
  restoreVirtualSource,
  createSvgSink,
} from './graphic/virtual/virtual-child-source';
export type {
  VirtualHitPolicy,
  VirtualSvgSink,
  VirtualSourceFactory,
  VirtualWindowOptions,
  VirtualWindowResult,
} from './graphic/virtual/virtual-child-source';
export { default as ICEComponent } from './graphic/ICEComponent';
export { default as ICEDotPath } from './graphic/ICEDotPath';
export { default as ICEImage } from './graphic/ICEImage';
export { default as ICEPath } from './graphic/ICEPath';
export { default as ICEBezier } from './graphic/link/ICEBezier';
export { default as ICELinkHook } from './graphic/link/ICELinkHook';
export { default as ICELinkSlot } from './graphic/link/ICELinkSlot';
export { default as ICEPolyLine } from './graphic/link/ICEPolyLine';
export { default as ICEVisioLink } from './graphic/link/ICEVisioLink';
export { default as ICECircle } from './graphic/shape/ICECircle';
export { default as ICEEllipse } from './graphic/shape/ICEEllipse';
export { default as ICEIsogon } from './graphic/shape/ICEIsogon';
export { default as ICERect } from './graphic/shape/ICERect';
export { default as ICERose } from './graphic/shape/ICERose';
export { default as ICEStar } from './graphic/shape/ICEStar';
export { default as ICEText } from './graphic/text/ICEText';
export { default as ICELayoutManager } from './layout/ICELayoutManager';
export { default as ICEFlowLayout } from './layout/ICEFlowLayout';
export { default as ICEGridLayout } from './layout/ICEGridLayout';
export { default as ICEBorderLayout } from './layout/ICEBorderLayout';
export { default as ICEBoxLayout } from './layout/ICEBoxLayout';
export { default as ICECardLayout } from './layout/ICECardLayout';
export { default as ICEOverlayLayout } from './layout/ICEOverlayLayout';
export { default as ICELayeredLayout } from './layout/ICELayeredLayout';
export type {
  ICELayoutInsets,
  ICELayoutInsetsValue,
  ICELayoutConstraint,
  ICELayoutBox,
  ICEGridSpan,
} from './layout/ICELayoutManager';
export type { ICEBoxAlign } from './layout/ICEBoxLayout';
export type { ICEFlowCrossAlign } from './layout/ICEFlowLayout';
export { computeLayeredLayout } from './layout/layered-core';
export type { ICELayeredNode, ICELayeredEdge, ICELayeredCoreOptions, ICELayeredPosition } from './layout/layered-core';
export {
  /**
   * 主题工具包（`baseTokens` / `DEFAULT_THEME` / `registerTheme` / `token` … 的集合）。
   *
   * 以前它导出成 `ICETheme` —— 与**主题类型** `ICETheme`（`{ base, semantic }`）同名，
   * `import { ICETheme }` 拿到的是值还是类型全看运气。现在各归各位：值叫 `themeUtils`，
   * 类型从下面 `export type` 里拿。
   */
  default as themeUtils,
  baseTokens,
  BOOTSTRAP_BASELINE,
  FAMILY_PALETTE,
  FAMILY_PALETTE_DARK,
  DEFAULT_THEME,
  DARK_THEME,
  registerTheme,
  setTheme,
  getTheme,
  STYLE_PRESETS,
  listThemes,
  getRegisteredTheme,
  resolveTheme,
  mergeThemes,
  registerPreset,
  unregisterPreset,
  BUILTIN_PRESET_NAMES,
  BUILTIN_THEME_NAMES,
  token,
  palette,
  isTokenRef,
  resolveThemeValue,
  tokenValue,
  deepMerge,
  validateTheme,
  contrastRatio,
  deepDiff,
  deepEqual,
} from './theme/ICETheme';
/**
 * 主题的**类型**也导出：应用层要写 `setChrome(patch)` / `setTheme(patch)` / 自定义预设 /
 * 处理诊断，缺了这些类型就只能写 `any`（那等于没有契约）。
 */
export type {
  ICETheme,
  ICESemanticTheme,
  ICEChromeTheme,
  ICEThemeInput,
  ICEThemePatch,
  ICEThemeTokenRef,
  StylePresetFactory,
  ThemeDiagnostic,
} from './theme/ICETheme';
export { default as ICE } from './ICE';
export type { ICEThemeChangeInfo } from './ICE';
/**
 * 引擎自造的事件名（挂在 `ice.evtBus` 上）。应用层监听引擎事件时从这里取常量，别硬编码字符串 ——
 * 例如 `ice.evtBus.on(ICE_EVENT_NAME_CONSTS.THEME_CHANGE, fn)` 等价于 `ice.onThemeChange(fn)`
 * （后者更好用：自带订阅者隔离与退订函数）。
 */
export { default as ICE_EVENT_NAME_CONSTS } from './consts/ICE_EVENT_NAME_CONSTS';
export { default as CanvasRenderer } from './renderer/CanvasRenderer';
// SVG 导出：把同一份场景重新生成矢量描述（组件树 + 路径命令流），不依赖 canvas。
export { exportSvg, exportSvgResult } from './export/SvgExporter';
export type { SvgExportOptions, SvgExportResult } from './export/SvgExporter';
export { composeLayersToCanvas, composeLayersDataURL } from './export/compose-layers';
export type { ComposeLayersOptions } from './export/compose-layers';
export { default as PluginHost } from './plugin/PluginHost';
export type { ICEPlugin, ICEPluginTool, ICERenderHook, ICERenderFrame } from './plugin/PluginHost';
// 序列化机制随包导出：应用层需要在自己的（可能尚未 init 的）ICE 实例上复用同一套读写，
// 而不是再发明一份（ICE.init() 会把同样两个实例挂到 ice.serializer / ice.deserializer）。
export { default as Serializer, SERIALIZATION_VERSION } from './persistence/Serializer';
export { default as Deserializer, SERIALIZATION_MIGRATIONS } from './persistence/Deserializer';
// 文档时间戳归一化：下游包要在自己的快照格式里带 `createTime` 时复用它，
// 保证「历史格式 → ISO 8601 UTC」的规则只有一份（见 docs/architecture/06-serialization.md）。
export { toIsoTime } from './persistence/document-time';
// typeId 格式契约（`namespace:Type`）：下游包注册自己的图元类型时用它校验 / 拼装，
// 避免各处手写正则与字符串拼接（见 AGENTS.md「类型注册 / 序列化铁律」）。
export { TYPE_ID_PATTERN, isTypeId, assertTypeId, parseTypeId, makeTypeId } from './util/type-id';
// 稳定错误码：引擎不做 i18n，但把「可翻译的 id」交给应用层（见 docs/architecture/17-i18n-boundary.md）
export { ICE_ERROR_CODES, iceError, getICEErrorCode, isICEError } from './util/errors';
export type { ICEError, ICEErrorCode, ICEErrorDetails } from './util/errors';
/**
 * 同层叠放次序的**唯一口径**（2026-09-19 起默认 `zIndex = 'auto'`，即 CSS 的 `z-index: auto` 那一档，
 * 排序时当 `0` 用）：
 * 应用层要自己排/比同层次序时用这几个，不要各写一套 `x.state.zIndex || 0` ——
 * `'auto' - 1` 是 `NaN`，一个脏值就能让整层排序悄悄地不生效。见 docs/architecture/02-component-model.md。
 */
export { default as Z_INDEX_AUTO } from './consts/Z_INDEX_AUTO';
export { paintOrderChildrenOf, sortSiblingsByZIndex, zIndexOf, zIndexForPaintRank } from './util/data-util';
export { buildAccessibilityTree } from './a11y/accessibility';
export type { ICEAccessibleNode, ICEAccessibleRole, ICEAccessibilityOptions } from './a11y/accessibility';

/**
 * 帧控制器（全局单例）：`rAF` → `ICE_FRAME_EVENT` 的唯一入口。
 *
 * 导出它是为了 **worker 宿主**：worker 里没有 rAF，引擎走定时器兜底；宿主想按主线程的节拍驱动
 * （收到 `frame` 消息再渲染一帧）时，用 `FrameManager.wake()` 把空闲停掉循环叫醒即可 ——
 * 引擎默认「没有脏组件/活动动画就停帧」，所以不做任何事也不会空转。
 */
export { default as FrameManager } from './FrameManager';

/**
 * Worker 镜像渲染（阶段二 · 第一块：跨线程状态/命令协议）。
 *
 * 分工：**主线程持有组件树与状态**（唯一真相，命中检测也留在主线程），worker 持有一棵**镜像树** +
 * `CanvasRenderer` + `OffscreenCanvas`，只负责把当前状态画出来、把位图传回去。
 * 协议 v2：**状态与结构都走增量**（`state` / `add` / `remove` 三种 op），全量 `scene` 退化为
 * 兜底与自愈（见 `src/worker/mirror-protocol.ts` 的头注释）。
 */
export { default as MirrorBridge } from './worker/MirrorBridge';
export type { MirrorBridgeOptions, MirrorSend } from './worker/MirrorBridge';
export { default as MirrorTarget } from './worker/MirrorTarget';
export type { ApplyOpsResult, ApplySceneResult } from './worker/MirrorTarget';
export { default as MirrorHost, createGeometryOnlyContext } from './worker/MirrorHost';
export type { MirrorHostOptions, MirrorFallbackInfo } from './worker/MirrorHost';
export { detectMirrorSupport, describeMirrorSupport } from './worker/mirror-support';
export type { MirrorSupport, MirrorCapability } from './worker/mirror-support';
export {
  MIRROR_PROTOCOL_VERSION,
  isMirrorCommand,
  isMirrorEvent,
  isValidOp,
  sanitizeTransferable,
} from './worker/mirror-protocol';
export type { MirrorCommand, MirrorEvent, MirrorOp, MirrorStats } from './worker/mirror-protocol';
