/**
 * 无障碍（a11y）原语。
 *
 * 定位（与 09-roadmap 的「引擎只做原语」一致）：引擎**不**自建 DOM 镜像层，
 * 而是把「要暴露给辅助技术的信息」整理成一份快照，交给应用层渲染成隐藏 DOM
 * （`<button>` / `<div role="img">` 等），由应用决定语义、文案、路由与焦点环样式。
 *
 * 为什么不自建：canvas 内容对屏幕阅读器完全不可见（MDN 明确指出 `<canvas>` 只是位图、
 * 不向辅助工具暴露绘制对象），所以镜像层是必需的；但镜像的 DOM 结构、`role` 粒度、
 * 文案与键盘模型高度依赖具体产品语义，写在引擎里既做不对也难维护。
 *
 * 引擎负责的部分：
 * - 遍历组件树，产出可访问节点（id / 角色建议 / 可读名称 / **屏幕坐标盒** / 层级 / tab 顺序）
 * - 键盘焦点原语：`ICE.setFocusedComponent()`，让应用把焦点映射到组件上
 * - 坐标换算：把世界盒经视口换算成 CSS 像素，应用层可直接拿去做 DOM 绝对定位
 *
 * 引擎**不**负责：DOM 结构、ARIA 属性选择、焦点环渲染、屏幕阅读器播报文案、WCAG 合规判定。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
import { isEffectivelyVisible } from '../util/data-util';

/** 可访问节点的角色建议（应用层可映射为 role / 元素类型）。 */
export type ICEAccessibleRole = 'graphic' | 'container' | 'link' | 'text' | 'image' | 'tool';

export interface ICEAccessibleNode {
  /** 组件 id（`props.id`） */
  id: string;
  /** 角色建议 */
  role: ICEAccessibleRole;
  /** 可读名称：优先 `state.ariaLabel`，其次文本内容，最后回退 id */
  label: string;
  /** 屏幕坐标盒（CSS 像素，已含视口换算），应用层可直接用于绝对定位 */
  box: { x: number; y: number; width: number; height: number };
  /** 在 canvas 内是否可见（`display !== false`） */
  visible: boolean;
  /** 是否参与交互（`interactive`）——决定 DOM 上是否可点击/可聚焦 */
  interactive: boolean;
  /** 是否建议可聚焦（可见 + 可交互） */
  focusable: boolean;
  /** 建议的 tab 顺序（按 zIndex 升序，从 0 开始） */
  tabIndex: number;
  /** 是否当前被选中 */
  selected: boolean;
  /** 树层级（根为 1） */
  level: number;
  /** 父组件 id（顶层为 null） */
  parentId: string | null;
}

export interface ICEAccessibilityOptions {
  /** 是否包含工具层（控制面板等）。默认 false —— 工具层通常不应出现在无障碍树里。 */
  includeTools?: boolean;
  /** 是否包含不可见组件。默认 false。 */
  includeHidden?: boolean;
  /** 只保留该谓词返回 true 的组件（在其它过滤之后应用）。 */
  filter?: (component: any) => boolean;
}

/** 推断角色建议。 */
function resolveRole(component: any): ICEAccessibleRole {
  if (component.isControlPanel) {
    return 'tool';
  }
  if (component.isLine) {
    return 'link';
  }
  if (typeof component.measureText === 'function') {
    return 'text';
  }
  // 容器型组件（ICEGroup / ICEControlPanel）恒有 childNodes 数组；
  // 注意判「是否为容器」而不是「当前有没有子节点」——空的容器仍然是容器。
  if (Array.isArray(component.childNodes)) {
    return 'container';
  }
  if (component.state && component.state.src) {
    return 'image';
  }
  return 'graphic';
}

/** 推断可读名称。 */
function resolveLabel(component: any): string {
  const state = component.state || {};
  if (typeof state.ariaLabel === 'string' && state.ariaLabel) {
    return state.ariaLabel;
  }
  if (typeof state.text === 'string' && state.text) {
    return state.text;
  }
  if (typeof state.title === 'string' && state.title) {
    return state.title;
  }
  return (component.props && component.props.id) || String(state.id || '');
}

/**
 * 取组件在**屏幕坐标（CSS 像素）**下的轴对齐盒。
 *
 * 用 `__paintWorldBox()`（读缓存的 composedMatrix、零分配、无副作用）而不是
 * `getMaxBoundingBox(true)`：后者会调 `composeMatrix()`，对点集路径会就地平移 `state.dots`
 * 造成累积漂移（见 13-gap-analysis §4.6 的高危脆弱点）。
 * 未渲染过（没有有效矩阵）的组件返回 null —— 它们本来也没上屏。
 */
function resolveBox(ice: any, component: any): ICEAccessibleNode['box'] | null {
  if (typeof component.__paintWorldBox !== 'function') {
    return null;
  }
  const m = component.state && component.state.composedMatrix;
  if (!m || m.length < 6) {
    return null;
  }
  const world = component.__paintWorldBox([0, 0, 0, 0]);
  if (!isFinite(world[0]) || !isFinite(world[1]) || !isFinite(world[2]) || !isFinite(world[3])) {
    return null;
  }
  const [sx0, sy0] = ice.worldToScreen(world[0], world[1]);
  const [sx1, sy1] = ice.worldToScreen(world[2], world[3]);
  return {
    x: Math.min(sx0, sx1),
    y: Math.min(sy0, sy1),
    width: Math.abs(sx1 - sx0),
    height: Math.abs(sy1 - sy0),
  };
}

/**
 * 构建可访问节点快照。
 *
 * 顺序：按「树深度优先 + 同级 zIndex 升序」，与视觉堆叠顺序一致（应用可据此生成 tab 顺序）。
 * 不含未上屏（无有效变换矩阵）的组件。
 */
export function buildAccessibilityTree(ice: any, options: ICEAccessibilityOptions = {}): ICEAccessibleNode[] {
  const out: ICEAccessibleNode[] = [];
  const selected: Array<any> = (ice && ice.selectionList) || [];
  let tabIndex = 0;

  const walk = (list: Array<any>, level: number, parentId: string | null): void => {
    if (!list || !list.length) {
      return;
    }
    // 同级按 zIndex 升序（与渲染顺序一致）
    const sorted = list.slice().sort((a: any, b: any) => (a.state.zIndex || 0) - (b.state.zIndex || 0));
    for (let i = 0; i < sorted.length; i++) {
      const c: any = sorted[i];
      const state = c.state || {};
      // 祖先 display:false 时也视为不可见（display 的语义是整棵子树）
      const visible = isEffectivelyVisible(c);
      const interactive = state.interactive !== false;
      const box = resolveBox(ice, c);
      const passesBase = (options.includeHidden || visible) && !!box;
      const passesFilter = !options.filter || options.filter(c);
      if (passesBase && passesFilter) {
        out.push({
          id: (c.props && c.props.id) || String(state.id || ''),
          role: resolveRole(c),
          label: resolveLabel(c),
          box,
          visible,
          interactive,
          focusable: visible && interactive,
          tabIndex: tabIndex++,
          selected: selected.indexOf(c) !== -1,
          level,
          parentId,
        });
      }
      if (c.childNodes && c.childNodes.length) {
        walk(c.childNodes, level + 1, (c.props && c.props.id) || null);
      }
    }
  };

  walk((ice && ice.childNodes) || [], 1, null);
  if (options.includeTools) {
    walk((ice && ice.toolNodes) || [], 1, null);
  }
  return out;
}
