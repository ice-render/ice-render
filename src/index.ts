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
export { default as GeoLine } from './geometry/GeoLine';
export { default as GeoPoint } from './geometry/GeoPoint';
export { default as GeoUtil } from './geometry/GeoUtil';
export { default as ICEBoundingBox } from './geometry/ICEBoundingBox';
export { default as ICEGroup } from './graphic/container/ICEGroup';
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
export {
  default as ICETheme,
  baseTokens,
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
  token,
  palette,
  isTokenRef,
  resolveThemeValue,
  tokenValue,
  deepMerge,
  validateTheme,
  contrastRatio,
} from './theme/ICETheme';
export { default as ICE } from './ICE';
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
export { buildAccessibilityTree } from './a11y/accessibility';
export type { ICEAccessibleNode, ICEAccessibleRole, ICEAccessibilityOptions } from './a11y/accessibility';
