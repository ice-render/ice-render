/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import ICEPath from '../graphic/ICEPath';
import ICEText from '../graphic/text/ICEText';
import ICEImage from '../graphic/ICEImage';
import { SHADOW_PRESETS } from '../graphic/ICEComponent';

/**
 * @file SVG 导出
 *
 * 引擎的渲染是 canvas 光栅化的，但**几何描述一直都在**：`Path2DRecorder` 让每个路径组件都持有
 * 自己的命令流（见 cross-platform/Path2DRecorder.ts），于是同一份场景可以再输出一份矢量。
 *
 * 导出器刻意**镜像渲染器的口径**，而不是另起一套：
 * - 绘制顺序 = 渲染队列的顺序（`flattenTree` 后按 `state.zIndex` 稳定排序），工具层默认不导出；
 * - 每个组件的变换 = `composeMatrix()`（本地 → 世界），整体再套一层「世界 → 视图」矩阵，
 *   与 `applyTransformToCtx()` 的 `viewport · composed` 完全对应；
 * - 填充/描边 = `state.fill` / `state.stroke` + `props.style` 与 `state.style` 合并后的键
 *   （state 覆盖 props，与 `applyStyleToCtx()` 同序）；
 * - 透明度 = `getEffectiveOpacity()`（自身 × 祖先），与画布的 `globalAlpha` 同一口径；
 * - 裁剪 = 祖先链上所有 `clipChildren` 的世界包围盒，与 `__applyAncestorClips()` 一致。
 *
 * 已支持：任意 `ICEPath` 家族（矩形/圆角矩形/椭圆/自定义形状/折线/贝塞尔/组自身背景）、
 * 文本（多行、水平/垂直对齐、换行后的行）、图片（含圆形裁剪）、线性/径向渐变、虚线、
 * 视口或内容自适应尺寸、透明背景。
 *
 * 暂未支持（有意留白，都会在文档里写明）：
 * - 阴影（canvas 的 shadow* → SVG 需要 filter，且模糊半径语义不完全等价）；
 * - 雪碧图切图（`sx/sy/sw/sh`）与 `fillRule` 的奇偶填充差异；
 * - 蚂蚁线动画（导出的是**静态瞬间**，只保留当前 dash 相位）。
 *
 * 文本的**字形度量**在 canvas 与 SVG 之间不可能逐像素一致（字体回退、行高、基线定义不同），
 * 因此导出器用 `text-anchor` / `dominant-baseline` 表达对齐，而不是把测出来的宽度写死；
 * 左对齐（默认）与画布逐字对齐，居中/右对齐按锚点对齐、宽度由渲染方自己定。
 */

export type SvgExportOptions = {
  /** 导出范围：`content`（默认，按内容包围盒紧凑裁切）或 `viewport`（当前画布视口） */
  area?: 'content' | 'viewport';
  /** `area: 'content'` 时的四周留白，默认 0 */
  padding?: number;
  /** 缩放倍数，默认 1（内容模式下按世界尺寸 1:1） */
  scale?: number;
  /** 背景色；默认不铺背景（透明） */
  background?: string | null;
  /** 是否把工具层（控制面板、对齐辅助线）也导出，默认 false */
  includeTools?: boolean;
  /** 坐标保留小数位，默认 2（避免 `d` 属性里出现一长串浮点噪声） */
  precision?: number;
};

export type SvgExportResult = {
  svg: string;
  width: number;
  height: number;
};

/** 合并 props.style 与 state.style（同 applyStyleToCtx：state 覆盖 props），零分配失败即返回空对象 */
function mergedStyle(component: any): Record<string, any> {
  const propsStyle = component.props && component.props.style;
  const stateStyle = component.state && component.state.style;
  if (!propsStyle && !stateStyle) {
    return {};
  }
  return { fillStyle: undefined, ...propsStyle, ...stateStyle };
}

/** 颜色转 SVG 取值：`undefined` 当透明处理 */
function paint(value: any): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value);
}

function escapeXml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** canvas 的 textBaseline → SVG 的 dominant-baseline（两套基线定义不同，只能近似对齐） */
const BASELINE_MAP: Record<string, string> = {
  top: 'text-before-edge',
  hanging: 'hanging',
  middle: 'central',
  alphabetic: 'alphabetic',
  ideographic: 'ideographic',
  bottom: 'text-after-edge',
};

/**
 * 路径命令 → SVG `d`。
 *
 * `arc` 用 SVG 的弧线命令表达：canvas 的 `arc(x,y,r,a0,a1,ccw)` 等价于从起点画一段椭圆弧，
 * 大弧标志 = 角度差 > π，方向标志 = ccw。
 */
const TAU = Math.PI * 2;

/**
 * 把「起始角 → 终止角」换算成**带方向的**角度差（弧度），并尊重 canvas 的 counterclockwise 语义。
 *
 * 不能直接算 `a1 - a0`：圆角矩形的最后一个角常常跨过 ±π（例如 a0 = π、a1 = −π/2），
 * 朴素相减得到 −3π/2，SVG 会按「大弧」去画 → 那个角鼓出一个半圆。
 * 归一化到方向最短的那一段后，大弧标志与方向标志才都正确。
 * 起止角相等时按整圆处理（canvas 的 arc(a0, a0) 就是画一整圈）。
 */
function directionalDelta(a0: number, a1: number, counterclockwise: boolean): number {
  let delta = a1 - a0;
  if (counterclockwise) {
    while (delta > 1e-12) {
      delta -= TAU;
    }
    while (delta < -TAU) {
      delta += TAU;
    }
    if (Math.abs(delta) < 1e-12) {
      delta = -TAU;
    }
  } else {
    while (delta < -1e-12) {
      delta += TAU;
    }
    while (delta > TAU) {
      delta -= TAU;
    }
    if (Math.abs(delta) < 1e-12) {
      delta = TAU;
    }
  }
  return delta;
}

function commandsToPathData(commands: Array<Array<any>>, closed: boolean, digits: number): string {
  const n = (value: number): string => {
    const rounded = Number(value.toFixed(digits));
    return String(rounded);
  };
  const parts: string[] = [];
  let hasCurrent = false;

  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    const name = cmd[0];
    if (name === 'moveTo') {
      // 连续 moveTo：第一条是 M，其余是 L（canvas 语义与 SVG 一致）
      parts.push(`${hasCurrent ? 'L' : 'M'}${n(cmd[1])},${n(cmd[2])}`);
      hasCurrent = true;
    } else if (name === 'lineTo') {
      parts.push(`L${n(cmd[1])},${n(cmd[2])}`);
      hasCurrent = true;
    } else if (name === 'bezierCurveTo') {
      parts.push(`C${n(cmd[1])},${n(cmd[2])} ${n(cmd[3])},${n(cmd[4])} ${n(cmd[5])},${n(cmd[6])}`);
      hasCurrent = true;
    } else if (name === 'quadraticCurveTo') {
      parts.push(`Q${n(cmd[1])},${n(cmd[2])} ${n(cmd[3])},${n(cmd[4])}`);
      hasCurrent = true;
    } else if (name === 'rect') {
      // 独立子路径：关闭上一个点后直接画矩形
      parts.push(`M${n(cmd[1])},${n(cmd[2])}h${n(cmd[3])}v${n(cmd[4])}h${n(-cmd[3])}z`);
      hasCurrent = false;
    } else if (name === 'arc') {
      const [x, y, r, a0, a1, ccw] = cmd.slice(1);
      const x0 = x + r * Math.cos(a0);
      const y0 = y + r * Math.sin(a0);
      const x1 = x + r * Math.cos(a1);
      const y1 = y + r * Math.sin(a1);
      const delta = directionalDelta(a0, a1, !!ccw);
      const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
      // SVG 的 sweep=1 表示「角度增加方向」（y 轴向下的屏幕坐标里就是顺时针），
      // 与 canvas 的 counterclockwise 取反。
      const sweep = delta > 0 ? 1 : 0;
      if (!hasCurrent) {
        parts.push(`M${n(x0)},${n(y0)}`);
      }
      // 整圆（角度差 ≥ 2π）时终点与起点重合，SVG 的弧线会退化 → 拆成两段半圆
      if (Math.abs(delta) >= TAU - 1e-6) {
        const mx = x + r * Math.cos(a0 + Math.PI);
        const my = y + r * Math.sin(a0 + Math.PI);
        parts.push(`A${n(r)},${n(r)} 0 0 ${sweep} ${n(mx)},${n(my)}`);
        parts.push(`A${n(r)},${n(r)} 0 0 ${sweep} ${n(x0)},${n(y0)}`);
      } else {
        parts.push(`A${n(r)},${n(r)} 0 ${largeArc} ${sweep} ${n(x1)},${n(y1)}`);
      }
      hasCurrent = true;
    } else if (name === 'arcTo') {
      // arcTo 依赖「当前点 + 控制点」的切线关系，SVG 没有对应命令：
      // 圆角矩形等场景由 ICERect 用 arc 之外的写法兜底，这里退化为直线，保证不崩、不跑形
      const [x1, y1] = cmd.slice(1);
      parts.push(`L${n(x1)},${n(y1)}`);
      hasCurrent = true;
    } else if (name === 'ellipse') {
      // 标准椭圆（引擎只在 ICEEllipse 里用整圆/整椭圆）：用 SVG ellipse 语义等价的两段弧表达
      const [cx, cy, rx, ry, rotation, a0, a1, ccw] = cmd.slice(1);
      const x0 = cx + rx * Math.cos(a0) * Math.cos(rotation) - ry * Math.sin(a0) * Math.sin(rotation);
      const y0 = cy + rx * Math.cos(a0) * Math.sin(rotation) + ry * Math.sin(a0) * Math.cos(rotation);
      const x1 = cx + rx * Math.cos(a1) * Math.cos(rotation) - ry * Math.sin(a1) * Math.sin(rotation);
      const y1 = cy + rx * Math.cos(a1) * Math.sin(rotation) + ry * Math.sin(a1) * Math.cos(rotation);
      const delta = directionalDelta(a0, a1, !!ccw);
      const largeArc = Math.abs(delta) > Math.PI ? 1 : 0;
      const sweep = delta > 0 ? 1 : 0;
      if (!hasCurrent) {
        parts.push(`M${n(x0)},${n(y0)}`);
      }
      if (Math.abs(delta) >= TAU - 1e-6) {
        const mx =
          cx + rx * Math.cos(a0 + Math.PI) * Math.cos(rotation) - ry * Math.sin(a0 + Math.PI) * Math.sin(rotation);
        const my =
          cy + rx * Math.cos(a0 + Math.PI) * Math.sin(rotation) + ry * Math.sin(a0 + Math.PI) * Math.cos(rotation);
        parts.push(`A${n(rx)},${n(ry)} 0 0 ${sweep} ${n(mx)},${n(my)}`);
        parts.push(`A${n(rx)},${n(ry)} 0 0 ${sweep} ${n(x0)},${n(y0)}`);
      } else {
        parts.push(`A${n(rx)},${n(ry)} 0 ${largeArc} ${sweep} ${n(x1)},${n(y1)}`);
      }
      hasCurrent = true;
    }
  }
  if (closed && !/z\s*$/i.test(parts.join(' '))) {
    parts.push('Z');
  }
  return parts.join(' ');
}

/** 渐变描述 → `<defs>` 里的渐变定义；返回引用 id 或 null（不支持时回退纯色） */
function gradientDef(id: string, kind: 'linear' | 'radial', desc: any): string {
  const stops: Array<[number, string]> = [];
  const raw = desc && desc.stops;
  if (Array.isArray(raw)) {
    raw.forEach((stop: any) => {
      if (Array.isArray(stop)) {
        stops.push([Number(stop[0]) || 0, String(stop[1])]);
      }
    });
  }
  if (!stops.length) {
    return '';
  }
  const stopTags = stops
    .map(([offset, color]) => `<stop offset="${escapeXml(String(offset))}" stop-color="${escapeXml(color)}"/>`)
    .join('');
  if (kind === 'linear') {
    const from = Array.isArray(desc.from) ? desc.from : [0, 0];
    const to = Array.isArray(desc.to) ? desc.to : [0, 1];
    return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}">${stopTags}</linearGradient>`;
  }
  const center = Array.isArray(desc.center) ? desc.center : [0, 0];
  const radius = Number(desc.radius) || 0.5;
  return `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${center[0]}" cy="${center[1]}" r="${radius}">${stopTags}</radialGradient>`;
}

function matrixAttr(m: number[], digits: number): string {
  const n = (value: number): string => String(Number((value || 0).toFixed(digits)));
  return `matrix(${n(m[0])} ${n(m[1])} ${n(m[2])} ${n(m[3])} ${n(m[4])} ${n(m[5])})`;
}

/**
 * 阴影（`style.shadow` 预设或显式 `shadow*` 键）→ SVG filter。
 *
 * 用 `feDropShadow` 表达：`stdDeviation` 取 canvas `shadowBlur` 的一半（两者对模糊半径的定义
 * 不同，这是业界通用的近似）；`rgba()` 拆成 `flood-color` + `flood-opacity`，兼容性最好。
 * 返回 `{ def, url }`：def 进 `<defs>`，url 供元素挂 `filter`。
 */
function shadowFilter(id: string, style: Record<string, any>): any {
  let shadow: any = null;
  if (typeof style.shadow === 'string' && (SHADOW_PRESETS as any)[style.shadow]) {
    shadow = (SHADOW_PRESETS as any)[style.shadow];
  } else {
    const blur = Number(style.shadowBlur) || 0;
    const dx = Number(style.shadowOffsetX) || 0;
    const dy = Number(style.shadowOffsetY) || 0;
    if (blur || dx || dy) {
      shadow = {
        shadowColor: style.shadowColor || 'rgba(0,0,0,0.35)',
        shadowBlur: blur,
        shadowOffsetX: dx,
        shadowOffsetY: dy,
      };
    }
  }
  if (!shadow) {
    return null;
  }
  const color = String(shadow.shadowColor || 'rgba(0,0,0,0.35)');
  const rgba = color.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i);
  const stopColor = rgba ? `rgb(${Number(rgba[1])}, ${Number(rgba[2])}, ${Number(rgba[3])})` : color;
  const stopOpacity = rgba && rgba[4] !== undefined ? Number(rgba[4]) : 1;
  const blur = Number(shadow.shadowBlur) || 0;
  const def = `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${Number(
    shadow.shadowOffsetX || 0
  )}" dy="${Number(shadow.shadowOffsetY || 0)}" stdDeviation="${Number((blur / 2).toFixed(2))}" flood-color="${escapeXml(
    stopColor
  )}" flood-opacity="${stopOpacity}"/></filter>`;
  return { def, url: `url(#${id})` };
}

/**
 * 字体属性：优先用 style 里的粒度键（ICEText 会同时维护 `fontSize`/`fontFamily`/`fontWeight`
 * 与 canvas 用的 `font` 简写），只有简写时才解析出家族/字号，避免把 `bold 32px Arial`
 * 塞进 SVG 的 font-family。
 */
function fontAttributes(style: Record<string, any>, digits: number): string[] {
  let family = style.fontFamily;
  let size = style.fontSize;
  let weight = style.fontWeight;
  let fontStyle = style.fontStyle;
  if (typeof style.font === 'string' && (!family || !size)) {
    const matched = style.font.match(
      /^(?:(italic|oblique)\s+)?(?:(bold|bolder|lighter|[0-9]{3})\s+)?([0-9.]+)px\s+(.+)$/
    );
    if (matched) {
      fontStyle = fontStyle || matched[1];
      weight = weight || matched[2];
      size = size || matched[3];
      family = family || matched[4];
    }
  }
  const attrs: string[] = [];
  if (family) {
    attrs.push(`font-family="${escapeXml(String(family))}"`);
  }
  if (size !== undefined && size !== null && size !== '') {
    attrs.push(`font-size="${Number(Number(size).toFixed(digits))}"`);
  }
  if (weight) {
    attrs.push(`font-weight="${escapeXml(String(weight))}"`);
  }
  if (fontStyle) {
    attrs.push(`font-style="${escapeXml(String(fontStyle))}"`);
  }
  return attrs;
}

/**
 * 导出场景为 SVG 字符串。
 *
 * @param target ICE 实例（导出整幅画布）或任意组件（导出它的子树）
 */
export function exportSvg(target: any, options: SvgExportOptions = {}): string {
  return exportSvgResult(target, options).svg;
}

export function exportSvgResult(target: any, options: SvgExportOptions = {}): SvgExportResult {
  const digits = typeof options.precision === 'number' ? options.precision : 2;
  const scale = Number(options.scale) > 0 ? Number(options.scale) : 1;
  const isIceRoot = !!(target && target.childNodes && target.getRenderViewport);
  const ice = isIceRoot ? target : target && target.ice;

  // ---- 1) 取出要导出的组件，顺序与渲染队列一致 ----
  const queue: any[] = [];
  const collect = (nodes: any[]): void => {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      queue.push(node);
      if (node.childNodes && node.childNodes.length) {
        collect(node.childNodes);
      }
    }
  };
  collect(isIceRoot ? target.childNodes : [target]);
  if (options.includeTools && ice && ice.toolNodes) {
    collect(ice.toolNodes);
  }
  queue.sort((a: any, b: any) => (a.state.zIndex || 0) - (b.state.zIndex || 0));

  // ---- 2) 计算「世界 → 视图」矩阵与画布尺寸 ----
  let worldToView: number[] = [1, 0, 0, 1, 0, 0];
  let viewWidth = 0;
  let viewHeight = 0;
  if (options.area === 'viewport' && isIceRoot) {
    const vp = ice.getRenderViewport();
    const canvasWidth = Number(ice.canvasWidth) || 0;
    const canvasHeight = Number(ice.canvasHeight) || 0;
    worldToView = [vp.scale, 0, 0, vp.scale, vp.tx, vp.ty];
    viewWidth = canvasWidth;
    viewHeight = canvasHeight;
  } else {
    // 内容自适应：把所有可见组件的绘制包围盒（含描边余量）并起来
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    queue.forEach((component) => {
      if (typeof component.isEffectivelyVisible === 'function' && !component.isEffectivelyVisible()) {
        return;
      }
      // 必须先刷新世界矩阵：`__paintWorldBox()` 用的是 state.composedMatrix 缓存，
      // 对**从未上过屏**的组件（Node 出图、刚构造完就导出）那是空/过期值，
      // 内容包围盒会算到 (0,0) 附近，导出结果整体偏移。
      if (typeof component.composeMatrix === 'function') {
        component.composeMatrix();
      }
      let box: number[] | null = null;
      if (typeof component.__paintWorldBox === 'function') {
        box = component.__paintWorldBox();
      } else if (typeof component.getMinBoundingBox === 'function') {
        const b = component.getMinBoundingBox(true);
        box = [b.tl[0], b.tl[1], b.br[0], b.br[1]];
      }
      if (!box || !isFinite(box[0]) || !isFinite(box[1]) || !isFinite(box[2]) || !isFinite(box[3])) {
        return;
      }
      minX = Math.min(minX, box[0]);
      minY = Math.min(minY, box[1]);
      maxX = Math.max(maxX, box[2]);
      maxY = Math.max(maxY, box[3]);
    });
    const padding = Number(options.padding) >= 0 ? Number(options.padding) : 0;
    if (!isFinite(minX)) {
      minX = 0;
      minY = 0;
      maxX = 1;
      maxY = 1;
    }
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    const contentWidth = Math.max(maxX - minX, 1);
    const contentHeight = Math.max(maxY - minY, 1);
    worldToView = [scale, 0, 0, scale, -minX * scale, -minY * scale];
    viewWidth = contentWidth * scale;
    viewHeight = contentHeight * scale;
  }

  // ---- 3) 逐组件生成 SVG 元素 ----
  const defs: string[] = [];
  const body: string[] = [];
  let defSeq = 0;

  queue.forEach((component) => {
    if (typeof component.isEffectivelyVisible === 'function' && !component.isEffectivelyVisible()) {
      return;
    }
    const state = component.state;
    const style = mergedStyle(component);
    const matrix = typeof component.composeMatrix === 'function' ? component.composeMatrix() : state.composedMatrix;
    const attrs: string[] = [];

    // 裁剪：祖先链上的 clipChildren（与 __applyAncestorClips 同口径，世界包围盒）
    const clips: any[] = [];
    let ancestor: any = component.parentNode;
    while (ancestor && ancestor.state) {
      if (ancestor.state.clipChildren && typeof ancestor.__paintWorldBox === 'function') {
        clips.push(ancestor.__paintWorldBox());
      }
      ancestor = ancestor.parentNode;
    }

    const groupAttr: string[] = [`transform="${matrixAttr(matrix, digits)}"`];
    if (clips.length) {
      const clipId = `ice-clip-${defSeq++}`;
      // 从外到内依次裁剪：把外层盒子作为主矩形，内层盒子叠加即可（与画布的多重 clip 等价）
      const inner = clips[clips.length - 1];
      defs.push(
        `<clipPath id="${clipId}"><rect x="${inner[0].toFixed(digits)}" y="${inner[1].toFixed(digits)}" width="${(
          inner[2] - inner[0]
        ).toFixed(digits)}" height="${(inner[3] - inner[1]).toFixed(digits)}"/></clipPath>`
      );
      groupAttr.push(`clip-path="url(#${clipId})"`);
    }
    const opacity = typeof component.getEffectiveOpacity === 'function' ? component.getEffectiveOpacity() : 1;
    if (opacity !== 1) {
      groupAttr.push(`opacity="${Number(opacity.toFixed(3))}"`);
    }
    // 阴影：canvas 的 shadow* 是「绘制时给形状加投影」，等价物是给元素挂 filter
    const shadow = shadowFilter(`ice-shadow-${defSeq}`, style);
    if (shadow) {
      defSeq++;
      defs.push(shadow.def);
      groupAttr.push(`filter="${shadow.url}"`);
    }
    attrs.push(...groupAttr);

    let element = '';

    if (component instanceof ICEPath) {
      // 没有渲染循环时（Node / 未上过屏的组件）路径命令还是空的，先补齐
      if (typeof component.ensurePathBuilt === 'function') {
        component.ensurePathBuilt();
      }
      const recorder = component.path2D;
      const commands: Array<Array<any>> = (recorder && recorder._commands) || [];
      const paintsFill = state.fill !== false && (!!style.fillStyle || !!style.fillGradient);
      const paintsStroke = state.stroke !== false && (!!style.strokeStyle || !!style.strokeGradient);
      if (commands.length && (paintsFill || paintsStroke)) {
        const d = commandsToPathData(commands, !!(recorder && recorder._closed) || state.closePath !== false, digits);
        const fill =
          state.fill !== false ? paint(style.fillStyle !== undefined ? style.fillStyle : state.fillStyle) : null;
        const stroke = state.stroke !== false ? paint(style.strokeStyle) : null;
        const pathAttrs: string[] = [];
        if (style.fillGradient && state.fill !== false) {
          const id = `ice-grad-${defSeq++}`;
          const def = gradientDef(id, style.fillGradient.type === 'radial' ? 'radial' : 'linear', style.fillGradient);
          if (def) {
            defs.push(def);
            pathAttrs.push(`fill="url(#${id})"`);
          } else if (fill) {
            pathAttrs.push(`fill="${escapeXml(fill)}"`);
          }
        } else {
          pathAttrs.push(`fill="${fill ? escapeXml(fill) : 'none'}"`);
        }
        if (style.strokeGradient && state.stroke !== false) {
          const id = `ice-grad-${defSeq++}`;
          const def = gradientDef(
            id,
            style.strokeGradient.type === 'radial' ? 'radial' : 'linear',
            style.strokeGradient
          );
          if (def) {
            defs.push(def);
            pathAttrs.push(`stroke="url(#${id})"`);
          }
        } else if (stroke) {
          pathAttrs.push(`stroke="${escapeXml(stroke)}"`);
        }
        if (style.lineWidth !== undefined) {
          pathAttrs.push(`stroke-width="${Number(style.lineWidth)}"`);
        }
        if (Array.isArray(state.lineDash) && state.lineDash.length) {
          pathAttrs.push(`stroke-dasharray="${state.lineDash.join(' ')}"`);
          if (state.lineDashOffset) {
            pathAttrs.push(`stroke-dashoffset="${Number(state.lineDashOffset)}"`);
          }
        }
        if (state.lineJoin) {
          pathAttrs.push(`stroke-linejoin="${state.lineJoin}"`);
        }
        if (state.lineCap) {
          pathAttrs.push(`stroke-linecap="${state.lineCap}"`);
        }
        element = `<path d="${d}" ${pathAttrs.join(' ')}/>`;
      }
    } else if (component instanceof ICEText) {
      const lines =
        typeof (component as any).getRenderLines === 'function' ? (component as any).getRenderLines() : null;
      if (lines && lines.length) {
        const fill = state.fill !== false ? paint(style.fillStyle) : null;
        const stroke = state.stroke ? paint(style.strokeStyle) : null;
        const textAttrs: string[] = fontAttributes(style, digits);
        textAttrs.push(`fill="${fill ? escapeXml(fill) : 'none'}"`);
        if (stroke) {
          textAttrs.push(`stroke="${escapeXml(stroke)}"`);
          textAttrs.push(`stroke-width="${Number(style.lineWidth) || 1}"`);
        }
        // 对齐用锚点表达，而不是把测出来的行宽写死：
        // canvas 里居中/右对齐依赖 measureText 的结果，SVG 用 text-anchor 让渲染方自己量。
        // 居中：画布把文字中心放在本地 x=0；右对齐：右边缘在 `localOrigin[0] - paddingRight`。
        let anchorX: number | null = null;
        if (style.textAlign === 'center') {
          textAttrs.push('text-anchor="middle"');
          anchorX = 0;
        } else if (style.textAlign === 'right' || style.textAlign === 'end') {
          textAttrs.push('text-anchor="end"');
          anchorX = state.localOrigin[0] - (Number(style.paddingRight) || 0);
        }
        const baseline = BASELINE_MAP[style.textBaseline || 'bottom'];
        if (baseline) {
          textAttrs.push(`dominant-baseline="${baseline}"`);
        }
        const tspans = lines
          .map((line: any) => {
            const x = anchorX === null ? line.x : anchorX;
            return `<tspan x="${Number(x.toFixed(digits))}" y="${Number(line.y.toFixed(digits))}">${escapeXml(
              line.text
            )}</tspan>`;
          })
          .join('');
        element = `<text ${textAttrs.join(' ')}>${tspans}</text>`;
      }
    } else if (component instanceof ICEImage && state.src && !(state.sw > 0 && state.sh > 0)) {
      const x = 0 - state.localOrigin[0];
      const y = 0 - state.localOrigin[1];
      const imageAttrs: string[] = [
        `x="${x}"`,
        `y="${y}"`,
        `width="${state.width}"`,
        `height="${state.height}"`,
        `href="${escapeXml(String(state.src))}"`,
      ];
      if ((state.clipType || 'none') === 'circle') {
        const clipId = `ice-clip-${defSeq++}`;
        const r = Math.min(state.width, state.height) / 2;
        defs.push(`<clipPath id="${clipId}"><circle cx="0" cy="0" r="${r}"/></clipPath>`);
        imageAttrs.push(`clip-path="url(#${clipId})"`);
      }
      element = `<image ${imageAttrs.join(' ')} preserveAspectRatio="none"/>`;
    }

    if (element) {
      body.push(`<g ${attrs.join(' ')}>${element}</g>`);
    }
  });

  const background = options.background
    ? `<rect x="0" y="0" width="${viewWidth}" height="${viewHeight}" fill="${escapeXml(options.background)}"/>`
    : '';
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${Number(
      viewWidth.toFixed(digits)
    )}" height="${Number(viewHeight.toFixed(digits))}" viewBox="0 0 ${Number(viewWidth.toFixed(digits))} ${Number(
      viewHeight.toFixed(digits)
    )}">`,
    defs.length ? `<defs>${defs.join('')}</defs>` : '',
    background,
    `<g transform="${matrixAttr(worldToView, digits)}">`,
    body.join(''),
    '</g>',
    '</svg>',
  ]
    .filter(Boolean)
    .join('');
  return { svg, width: viewWidth, height: viewHeight };
}
