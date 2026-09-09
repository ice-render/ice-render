/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * 主题机制：三层 design token + 命名主题 + 优先级链。
 *
 * 分层（对齐设计 token 标准）：
 *   ① base（基础）—— 原始值：色 ramp / spacing / radius / fontSize / fontFamily / fontWeight。
 *   ② semantic（语义）—— 用途：primary / danger / text / border / palette / motion，引用 base。
 *   ③ component（组件）—— STYLE_PRESETS 预设，引用 semantic + base。
 *
 * 优先级链（对齐 ECharts）：用户 props > 组件 preset > 语义 theme > 基础 default。
 *
 * 命名主题：registerTheme(name, theme) 注册，setTheme('dark') 按名切换；内置 default + dark。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */

// ============ ① base tokens（原始值，无语义） ============
export const baseTokens = {
  color: {
    purple: { 50: '#EEEDFE', 100: '#CECBF6', 200: '#AFA9EC', 400: '#7F77DD', 600: '#534AB7', 800: '#3C3489', 900: '#26215C' },
    teal: { 50: '#E1F5EE', 100: '#9FE1CB', 200: '#5DCAA5', 400: '#1D9E75', 600: '#0F6E56', 800: '#085041', 900: '#04342C' },
    coral: { 50: '#FAECE7', 100: '#F5C4B3', 200: '#F0997B', 400: '#D85A30', 600: '#993C1D', 800: '#712B13', 900: '#4A1B0C' },
    pink: { 50: '#FBEAF0', 100: '#F4C0D1', 200: '#ED93B1', 400: '#D4537E', 600: '#993556', 800: '#72243E', 900: '#4B1528' },
    gray: { 50: '#F1EFE8', 100: '#D3D1C7', 200: '#B4B2A9', 400: '#888780', 600: '#5F5E5A', 800: '#444441', 900: '#2C2C2A' },
    blue: { 50: '#E6F1FB', 100: '#B5D4F4', 200: '#85B7EB', 400: '#378ADD', 600: '#185FA5', 800: '#0C447C', 900: '#042C53' },
    green: { 50: '#EAF3DE', 100: '#C0DD97', 200: '#97C459', 400: '#639922', 600: '#3B6D11', 800: '#27500A', 900: '#173404' },
    amber: { 50: '#FAEEDA', 100: '#FAC775', 200: '#EF9F27', 400: '#BA7517', 600: '#854F0B', 800: '#633806', 900: '#412402' },
    red: { 50: '#FCEBEB', 100: '#F7C1C1', 200: '#F09595', 400: '#E24B4A', 600: '#A32D2D', 800: '#791F1F', 900: '#501313' },
  },
  spacing: { 1: 4, 2: 8, 3: 12, 4: 16, 6: 24, 8: 32, 12: 48, 16: 64 },
  radius: { sm: 4, md: 8, lg: 12, xl: 16, full: 9999 },
  fontSize: { sm: 12, md: 14, lg: 16, xl: 20, '2xl': 24, '3xl': 32, '4xl': 44 },
  fontFamily: { base: 'Arial' },
  fontWeight: { normal: 400, bold: 700 },
};

export interface ICESemanticTheme {
  primary: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  text: string;
  muted: string;
  hint: string;
  border: string;
  background: string;
  // 数据系列配色（折线/柱状等逐系列取色），对齐 ECharts 的 color palette
  palette: string[];
  // 动效 token（时长 / 缓动），供动画系统引用
  motion: {
    duration: { fast: number; normal: number; slow: number; slower: number };
    easing: { linear: string; out: string; inOut: string; outQuart: string };
  };
}

export interface ICETheme {
  base: typeof baseTokens;
  semantic: ICESemanticTheme;
}

// ============ ② semantic tokens（引用 base） ============
function buildSemantic(base: typeof baseTokens, overrides: Partial<ICESemanticTheme> = {}): ICESemanticTheme {
  const c = base.color;
  return {
    primary: c.blue[600],
    success: c.green[600],
    warning: c.amber[600],
    danger: c.red[600],
    info: c.blue[400],
    text: c.gray[800],
    muted: c.gray[600],
    hint: c.gray[400],
    border: c.gray[200],
    background: '#ffffff',
    palette: [c.blue[600], c.green[600], c.amber[600], c.red[600], c.purple[600], c.teal[600], c.pink[600], c.coral[600]],
    motion: {
      duration: { fast: 100, normal: 200, slow: 300, slower: 500 },
      easing: { linear: 'linear', out: 'easeOutCubic', inOut: 'easeInOutCubic', outQuart: 'easeOutQuart' },
    },
    ...overrides,
  };
}

// ============ 内置主题 ============
export const DEFAULT_THEME: ICETheme = {
  base: baseTokens,
  semantic: buildSemantic(baseTokens),
};

export const DARK_THEME: ICETheme = {
  base: baseTokens,
  semantic: buildSemantic(baseTokens, {
    // 彩色用 400 level（更亮，适配深色背景）
    primary: baseTokens.color.blue[400],
    success: baseTokens.color.green[400],
    warning: baseTokens.color.amber[400],
    danger: baseTokens.color.red[400],
    info: baseTokens.color.teal[400],
    text: '#e8e8e8',
    muted: '#a0a0a0',
    hint: '#6b6b6b',
    border: '#3a3a3a',
    background: '#1a1a1a',
    // palette 也用 400 level
    palette: [
      baseTokens.color.blue[400],
      baseTokens.color.green[400],
      baseTokens.color.amber[400],
      baseTokens.color.red[400],
      baseTokens.color.purple[400],
      baseTokens.color.teal[400],
      baseTokens.color.pink[400],
      baseTokens.color.coral[400],
    ],
  }),
};

// ============ 注册表 + 切换 ============
const themeRegistry: { [name: string]: ICETheme } = { default: DEFAULT_THEME, dark: DARK_THEME };
let currentTheme: ICETheme = DEFAULT_THEME;

/**
 * 注册命名主题（运行时注入，如多品牌 / 多租户）。
 */
export function registerTheme(name: string, theme: ICETheme): void {
  themeRegistry[name] = theme;
}

/**
 * 切换主题：
 * - string：按名切换到已注册的主题（如 'dark'）。
 * - object：浅合并到当前主题的 semantic（兼容旧用法 setTheme({ primary: ... })）。
 */
export function setTheme(nameOrTheme: string | Partial<ICESemanticTheme>): ICETheme {
  if (typeof nameOrTheme === 'string') {
    currentTheme = themeRegistry[nameOrTheme] || DEFAULT_THEME;
  } else {
    currentTheme = { base: currentTheme.base, semantic: { ...currentTheme.semantic, ...nameOrTheme } };
  }
  return currentTheme;
}

export function getTheme(): ICETheme {
  return currentTheme;
}

// ============ ③ component tokens（预设，引用 semantic + base） ============
export const STYLE_PRESETS: { [name: string]: (theme: ICETheme) => any } = {
  card: (t) => ({
    radius: t.base.radius.lg,
    style: { fillStyle: t.semantic.background, strokeStyle: t.semantic.border, lineWidth: 1, shadow: 'md' },
  }),
  panel: (t) => ({
    radius: t.base.radius.md,
    style: { fillStyle: t.semantic.background, strokeStyle: t.semantic.border, lineWidth: 1, shadow: 'sm' },
  }),
  button: (t) => ({
    radius: t.base.radius.md,
    style: { fillStyle: t.semantic.primary, strokeStyle: t.semantic.primary, lineWidth: 1, shadow: 'sm' },
  }),
  'button-danger': (t) => ({
    radius: t.base.radius.md,
    style: { fillStyle: t.semantic.danger, strokeStyle: t.semantic.danger, lineWidth: 1, shadow: 'sm' },
  }),
  title: (t) => ({ stroke: false, style: { fontSize: t.base.fontSize['2xl'], fontWeight: t.base.fontWeight.bold, fillStyle: t.semantic.text } }),
  subtitle: (t) => ({ stroke: false, style: { fontSize: t.base.fontSize.lg, fillStyle: t.semantic.muted } }),
  body: (t) => ({ stroke: false, style: { fontSize: t.base.fontSize.md, fillStyle: t.semantic.text } }),
  label: (t) => ({ stroke: false, style: { fontSize: t.base.fontSize.sm, fillStyle: t.semantic.hint } }),
};

export default { baseTokens, DEFAULT_THEME, DARK_THEME, registerTheme, setTheme, getTheme, STYLE_PRESETS };
