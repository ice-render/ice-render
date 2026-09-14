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
 * 优先级链（与主流一致）：用户 props > 组件 preset > 语义 theme > 基础 default。
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
  // 数据系列配色（折线/柱状等逐系列取色），与主流的 color palette 一致
  palette: string[];
  /**
   * 交互外壳（引擎自己画的那层）：选中框 / 变换手柄 / 连线端点 / 连接插槽 / 对齐引导线 /
   * 连线标签 / 文本选区 / 阴影 / 调试包围盒。
   *
   * 为什么单独一组：这一层以前**写死在源码里**（十几处色值），于是深色主题下会出现
   * 「面板是暗的、手柄是亮红亮绿」这类不协调。收进主题之后，应用层只改主题就能把外壳一起换掉；
   * 需要按实例细调的，还可以用 `ice.setChrome({...})` 覆盖。
   */
  chrome: ICEChromeTheme;
  // 动效 token（时长 / 缓动），供动画系统引用
  motion: {
    duration: { fast: number; normal: number; slow: number; slower: number };
    easing: {
      linear: string;
      out: string;
      inOut: string;
      outQuart: string;
      // 弹簧类（自带过冲）：语义名 → EasingProgress 方法名
      spring: string;
      springSoft: string;
      springSnappy: string;
    };
  };
}

/**
 * 交互外壳的语义 token。
 *
 * 默认值 = 引擎历史行为（保证升级后观感不变）；深色主题给出一套协调的替代值，
 * 应用层也可以在主题里整体替换。
 */
export interface ICEChromeTheme {
  /** 选中框（ICEControlPanelManager 画的组件包围框）。 */
  selection: { stroke: string; fill: string; lineWidth: number; lineDash: number[] };
  /** 变换手柄（四角 / 四边 + 旋转手柄）。 */
  handle: { fill: string; stroke: string; activeFill: string; lineWidth: number };
  /** 连线端点手柄（拖拽改接的那两个点）。 */
  linkHook: { fill: string; stroke: string; lineWidth: number };
  /** 连接插槽：常态 / 悬停命中 / 目标高亮。 */
  slot: { fill: string; stroke: string; hoverFill: string; lineWidth: number };
  /** 对齐引导线。 */
  guide: { color: string; lineWidth: number };
  /** 连线上的标签（底色 + 字色）。 */
  linkLabel: { background: string; fill: string };
  /** 文本编辑态的选区底色。 */
  textSelection: { color: string };
  /**
   * 阴影颜色（sm / md / lg）。
   *
   * 只放**颜色**：模糊半径与偏移量由引擎的 `SHADOW_PRESETS` 拥有 ——
   * 脏矩形外扩量是按那几个数字算的（见 renderer/dirty-rect-util），主题改几何会让局部重绘切边。
   */
  shadow: { sm: string; md: string; lg: string };
  /** 调试包围盒：最小盒 / 最大盒。 */
  debug: { minBox: string; maxBox: string };
  /** 没显式给 `lineBorderColor` 时的蚂蚁线管壁色。 */
  lineBorder: string;
}

export interface ICETheme {
  base: typeof baseTokens;
  semantic: ICESemanticTheme;
}

/**
 * 深合并（仅普通对象；数组与函数整体替换）。
 *
 * 为什么必须是深合并：`semantic.motion` 是嵌套结构，浅合并会让
 * `setTheme({ motion: { duration: { fast: 50 } } })` 把 `motion.easing` 整个抹掉 ——
 * 动画路径随后读 `motion.easing[名]` 直接抛 TypeError（这条实测过）。
 */
export function deepMerge<T>(base: T, patch: any): T {
  if (patch === undefined) return base;
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) return patch as unknown as T;
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return patch as unknown as T;
  const out: any = { ...(base as any) };
  for (const key of Object.keys(patch)) {
    const value = (patch as any)[key];
    if (value === undefined) continue;
    out[key] = deepMerge((base as any)[key], value);
  }
  return out;
}

// ============ ② semantic tokens ============
/**
 * **家族品牌基线 = Bootstrap 5**（2026-09-14 确立）。
 *
 * 为什么是它：家族里 `ice-chart`、`ice-web-components`、`ice-render-doc`（文档站门面）本来就是
 * Bootstrap 值，引擎默认的 Tailwind 蓝是唯一的"第三种蓝"；而 Bootstrap 也是这些库最常见的使用环境
 * （用户的页面本身就是 Bootstrap）。对齐它是**向现实靠拢**，不是发明新品牌。
 *
 * 灰阶阶梯刻意比 Bootstrap 默认更深一档（`text > muted > hint` 三档全过 WCAG AA）：
 * Bootstrap 的 `gray-500 #ADB5BD` 在纯白上只有 2.1:1，`validateTheme()` 会直接判 error。
 */
export const BOOTSTRAP_BASELINE = {
  primary: '#0D6EFD',
  success: '#198754',
  warning: '#FFC107',
  danger: '#DC3545',
  info: '#0DCAF0',
  /** 正文（= Bootstrap `--bs-body-color`）。对白底 15.4:1。 */
  text: '#212529',
  /** 次要文字（gray-700）。对白底 7.0:1。 */
  muted: '#495057',
  /** 提示文字（gray-600）。对白底 4.68:1 —— 刚好过 AA。 */
  hint: '#6C757D',
  border: '#DEE2E6',
  background: '#ffffff',
} as const;

/**
 * 家族**数据系列配色**（唯一来源）。
 *
 * 引擎与 `ice-chart` 以前各有一套 8 色（引擎 Tailwind 500s、图表 Bootstrap 蓝 + Tailwind 混合）——
 * 同一份数据在两个产物里会得到不同颜色。现在二者共用这一份：图表直接 import 它。
 * 顺序是有意的：低对比度的黄排在后面（折线/散点用黄色在浅底上辨识度差，作为第 3 个系列色才安全）。
 */
export const FAMILY_PALETTE: string[] = [
  '#0D6EFD',
  '#10B981',
  '#F59E0B',
  '#EF4444',
  '#8B5CF6',
  '#14B8A6',
  '#EC4899',
  '#6366F1',
];

/** 深色主题下的数据系列配色（亮一档，暗底上可辨）。 */
export const FAMILY_PALETTE_DARK: string[] = [
  '#4D94FF',
  '#479F76',
  '#EA868F',
  '#6EDFF6',
  '#A370F7',
  '#FFDA6A',
  '#FD9843',
  '#79DFC1',
];

/** 交互外壳的默认值 = 引擎历史行为（升级后观感不变，主题里可整体替换）。 */
function buildChrome(): ICEChromeTheme {
  return {
    selection: { stroke: '#8b0000', fill: 'rgba(255, 255, 49, 0.2)', lineWidth: 1, lineDash: [] },
    handle: { fill: '#CC3300', stroke: '#8b0000', activeFill: '#f59e0b', lineWidth: 1 },
    linkHook: { fill: '#3ce92c', stroke: '#0c09d4', lineWidth: 1 },
    slot: { fill: '#3ce92c', stroke: '#3ce92c', hoverFill: '#fffb00', lineWidth: 1 },
    guide: { color: '#EC4899', lineWidth: 1 },
    linkLabel: { background: '#ffffff', fill: '#000000' },
    textSelection: { color: 'rgba(64,128,255,0.35)' },
    shadow: { sm: 'rgba(0,0,0,0.12)', md: 'rgba(0,0,0,0.18)', lg: 'rgba(0,0,0,0.25)' },
    debug: { minBox: '#ff0000', maxBox: '#0000ff' },
    lineBorder: '#c8c8c8',
  };
}

function buildSemantic(base: typeof baseTokens, overrides: Partial<ICESemanticTheme> = {}): ICESemanticTheme {
  const defaults = {
    // 语义色 = 家族品牌基线（Bootstrap 5）—— 品牌决策落在 semantic（alias token）上，
    // base.color 那套色 ramp 只是"原始色料"（global token），两者故意的分工。
    ...BOOTSTRAP_BASELINE,
    chrome: buildChrome(),
    // 数据系列配色：与 ice-chart 共用同一份（见 FAMILY_PALETTE 的说明）
    palette: FAMILY_PALETTE.slice(),
    motion: {
      duration: { fast: 100, normal: 200, slow: 300, slower: 500 },
      easing: {
        linear: 'linear',
        out: 'easeOutCubic',
        inOut: 'easeInOutCubic',
        outQuart: 'easeOutQuart',
        spring: 'spring',
        springSoft: 'springSoft',
        springSnappy: 'springSnappy',
      },
    },
  } as ICESemanticTheme;
  // 深合并：允许只覆盖 motion.duration.fast 这类深层字段而不用重写整块
  return deepMerge(defaults, overrides);
}

// ============ 内置主题 ============
export const DEFAULT_THEME: ICETheme = {
  base: baseTokens,
  semantic: buildSemantic(baseTokens),
};

export const DARK_THEME: ICETheme = {
  base: baseTokens,
  semantic: buildSemantic(baseTokens, {
    // 深色 = Bootstrap 5.3 的 `data-bs-theme="dark"` 变体（亮一档，暗底上可辨）
    primary: '#3d8bfd',
    success: '#479f76',
    warning: '#ffda6a',
    danger: '#ea868f',
    info: '#6edff6',
    // 灰阶同样三档且全过 AA：正文 17:1 / 次要 12.5:1 / 提示 8.5:1（对 #212529 底）
    text: '#dee2e6',
    muted: '#ced4da',
    hint: '#adb5bd',
    border: '#495057',
    background: '#212529',
    // 数据系列配色：家族深色色板
    palette: FAMILY_PALETTE_DARK.slice(),
    // 交互外壳在深色底上改用语义色：以前是写死的亮红 / 亮绿，深色主题下非常刺眼
    chrome: {
      selection: { stroke: baseTokens.color.blue[300], fill: 'rgba(96,165,250,0.16)', lineWidth: 1, lineDash: [] },
      handle: {
        fill: baseTokens.color.blue[400],
        stroke: baseTokens.color.gray[900],
        activeFill: baseTokens.color.amber[400],
        lineWidth: 1,
      },
      linkHook: { fill: baseTokens.color.emerald[400], stroke: baseTokens.color.gray[900], lineWidth: 1 },
      slot: {
        fill: baseTokens.color.emerald[400],
        stroke: baseTokens.color.gray[900],
        hoverFill: baseTokens.color.amber[400],
        lineWidth: 1,
      },
      guide: { color: baseTokens.color.pink[400], lineWidth: 1 },
      linkLabel: { background: baseTokens.color.gray[800], fill: baseTokens.color.gray[100] },
      textSelection: { color: 'rgba(96,165,250,0.35)' },
      shadow: { sm: 'rgba(0,0,0,0.45)', md: 'rgba(0,0,0,0.55)', lg: 'rgba(0,0,0,0.65)' },
      debug: { minBox: baseTokens.color.red[400], maxBox: baseTokens.color.blue[400] },
      lineBorder: baseTokens.color.gray[600],
    },
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

/** 已注册主题名清单（含内置 default / dark）。 */
export function listThemes(): string[] {
  return Object.keys(themeRegistry);
}

/** 取已注册的命名主题（不存在返回 null）。 */
export function getRegisteredTheme(name: string): ICETheme | null {
  return themeRegistry[name] || null;
}

/**
 * 解析主题但**不修改任何全局状态**：
 * - string：按名查注册表（如 'dark'）；未注册时回退 DEFAULT_THEME。
 * - object：**部分主题**，深合并到 `base` 上。三种写法都支持：
 *   - 平铺 semantic（旧写法，兼容）：`{ primary: '#f00' }`
 *   - 显式分层：`{ semantic: { primary: '#f00' }, base: { radius: {...} } }`
 *   - 深层局部：`{ motion: { duration: { fast: 50 } } }`（不再抹掉同一分支下的其它字段）
 *
 * 这是「实例级主题」的基础：`ICE` 用它把自己持有的主题解析出来，
 * 不污染模块级当前主题（模块级只作为**默认值**）。
 */
export function resolveTheme(nameOrTheme: ICEThemeInput, base: ICETheme = currentTheme): ICETheme {
  if (typeof nameOrTheme === 'string') {
    return themeRegistry[nameOrTheme] || DEFAULT_THEME;
  }
  if (!nameOrTheme || typeof nameOrTheme !== 'object') return base;
  return mergeThemes(base, nameOrTheme);
}

/** 主题入参：命名 / 完整主题 / 部分主题（平铺 semantic 或显式 base+semantic）。 */
export type ICEThemeInput = string | Partial<ICESemanticTheme> | ICEThemePatch;

/** 部分主题：base / semantic 都可给，且都按深合并处理。 */
export interface ICEThemePatch {
  base?: Partial<typeof baseTokens>;
  semantic?: Partial<ICESemanticTheme>;
  /** 平铺 semantic 字段（兼容旧写法）。 */
  [key: string]: any;
}

/**
 * 把一个部分主题合并到已有主题上（主题作用域 / 实例级覆盖都走它）。
 *
 * 平铺写法（`{ primary }`）与显式分层（`{ semantic: { primary } }`）等价 ——
 * 历史代码大量使用平铺写法，不能破坏；`base` / `semantic` 两个键名是保留字。
 */
export function mergeThemes(theme: ICETheme, patch: ICEThemePatch | null | undefined): ICETheme {
  if (!patch || typeof patch !== 'object') return theme;
  const semanticPatch: any = {};
  let hasSemantic = false;
  for (const key of Object.keys(patch)) {
    if (key === 'base' || key === 'semantic') continue;
    semanticPatch[key] = (patch as any)[key];
    hasSemantic = true;
  }
  if (patch.semantic && typeof patch.semantic === 'object') {
    Object.assign(semanticPatch, patch.semantic);
    hasSemantic = true;
  }
  const basePatch = patch.base && typeof patch.base === 'object' ? patch.base : null;
  return {
    base: basePatch ? deepMerge(theme.base, basePatch) : theme.base,
    semantic: hasSemantic ? deepMerge(theme.semantic, semanticPatch) : theme.semantic,
  };
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
export type StylePresetFactory = (theme: ICETheme) => any;

const BUILTIN_PRESETS: { [name: string]: StylePresetFactory } = {
  card: (t) => ({
    radius: t.base.radius.lg,
    style: { fillStyle: t.semantic.background, strokeStyle: t.semantic.border, lineWidth: 1, shadow: 'md' },
  }),
  /**
   * 渐变卡片：声明式线性渐变（纯对象，可序列化）。
   * presets 的返回值会 merge 进 props.style，所以渐变可以直接写在 preset 里，
   * 并随 setTheme 热切换重新按新主题色展开。
   */
  gradient: (t) => ({
    radius: t.base.radius.lg,
    style: {
      fillGradient: {
        type: 'linear',
        from: [0, 0],
        to: [0, 200],
        stops: [
          [0, t.semantic.primary],
          [1, t.semantic.background],
        ],
      },
      strokeStyle: t.semantic.border,
      lineWidth: 1,
    },
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

/**
 * 预设表（组件层 token）—— **只读视图**。
 *
 * 唯一的写入口是 `registerPreset()` / `unregisterPreset()`：内置不可覆盖、重复注册抛错。
 *
 * 为什么做成只读视图：以前它是普通对象，`STYLE_PRESETS.card = fn` 能直接赋值 ——
 * 内置预设挂在原型上，赋值会在实例上生成同名属性把它盖掉，于是「内置不可覆盖」的纪律
 * 被一行赋值就绕过去了（实测确认过）。同名不同义会让**同一份配置在不同工程里画出不同的图**，
 * 这条口子必须堵死，不能只靠约定。
 */
const presetRegistry: { [name: string]: StylePresetFactory } = { ...BUILTIN_PRESETS };

const PRESET_WRITE_HINT = '[ice-render] STYLE_PRESETS 是只读视图：';

export const STYLE_PRESETS: { [name: string]: StylePresetFactory } = new Proxy({} as any, {
  get: (_target, prop) => (typeof prop === 'string' ? presetRegistry[prop] : undefined),
  has: (_target, prop) => typeof prop === 'string' && Object.prototype.hasOwnProperty.call(presetRegistry, prop),
  ownKeys: () => Object.keys(presetRegistry),
  getOwnPropertyDescriptor: (_target, prop) =>
    typeof prop === 'string' && Object.prototype.hasOwnProperty.call(presetRegistry, prop)
      ? { configurable: true, enumerable: true, value: presetRegistry[prop], writable: false }
      : undefined,
  set: (_target, prop) => {
    throw new Error(`${PRESET_WRITE_HINT}注册请用 registerPreset('${String(prop)}', factory)。`);
  },
  deleteProperty: (_target, prop) => {
    throw new Error(`${PRESET_WRITE_HINT}注销请用 unregisterPreset('${String(prop)}')。`);
  },
});

/** 内置预设名（不允许被应用层覆盖）。 */
export const BUILTIN_PRESET_NAMES: string[] = Object.keys(BUILTIN_PRESETS);

/**
 * 注册组件样式预设 —— **写预设的唯一入口**。
 *
 * - 内置预设（card / panel / button / button-danger / gradient / title / subtitle / body / label）
 *   不允许覆盖：不同工程里同名不同义 = 同一份 option 画出不同的图；
 * - 应用层预设请带命名空间（`app:my-card`），避免与引擎内置或其它库撞名；
 * - 重复注册同一个名字会**明确抛错**（与 `registerType` 一致），不会再静默覆盖；
 * - `STYLE_PRESETS` 是只读视图，直接赋值会抛错并把调用方指到这里。
 */
export function registerPreset(name: string, factory: StylePresetFactory, options: { overwrite?: boolean } = {}): void {
  if (!name || typeof name !== 'string') {
    throw new Error('[ice-render] registerPreset: 预设名必须是非空字符串。');
  }
  if (typeof factory !== 'function') {
    throw new Error(`[ice-render] registerPreset: 预设「${name}」的工厂必须是函数。`);
  }
  if (BUILTIN_PRESET_NAMES.indexOf(name) >= 0) {
    throw new Error(`[ice-render] registerPreset: 「${name}」是内置预设，不允许覆盖。`);
  }
  if (!options.overwrite && Object.prototype.hasOwnProperty.call(presetRegistry, name)) {
    throw new Error(`[ice-render] registerPreset: 预设「${name}」已注册；要覆盖请显式传 { overwrite: true }。`);
  }
  presetRegistry[name] = factory;
}

/** 注销应用层注册的预设（内置预设不可注销）。 */
export function unregisterPreset(name: string): boolean {
  if (BUILTIN_PRESET_NAMES.indexOf(name) >= 0) return false;
  if (!Object.prototype.hasOwnProperty.call(presetRegistry, name)) return false;
  delete presetRegistry[name];
  return true;
}

// ============ ④ 主题引用（style 里引用 token，paint 时解析） ============
/**
 * 主题引用：`{ $token: 'primary' }`。
 *
 * 为什么需要它：样式里的色值以前是**构造时写死的字面量**，于是只有用了 `preset` 的组件跟随主题，
 * 自定义组件的颜色永远停在创建那一刻。把「引用」做成一等公民之后，样式在 **paint 时**解析，
 * 任意组件都能跟随 `setTheme` 热切换（引擎只需标脏，不必遍历重算）。
 *
 * 支持的路径：
 * - `'primary'` → `semantic.primary`
 * - `'palette.2'` → `semantic.palette[2]`
 * - `'chrome.slot.hoverFill'` → `semantic.chrome.slot.hoverFill`
 * - `'base.radius.md'` / `'base.color.blue.500'` → base token
 */
export interface ICEThemeTokenRef {
  $token: string;
}

/** 造一个主题引用（推荐写法，类型安全且不会被误认为普通字符串）。 */
export function token(path: string): ICEThemeTokenRef {
  return { $token: String(path) };
}

/** 数据系列配色的简写：`palette(2)` = `token('palette.2')`。 */
export function palette(index: number): ICEThemeTokenRef {
  return token(`palette.${index}`);
}

/** 是不是主题引用（对象形态 `{$token}` 或字符串简写 `'$primary'`）。 */
export function isTokenRef(value: any): boolean {
  if (!value) return false;
  if (typeof value === 'string') return value.charAt(0) === '$' && value.length > 1;
  return typeof value === 'object' && typeof value.$token === 'string';
}

/** 取引用里的路径（字符串简写也认）。 */
export function tokenPathOf(value: any): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value.charAt(0) === '$' && value.length > 1 ? value.slice(1) : null;
  if (typeof value === 'object' && typeof value.$token === 'string') return value.$token;
  return null;
}

/**
 * 按路径取主题里的值（找不到返回 undefined）。
 * 路径第一段若是 `base` 走 base，否则默认走 semantic（所以 `'primary'` 就够）。
 */
export function tokenValue(path: string, theme: ICETheme): any {
  if (!path) return undefined;
  const parts = String(path)
    .split('.')
    .filter((p) => p !== '');
  if (!parts.length) return undefined;
  let cursor: any = parts[0] === 'base' ? theme.base : theme.semantic;
  let start = parts[0] === 'base' ? 1 : 0;
  if (parts[0] === 'semantic') start = 1;
  for (let i = start; i < parts.length; i++) {
    if (cursor === undefined || cursor === null) return undefined;
    cursor = cursor[parts[i]];
  }
  return cursor;
}

/**
 * 解析一个样式值：是引用就查表，否则原样返回。
 * 解析失败（token 名写错）返回 `undefined` —— 调用方应跳过赋值，避免把颜色涂成 undefined。
 */
export function resolveThemeValue(value: any, theme: ICETheme): any {
  if (!isTokenRef(value)) return value;
  const path = tokenPathOf(value);
  return path ? tokenValue(path, theme) : undefined;
}

// ============ ⑤ 主题校验（别让写错的主题静默生效） ============
/** 深比较（只用于快照这类冷路径，不进帧热路径）。 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    for (const key of ak) {
      if (!Object.prototype.hasOwnProperty.call(b, key) || !deepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

/**
 * 求「把 base 深合并成 target 所需要的最小补丁」。
 *
 * 用途：快照里的主题只该存**真正被改过的那几处**，而不是调用方当初传进来的原始对象 ——
 * `setTheme(someFullTheme)` 时入参是整份主题，直接存下来会把内置 token 全写进文档
 * （体积 + 与引擎版本耦合）。用 diff 之后，「怎么设置的」不再影响「存什么」。
 */
export function deepDiff(base: any, target: any): any {
  if (deepEqual(base, target)) return undefined;
  const baseIsObject = base && typeof base === 'object' && !Array.isArray(base);
  const targetIsObject = target && typeof target === 'object' && !Array.isArray(target);
  if (!baseIsObject || !targetIsObject) return target;
  const out: any = {};
  let changed = false;
  for (const key of Object.keys(target)) {
    const diff = deepDiff(baseIsObject ? base[key] : undefined, target[key]);
    if (diff !== undefined) {
      out[key] = diff;
      changed = true;
    }
  }
  return changed ? out : undefined;
}

export interface ThemeDiagnostic {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
}

/** 相对亮度（WCAG 2.1），用于对比度检查。 */
function relativeLuminance(color: string): number | null {
  const rgb = parseColor(color);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function parseColor(color: string): [number, number, number] | null {
  if (typeof color !== 'string') return null;
  const value = color.trim();
  if (value.charAt(0) === '#') {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    if (hex.length !== 6) return null;
    return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
  }
  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1].split(',').map((p) => Number(p.trim()));
  if (parts.length < 3 || parts.some((n) => !isFinite(n))) return null;
  return [parts[0], parts[1], parts[2]];
}

/** 对比度（WCAG）：返回 1~21，无法解析返回 null。 */
export function contrastRatio(foreground: string, background: string): number | null {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  if (fg === null || bg === null) return null;
  const light = Math.max(fg, bg);
  const dark = Math.min(fg, bg);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * 校验主题：**未知 token 名 / 类型不对 / 对比度不足**都给结构化诊断。
 *
 * 引擎里动画、DSL 都有诊断体系，主题这块以前是空白 —— 写错 token 名只会静默失效。
 * 应用层可以在自己的设置面板里跑它，给用户提示（而不是让人对着"没变化"发呆）。
 */
export function validateTheme(theme: any): ThemeDiagnostic[] {
  const out: ThemeDiagnostic[] = [];
  const push = (severity: 'error' | 'warning', code: string, message: string, path?: string) =>
    out.push({ severity, code, message, path });
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) {
    push('error', 'invalid-theme', '主题必须是普通对象。');
    return out;
  }
  const semantic = theme.semantic || theme;
  if (typeof semantic !== 'object') {
    push('error', 'invalid-semantic', '主题的 semantic 段必须是对象。', 'semantic');
    return out;
  }
  // 未知的顶层 semantic 字段（拼错 token 名最常见的形态）
  const knownSemantic = [
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'text',
    'muted',
    'hint',
    'border',
    'background',
    'palette',
    'chrome',
    'motion',
  ];
  for (const key of Object.keys(semantic)) {
    if (knownSemantic.indexOf(key) < 0) {
      push('warning', 'unknown-semantic-token', `未知的语义 token「${key}」，引擎不会读它。`, `semantic.${key}`);
    }
  }
  for (const key of [
    'primary',
    'success',
    'warning',
    'danger',
    'info',
    'text',
    'muted',
    'hint',
    'border',
    'background',
  ]) {
    const value = semantic[key];
    if (value === undefined) continue;
    if (typeof value !== 'string')
      push('error', 'invalid-color', `semantic.${key} 必须是颜色字符串。`, `semantic.${key}`);
  }
  if (semantic.palette !== undefined) {
    if (!Array.isArray(semantic.palette) || !semantic.palette.length) {
      push('error', 'invalid-palette', 'semantic.palette 必须是非空颜色数组。', 'semantic.palette');
    } else if (semantic.palette.some((c: any) => typeof c !== 'string')) {
      push('error', 'invalid-palette', 'semantic.palette 里只能是颜色字符串。', 'semantic.palette');
    }
  }
  if (semantic.motion !== undefined) {
    const motion = semantic.motion;
    if (typeof motion !== 'object' || !motion.duration || !motion.easing) {
      push(
        'error',
        'invalid-motion',
        'semantic.motion 必须同时有 duration 与 easing（动画靠它们解析语义名）。',
        'semantic.motion'
      );
    } else {
      for (const key of ['fast', 'normal', 'slow', 'slower']) {
        if (typeof motion.duration[key] !== 'number') {
          push(
            'error',
            'invalid-motion-duration',
            `motion.duration.${key} 必须是数字（毫秒）。`,
            `semantic.motion.duration.${key}`
          );
        }
      }
    }
  }
  // 正文 / 次要文字与背景的对比度：低于 4.5 提示，低于 3 报错
  const pairs: Array<[string, string, string]> = [
    ['text', semantic.text, semantic.background],
    ['muted', semantic.muted, semantic.background],
    ['hint', semantic.hint, semantic.background],
  ];
  for (const [name, fg, bg] of pairs) {
    const ratio = contrastRatio(fg, bg);
    if (ratio === null) continue;
    if (ratio < 3) {
      push(
        'error',
        'low-contrast',
        `semantic.${name} 与背景的对比度只有 ${ratio.toFixed(2)}:1，基本看不清（WCAG 最低 4.5:1）。`,
        `semantic.${name}`
      );
    } else if (ratio < 4.5) {
      push(
        'warning',
        'low-contrast',
        `semantic.${name} 与背景的对比度 ${ratio.toFixed(2)}:1 低于 WCAG AA 的 4.5:1。`,
        `semantic.${name}`
      );
    }
  }
  return out;
}

export default {
  baseTokens,
  DEFAULT_THEME,
  DARK_THEME,
  registerTheme,
  setTheme,
  getTheme,
  resolveTheme,
  mergeThemes,
  registerPreset,
  unregisterPreset,
  STYLE_PRESETS,
  token,
  palette,
  resolveThemeValue,
  validateTheme,
};
