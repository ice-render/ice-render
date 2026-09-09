/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */

/**
 * 主题机制：默认主题 + 预设样式（preset）+ 可切换。
 *
 * - 默认主题定义颜色 / 字体 / 圆角等基础变量。
 * - STYLE_PRESETS 是命名样式预设（card / button / title 等），从主题取变量。
 * - 组件通过 props.preset 引用预设，避免手写一堆 style。
 * - setTheme() 切换主题，预设会自动跟着变。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export const DEFAULT_THEME = {
  primary: '#185fa5',
  success: '#37dd0d',
  warning: '#ef9f27',
  danger: '#d40c0c',
  text: '#333333',
  muted: '#666666',
  hint: '#888880',
  border: '#e0e0e0',
  background: '#ffffff',
  fontFamily: 'Arial',
  fontSize: 14,
  radius: 8,
};

let currentTheme = { ...DEFAULT_THEME };

/**
 * 切换主题（浅合并，未提供的字段保留默认值）。
 */
export function setTheme(theme: any): void {
  currentTheme = { ...currentTheme, ...theme };
}

export function getTheme(): any {
  return currentTheme;
}

/**
 * 预设样式：返回的是「props 补丁」，会 merge 到组件 props（在用户 props 之前，用户可覆盖）。
 * 用函数形式以便每次取最新主题。
 */
export const STYLE_PRESETS: { [name: string]: () => any } = {
  // 卡片：白底 + 细边框 + 圆角 + 阴影
  card: () => ({
    radius: 12,
    style: { fillStyle: currentTheme.background, strokeStyle: currentTheme.border, lineWidth: 1, shadow: 'md' },
  }),
  // 面板
  panel: () => ({
    radius: 8,
    style: { fillStyle: currentTheme.background, strokeStyle: currentTheme.border, lineWidth: 1, shadow: 'sm' },
  }),
  // 主按钮
  button: () => ({
    radius: 8,
    style: { fillStyle: currentTheme.primary, strokeStyle: currentTheme.primary, lineWidth: 1, shadow: 'sm' },
  }),
  'button-danger': () => ({
    radius: 8,
    style: { fillStyle: currentTheme.danger, strokeStyle: currentTheme.danger, lineWidth: 1, shadow: 'sm' },
  }),
  // 标题
  title: () => ({ stroke: false, style: { fontSize: 24, fontWeight: 'bold', fillStyle: currentTheme.text } }),
  // 副标题
  subtitle: () => ({ stroke: false, style: { fontSize: 16, fillStyle: currentTheme.muted } }),
  // 正文
  body: () => ({ stroke: false, style: { fontSize: currentTheme.fontSize, fillStyle: currentTheme.text } }),
  // 标签 / 提示
  label: () => ({ stroke: false, style: { fontSize: 13, fillStyle: currentTheme.hint } }),
};

export default { DEFAULT_THEME, setTheme, getTheme, STYLE_PRESETS };
