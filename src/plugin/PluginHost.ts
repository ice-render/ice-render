/**
 * 插件宿主：为引擎提供「组件 / 渲染 / 交互工具」三层注册点。
 *
 * 设计取向与 09-roadmap 的边界一致——**只提供原语，不做应用层 UX**：
 * - 组件层：插件声明自定义图元类型，宿主代为 `registerType`（因此自动获得
 *   序列化 typeId 反查能力，见 `ICE.getTypeId`）。
 * - 渲染层：插件拿到每帧的绘制回调，在与组件相同的坐标系（世界坐标）下叠加绘制。
 *   局部重绘帧里回调在 clip 之内执行，语义与组件一致（超出脏区域的旧内容不会被擦除也不会被重画；
 *   若插件内容会随时间变化而没有任何组件变脏，引擎本身会因「无脏组件」回退全量，仍然正确）。
 * - 交互工具层：插件按 `match(component)` 声明自己的工具组件；宿主复用既有 `toolNodes`
 *   机制做 add/remove，`exclusive` 为真时禁用内置变换/连线面板。
 *
 * 生命周期：`ICE.use(plugin)` 幂等（按 `name` 去重）→ 调用 `setup(ice)`；
 * `ICE.unuse(name)` → 调用 `teardown(ice)` 并撤销该插件注册的工具与渲染回调。
 * 类型注册（`components`）在 unuse 后**保留**——反序列化仍可能依赖它，且撤销类型会让已存数据失效。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */

export interface ICERenderFrame {
  ctx: any;
  /** 当前渲染模式 */
  mode: 'full' | 'dirty-rect';
  /** 局部重绘时的脏区域（世界坐标 [minX,minY,maxX,maxY]）；全量帧为 null */
  region: number[] | null;
  /** 画布尺寸（设备像素） */
  width: number;
  height: number;
}

export type ICERenderHook = (frame: ICERenderFrame) => void;

export interface ICEPluginTool {
  /** 插件内唯一 id（用于幂等注册与撤销） */
  id: string;
  /** 该工具是否应作用于当前选中的组件 */
  match: (component: any, ice: any) => boolean;
  /** 创建工具组件（会被加到 ICE.toolNodes，不参与序列化） */
  create: () => any;
  /**
   * 命中时是否屏蔽内置变换/连线面板。
   * 默认 false（叠加在内置面板之上）；为 true 时内置面板会被禁用，避免与插件工具重叠。
   */
  exclusive?: boolean;
  /** 可选：目标组件变化时回调（同一工具实例被复用，避免每次选中都重建） */
  onTargetChange?: (tool: any, component: any) => void;
}

export interface ICEPlugin {
  /** 插件唯一名（幂等注册键） */
  name: string;
  /** 组件层：typeId → 构造函数 */
  components?: Record<string, new (...args: any[]) => any>;
  /** 渲染层：每帧绘制回调（世界坐标） */
  render?: ICERenderHook;
  /** 交互工具层 */
  tools?: ICEPluginTool[];
  /** 注册时调用（可在此绑定事件、注册主题等） */
  setup?: (ice: any) => void;
  /** 注销时调用（应释放自己申请的资源） */
  teardown?: (ice: any) => void;
}

interface RegisteredTool extends ICEPluginTool {
  pluginName: string;
  /** 已创建的工具实例（懒创建，跨选中复用） */
  instance: any;
  /** 当前是否已挂到 toolNodes */
  attached: boolean;
}

export default class PluginHost {
  private ice: any;
  private plugins: ICEPlugin[] = [];
  /** 渲染回调，按注册顺序调用 */
  private renderHooks: Array<{ pluginName: string; hook: ICERenderHook }> = [];
  private tools: RegisteredTool[] = [];

  constructor(ice: any) {
    this.ice = ice;
  }

  /** 已注册插件名（只读快照） */
  public get names(): string[] {
    return this.plugins.map((p) => p.name);
  }

  public has(name: string): boolean {
    return this.plugins.some((p) => p.name === name);
  }

  public hasRenderHooks(): boolean {
    return this.renderHooks.length > 0;
  }

  /** 幂等注册：同名插件重复 use 直接返回 false（不重复 setup） */
  public use(plugin: ICEPlugin): boolean {
    if (!plugin || !plugin.name) {
      throw new Error('ICE.use(plugin)：插件必须提供非空的 name。');
    }
    if (this.has(plugin.name)) {
      return false;
    }

    // ① 组件层
    if (plugin.components) {
      for (const typeId in plugin.components) {
        const Ctor = plugin.components[typeId];
        if (typeof Ctor === 'function') {
          this.ice.registerType(typeId, Ctor);
        }
      }
    }

    // ② 渲染层
    if (typeof plugin.render === 'function') {
      this.renderHooks.push({ pluginName: plugin.name, hook: plugin.render });
    }

    // ③ 交互工具层
    if (plugin.tools) {
      for (let i = 0; i < plugin.tools.length; i++) {
        const tool = plugin.tools[i];
        if (!tool || !tool.id) {
          continue;
        }
        this.tools.push({ ...tool, pluginName: plugin.name, instance: null, attached: false });
      }
    }

    this.plugins.push(plugin);
    if (typeof plugin.setup === 'function') {
      plugin.setup(this.ice);
    }
    return true;
  }

  /** 注销插件：撤销其渲染回调与工具，并调用 teardown（类型注册保留） */
  public unuse(name: string): boolean {
    const idx = this.plugins.findIndex((p) => p.name === name);
    if (idx === -1) {
      return false;
    }
    const plugin = this.plugins[idx];

    // 先摘掉工具（可能已挂在 toolNodes 上）
    for (let i = this.tools.length - 1; i >= 0; i--) {
      if (this.tools[i].pluginName === name) {
        this.detachTool(this.tools[i]);
        this.tools.splice(i, 1);
      }
    }
    for (let i = this.renderHooks.length - 1; i >= 0; i--) {
      if (this.renderHooks[i].pluginName === name) {
        this.renderHooks.splice(i, 1);
      }
    }
    this.plugins.splice(idx, 1);

    if (typeof plugin.teardown === 'function') {
      plugin.teardown(this.ice);
    }
    return true;
  }

  /** 渲染钩子：由 CanvasRenderer 在绘制完组件与工具后调用（世界坐标、clip 之内） */
  public invokeRenderHooks(frame: ICERenderFrame): void {
    for (let i = 0; i < this.renderHooks.length; i++) {
      this.renderHooks[i].hook(frame);
    }
  }

  /**
   * 选中变化时同步插件工具：命中的挂上、失配的摘下。
   * @returns 是否存在「排他」工具命中（命中时调用方应禁用内置面板）
   */
  public syncTools(component: any): boolean {
    let hasExclusive = false;
    for (let i = 0; i < this.tools.length; i++) {
      const tool = this.tools[i];
      let matched = false;
      try {
        matched = !!component && !!tool.match(component, this.ice);
      } catch (err) {
        matched = false;
      }
      if (matched) {
        if (!tool.instance) {
          tool.instance = tool.create();
        }
        if (!tool.attached && tool.instance) {
          this.ice.addTool(tool.instance);
          tool.attached = true;
        }
        if (typeof tool.onTargetChange === 'function') {
          tool.onTargetChange(tool.instance, component);
        }
        if (tool.exclusive) {
          hasExclusive = true;
        }
      } else {
        this.detachTool(tool);
      }
    }
    return hasExclusive;
  }

  /** 全部摘下（如 clearAll 时） */
  public detachAllTools(): void {
    for (let i = 0; i < this.tools.length; i++) {
      this.detachTool(this.tools[i]);
    }
  }

  private detachTool(tool: RegisteredTool): void {
    if (tool.attached && tool.instance) {
      this.ice.removeTool(tool.instance);
      tool.attached = false;
    }
  }

  /** destroy 时清空（不调用 teardown，交由 ICE.destroy 统一处理） */
  public clear(): void {
    this.detachAllTools();
    this.plugins = [];
    this.renderHooks = [];
    this.tools = [];
  }
}
