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
// 色 ramp 采用 Tailwind CSS 经典调色板（低饱和、协调、现代）
export const baseTokens = {
  color: {
    blue: {
      50: '#EFF6FF',
      100: '#DBEAFE',
      200: '#BFDBFE',
      300: '#93C5FD',
      400: '#60A5FA',
      500: '#3B82F6',
      600: '#2563EB',
      700: '#1D4ED8',
      800: '#1E40AF',
      900: '#1E3A8A',
    },
    emerald: {
      50: '#ECFDF5',
      100: '#D1FAE5',
      200: '#A7F3D0',
      300: '#6EE7B7',
      400: '#34D399',
      500: '#10B981',
      600: '#059669',
      700: '#047857',
      800: '#065F46',
      900: '#064E3B',
    },
    amber: {
      50: '#FFFBEB',
      100: '#FEF3C7',
      200: '#FDE68A',
      300: '#FCD34D',
      400: '#FBBF24',
      500: '#F59E0B',
      600: '#D97706',
      700: '#B45309',
      800: '#92400E',
      900: '#78350F',
    },
    red: {
      50: '#FEF2F2',
      100: '#FEE2E2',
      200: '#FECACA',
      300: '#FCA5A5',
      400: '#F87171',
      500: '#EF4444',
      600: '#DC2626',
      700: '#B91C1C',
      800: '#991B1B',
      900: '#7F1D1D',
    },
    gray: {
      50: '#F9FAFB',
      100: '#F3F4F6',
      200: '#E5E7EB',
      300: '#D1D5DB',
      400: '#9CA3AF',
      500: '#6B7280',
      600: '#4B5563',
      700: '#374151',
      800: '#1F2937',
      900: '#111827',
    },
    violet: {
      50: '#F5F3FF',
      100: '#EDE9FE',
      200: '#DDD6FE',
      300: '#C4B5FD',
      400: '#A78BFA',
      500: '#8B5CF6',
      600: '#7C3AED',
      700: '#6D28D9',
      800: '#5B21B6',
      900: '#4C1D95',
    },
    teal: {
      50: '#F0FDFA',
      100: '#CCFBF1',
      200: '#99F6E4',
      300: '#5EEAD4',
      400: '#2DD4BF',
      500: '#14B8A6',
      600: '#0D9488',
      700: '#0F766E',
      800: '#115E59',
      900: '#134E4A',
    },
    pink: {
      50: '#FDF2F8',
      100: '#FCE7F3',
      200: '#FBCFE8',
      300: '#F9A8D4',
      400: '#F472B6',
      500: '#EC4899',
      600: '#DB2777',
      700: '#BE185D',
      800: '#9D174D',
      900: '#831843',
    },
    indigo: {
      50: '#EEF2FF',
      100: '#E0E7FF',
      200: '#C7D2FE',
      300: '#A5B4FC',
      400: '#818CF8',
      500: '#6366F1',
      600: '#4F46E5',
      700: '#4338CA',
      800: '#3730A3',
      900: '#312E81',
    },
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
    // 语义色对齐 Ant Design 经典语义 + Tailwind 500 level（低饱和、现代）
    primary: c.blue[500],
    success: c.emerald[500],
    warning: c.amber[500],
    danger: c.red[500],
    info: c.blue[400],
    text: c.gray[800],
    muted: c.gray[500],
    hint: c.gray[400],
    border: c.gray[200],
    background: '#ffffff',
    // 数据系列配色（折线/柱状逐系列取色），用 Tailwind 500 level 8 色
    palette: [
      c.blue[500],
      c.emerald[500],
      c.amber[500],
      c.red[500],
      c.violet[500],
      c.teal[500],
      c.pink[500],
      c.indigo[500],
    ],
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
    success: baseTokens.color.emerald[400],
    warning: baseTokens.color.amber[400],
    danger: baseTokens.color.red[400],
    info: baseTokens.color.teal[400],
    text: baseTokens.color.gray[200],
    muted: baseTokens.color.gray[400],
    hint: baseTokens.color.gray[500],
    border: baseTokens.color.gray[700],
    background: baseTokens.color.gray[900],
    // palette 也用 400 level
    palette: [
      baseTokens.color.blue[400],
      baseTokens.color.emerald[400],
      baseTokens.color.amber[400],
      baseTokens.color.red[400],
      baseTokens.color.violet[400],
      baseTokens.color.teal[400],
      baseTokens.color.pink[400],
      baseTokens.color.indigo[400],
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
 * 解析主题但**不修改任何全局状态**：
 * - string：按名查注册表（如 'dark'）；未注册时回退 DEFAULT_THEME。
 * - object：浅合并到 `base` 的 semantic（兼容旧用法 `setTheme({ primary: ... })`）。
 *
 * 这是「实例级主题」的基础：`ICE` 用它把自己持有的主题解析出来，
 * 不污染模块级当前主题（模块级只作为**默认值**）。
 */
export function resolveTheme(nameOrTheme: string | Partial<ICESemanticTheme>, base: ICETheme = currentTheme): ICETheme {
  if (typeof nameOrTheme === 'string') {
    return themeRegistry[nameOrTheme] || DEFAULT_THEME;
  }
  return { base: base.base, semantic: { ...base.semantic, ...nameOrTheme } };
}

/**
 * 切换**模块级默认主题**（全局单例）。
 *
 * 注意：这是「本进程默认值」，会影响此后新建的 `ICE` 实例以及未显式设置主题的实例。
 * 需要多实例/多品牌各自独立时，请用 `ice.setTheme()`（实例级，互不影响）。
 */
export function setTheme(nameOrTheme: string | Partial<ICESemanticTheme>): ICETheme {
  currentTheme = resolveTheme(nameOrTheme, currentTheme);
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
  title: (t) => ({
    stroke: false,
    style: { fontSize: t.base.fontSize['2xl'], fontWeight: t.base.fontWeight.bold, fillStyle: t.semantic.text },
  }),
  subtitle: (t) => ({ stroke: false, style: { fontSize: t.base.fontSize.lg, fillStyle: t.semantic.muted } }),
  body: (t) => ({ stroke: false, style: { fontSize: t.base.fontSize.md, fillStyle: t.semantic.text } }),
  label: (t) => ({ stroke: false, style: { fontSize: t.base.fontSize.sm, fillStyle: t.semantic.hint } }),
};

export default { baseTokens, DEFAULT_THEME, DARK_THEME, registerTheme, setTheme, getTheme, STYLE_PRESETS };
