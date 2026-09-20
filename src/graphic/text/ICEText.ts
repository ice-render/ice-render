/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { merge } from '../../util/lang';
import ICEEvent from '../../event/ICEEvent';
import { resolveTextAlign, resolveTextDirection } from './text-direction';
import { ICEWordBreak, splitGraphemes, wrapParagraph } from './text-wrap';
import { resolveLetterSpacingCss, resolveLineHeightPx, resolveTextDecorations } from './text-style';
import ICEComponent from '../ICEComponent';

const utilDivId = '__ICE_UTILS_TEXT_MEASURE_DIV__';

/**
 * TODO:draw text along Path2D
 * @class ICEText 文本
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEText extends ICEComponent {
  /**
   * 文本的「动画安全键」：基类那批（位置/变换/透明度/显示/zIndex）之外，再放行**不参与量测**的
   * 绘制类与编辑类键；字号/字间距/行高/内边距/`font*`/文本内容/换行参数一概**不在**白名单里
   * （它们都会改变盒子尺寸或换行结果 → 必须走 `paramsDirty`）。
   */
  public static readonly ANIMATION_SAFE_KEYS: readonly string[] = [
    // 注意：这里**不能**直接展开基类的白名单 —— 基类放行了整条 `style.*`（对不量测的图形是对的），
    // 而文本的字号 / 字间距 / 行高 / 内边距都会改变量测结果，必须逐个显式放行（见下）。
    'left',
    'top',
    'zIndex',
    'opacity',
    'display',
    'transform',
    'fill',
    'stroke',
    // 光标 / 选区 / 编辑外形：只影响绘制
    'caretIndex',
    'selectionStart',
    'selectionEnd',
    'multiline',
    // 绘制类 style：不参与量测
    'style.textAlign',
    'style.textBaseline',
    'style.fillStyle',
    'style.strokeStyle',
    'style.globalAlpha',
    'style.globalCompositeOperation',
    'style.shadow',
    'style.shadowColor',
    'style.shadowBlur',
    'style.shadowOffsetX',
    'style.shadowOffsetY',
    'style.textDecoration',
    'style.textDecorationColor',
    'style.textDecorationWidth',
    'style.selectionColor',
    'style.fillGradient',
    'style.strokeGradient',
  ];

  /**
   * @cfg
   * {
   *   text:'文本内容',
   *   left:0,
   *   top:0,
   *   style:{
   *       fontWeight:24,
   *       fontSize:48,
   *       fontFamily:'Arial',
   *       lineWidth:1,
   *       textBaseline:'bottom',
   *       paddingTop:0,    //number 型，不可加单位
   *       paddingBottom:0, //number 型，不可加单位
   *       paddingLeft:0,   //number 型，不可加单位
   *       paddingRight:0,  //number 型，不可加单位
   *   }
   * }
   * @param props
   */
  constructor(props: any = {}) {
    const param = ICEText.arrangeParam(props);
    super(param);
    // 原始 props 在这里捕捉：`arrangeParam` 会把默认 width/height（10）合并进来，
    // 之后的 `this.__userProps` 已经分不清「用户显式给了 10」与「用了默认值」。
    // 自动尺寸语义以**用户是否显式传**为准（见 __applyMeasuredSize）。
    this.__autoWidth = props == null || props.width === undefined;
    this.__autoHeight = props == null || props.height === undefined;
    this.measureText();
  }

  /** 用户没显式给 width → 宽度按量测自适应 */
  private __autoWidth = true;
  /** 用户没显式给 height → 高度按量测自适应 */
  private __autoHeight = true;

  /**
   * 逐行宽度缓存（第 8 项）：量测时顺手记下（`__measureByCanvas` 本来就要逐行 measureText），
   * 供居中 / 右对齐、文本装饰线、SVG 导出、光标与选区复用。
   *
   * 失效策略：`setState`（任何 state 变化都会置 `paramsDirty`）与 `remeasureText()` 清空；
   * 另外缓存带 key（内容 + 字体 + 字间距），即使漏清也能自我纠正。
   */
  private __lineWidthCache: { key: string; widths: number[] } | null = null;

  /**
   * 最近一次量测得到的**字形墨迹**上下沿（相对基线；来自 `actualBoundingBoxAscent/Descent`）
   * 与**字体 em 盒**上下沿（`fontBoundingBox*`，部分运行时没有则按字号粗估）。
   *
   * 光标 / 选区 / 命中都要把「行带」换算成屏幕上的矩形，而 canvas 的 `textBaseline` 有
   * top / middle / bottom / alphabetic 几种口径（`y` 分别指 em 顶 / em 中 / em 底 / 字母基线）——
   * 只按 `y + 行号 × 行高` 推会在非 bottom 基线（如 `textBaseline: 'top'`）下整体错位半行到一行。
   */
  private __inkMetrics: { ascent: number; descent: number } | null = null;
  private __fontMetrics: { ascent: number; descent: number } | null = null;

  protected static arrangeParam(props) {
    const param = merge(
      {
        text: '',
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        editing: false, //是否处于内联编辑状态
        caretIndex: 0, //编辑光标位置（字符下标）
        // 选区（引擎自绘；-1 = 没有选区）。多行编辑时由 HTML textarea 的 selectionStart/End 同步过来。
        selectionStart: -1,
        selectionEnd: -1,
        multiline: false, //编辑态是否允许换行（回车插入 \n 而不是提交）；用 <textarea> 承接输入
        wrap: false, //是否按 state.width 自动换行（默认关，保持既有「按 \n 拆行」行为）
        // 断行策略（仅在 wrap 打开时生效）：
        //   'normal'    —— 优先在词边界断（拉丁词不被硬拆；CJK 逐字断 + 禁则）；单词整行放不下才硬拆
        //   'break-all' —— 旧的逐 grapheme 贪心（给代码/艺术字这类需要等宽硬断的场景留出口）
        wordBreak: 'normal' as ICEWordBreak,
        // 文字方向：'auto' 按首个强方向字符判定（RTL 文案必须让 canvas 知道基线方向，否则 BiDi 重排会错）。
        // 放在**顶层 state** 而不是 style：它需要「解析 + 运行时特性检测」两步，不能交给通用的
        // style→ctx 赋值逻辑（那会把非法值 'auto' 直接写进 ctx）。注意这是**排版**属性，不是 i18n 词条。
        direction: 'auto' as 'ltr' | 'rtl' | 'auto',
        maxLines: 0, //最大行数（0 = 不限）；超出时末行以 ellipsis 截断
        ellipsis: '…', //截断时追加的省略号
        // 文本超出盒子宽度时怎么办：
        //   'ellipsis'（默认）—— 按宽度截断并追加省略号；**绝不改字形**
        //   'clip'            —— 原样画出去（允许溢出盒子），由调用方自己裁
        // 历史坑：以前是把宽度当 `fillText(text, x, y, maxWidth)` 的第 4 个参数传下去，
        // canvas 会按 maxWidth 把字形**横向压扁**（不是截断）——「文字变形」就是这么来的。
        textOverflow: 'ellipsis' as 'ellipsis' | 'clip',
        lines: null, //派生：换行 / 截断后的行数组（不序列化，随 measureText 重算）
        transformable: false, //文本默认不显示变换手柄（选中时只允许拖动），需变换时显式设 true
        style: {
          fontWeight: 'bold',
          fontSize: 32,
          fontFamily: 'Arial',
          lineWidth: 1,
          textBaseline: 'bottom', //@see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
          // 行高：默认（0 = 未配置）走 max(墨迹高, 字号 × 1.35)；数字按 px，字符串支持 '2'（倍数）/'40px'/'1.5em'/'150%'
          lineHeight: 0,
          // 字间距：数字按 px，字符串支持 '2px' / '0.2em' / '20%'；量测 / 换行 / 渲染 / SVG 同口径
          letterSpacing: 0,
          // 文本装饰线（自绘，canvas 没有原生支持）：'none' | 'underline' | 'line-through' | 'overline'
          //（可空格组合，如 'underline line-through'）；颜色留空时跟随 fillStyle
          textDecoration: 'none',
          textDecorationColor: '',
          textDecorationWidth: 0, //0 = 自动（字号 / 14，至少 1px）
          // 编辑态的选区底色（引擎自绘；DOM 编辑态由浏览器 input/textarea 自己画）。
          // 留空 = 跟随主题 chrome.textSelection；显式给色值则用给定的
          selectionColor: '',
          paddingTop: 0,
          paddingBottom: 0,
          paddingLeft: 0,
          paddingRight: 0,
        },
      },
      props
    );
    param.style = {
      ...param.style,
      font: `${param.style.fontWeight} ${param.style.fontSize}px ${param.style.fontFamily}`, //CanvasRenderingContext2D 只支持 font 属性，这里手动拼接
    };
    return param;
  }

  /**
   * @overwrite
   * 双击进入内联编辑态。
   */
  protected initEvents(): void {
    super.initEvents();
    this.on('dblclick', this.startEditing, this);
  }

  /**
   * 进入编辑前的 draggable 原值，退出编辑时恢复。
   */
  private __originalDraggable = true;

  /**
   * 编辑态叠加的 HTML input（用于支持中文 IME 输入）。浏览器环境下存在；
   * 无 document 的运行时（Node / headless）为 null，降级为 canvas keydown 输入。
   */
  private __editInput: any = null;

  /**
   * 进入内联编辑态：光标定位到文本末尾，隐藏变换面板、禁用拖拽（避免编辑时误拖动）。
   */
  public startEditing(): void {
    this.__originalDraggable = this.state.draggable;
    this.setState({ editing: true, caretIndex: this.state.text.length, draggable: false });
    if (this.ice && this.ice.controlPanelManager) {
      this.ice.controlPanelManager.transformControlPanel.disable();
    }
    // 监听全局 mousedown：点击别处（非自身）时退出编辑
    if (this.ice && this.ice.evtBus) {
      this.ice.evtBus.on('mousedown', this.__globalMouseDownHandler, this);
    }
    // 浏览器环境：叠加 HTML input 捕获输入（支持中文 IME）
    this.__mountEditInput();
  }

  /**
   * 退出内联编辑态（提交文本）。退出后不自动恢复变换面板——用户若需再变换组件，重新点击组件即可。
   */
  public stopEditing(): void {
    if (this.ice && this.ice.evtBus) {
      this.ice.evtBus.off('mousedown', this.__globalMouseDownHandler, this);
    }
    this.__unmountEditInput();
    this.setState({ editing: false, draggable: this.__originalDraggable });
  }

  /**
   * 创建透明的 HTML input 覆盖在文本上，捕获输入（含中文 IME）。
   * input 文字设为透明（canvas 负责显示），只保留可见光标。
   *
   * `multiline`（或文本里已有 `\n`）时改用 `<textarea>`：回车插入换行而不是提交，
   * 选区 / 换行都由浏览器接管（与单行输入同一套「文字透明、只保留光标」的做法）。
   */
  private __mountEditInput(): void {
    const doc = this.root && this.root.document;
    if (!doc || !doc.body) {
      return; // 无 document（Node / headless），降级 canvas keydown
    }
    const box = this.getMinBoundingBox(true);
    const canvasRect = this.ice && this.ice.canvasEl ? this.ice.canvasEl.getBoundingClientRect() : { left: 0, top: 0 };
    const { paddingTop, paddingRight, paddingBottom, paddingLeft } = this.state.style;
    const textWidth = Math.max(this.state.width - paddingLeft - paddingRight, 1);
    const textHeight = Math.max(this.state.height - paddingTop - paddingBottom, this.state.style.fontSize);
    const multiline = this.__isMultilineEditing();

    const input = doc.createElement(multiline ? 'textarea' : 'input');
    if (!multiline) {
      input.type = 'text';
    }
    input.value = this.state.text;
    input.style.position = 'absolute';
    input.style.left = canvasRect.left + box.tl[0] + 'px';
    input.style.top = canvasRect.top + box.tl[1] + 'px';
    input.style.width = textWidth + 'px';
    input.style.height = textHeight + 'px';
    // 用与 canvas 完全相同的 font（含 fontWeight），否则 CSS 文本宽度会与 canvas 不一致，
    // 导致编辑光标无法准确对齐到文本末尾。
    input.style.font = this.state.style.font;
    input.style.paddingTop = paddingTop + 'px';
    input.style.paddingRight = paddingRight + 'px';
    input.style.paddingBottom = paddingBottom + 'px';
    input.style.paddingLeft = paddingLeft + 'px';
    input.style.boxSizing = 'content-box';
    input.style.color = 'transparent'; // 文字透明（canvas 显示），只保留光标
    input.style.caretColor = this.state.style.fillStyle || '#000000';
    input.style.background = 'transparent';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.margin = '0';
    input.style.zIndex = '9999';
    if (multiline) {
      // 多行：保留 \n、不自动折行（折行会与 caretIndex 的原始文本下标错位），不出现滚动条
      input.style.whiteSpace = 'pre';
      input.style.overflow = 'hidden';
      input.style.resize = 'none';
      input.wrap = 'off';
    }
    doc.body.appendChild(input);
    input.focus();
    // 光标定位到末尾（与 canvas 编辑态的光标定位一致）
    input.setSelectionRange(input.value.length, input.value.length);

    /** 把浏览器里的光标 / 选区同步回 state（引擎自绘的选区只用于无 DOM 运行时，这里保持一致）。 */
    const syncSelection = (): void => {
      const start = typeof input.selectionStart === 'number' ? input.selectionStart : -1;
      const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : -1;
      const caretIndex = end >= 0 ? end : this.state.caretIndex;
      if (
        this.state.caretIndex === caretIndex &&
        this.state.selectionStart === start &&
        this.state.selectionEnd === end
      ) {
        return;
      }
      this.setState({ caretIndex, selectionStart: start, selectionEnd: end });
    };

    input.addEventListener('input', () => {
      this.setText(input.value);
      syncSelection();
    });
    input.addEventListener('compositionend', () => {
      this.setText(input.value);
      syncSelection();
    });
    input.addEventListener('select', syncSelection);
    input.addEventListener('keyup', syncSelection);
    input.addEventListener('mouseup', syncSelection);
    input.addEventListener('keydown', (evt: any) => {
      if (evt.isComposing) {
        return;
      }
      if (evt.key === 'Escape') {
        this.stopEditing();
        return;
      }
      if (evt.key === 'Enter') {
        // 多行编辑：回车留给浏览器插入换行；Ctrl/Cmd + Enter 提交
        if (!multiline || evt.ctrlKey || evt.metaKey) {
          this.stopEditing();
        }
      }
    });
    input.addEventListener('blur', () => {
      this.stopEditing();
    });

    this.__editInput = input;
  }

  /**
   * 移除编辑态的 HTML input。
   */
  private __unmountEditInput(): void {
    if (this.__editInput && this.__editInput.parentNode) {
      this.__editInput.parentNode.removeChild(this.__editInput);
    }
    this.__editInput = null;
  }

  /**
   * 全局 mousedown 处理器：点击的组件不是自身时，退出编辑（失焦退出）。
   */
  private __globalMouseDownHandler(evt: any) {
    const clicked = evt && evt.param && evt.param.component;
    if (clicked !== this) {
      this.stopEditing();
    }
  }

  /**
   * 设置文本内容（会重新测量宽高）。
   */
  public setText(text: string): this {
    const caret = Math.max(0, Math.min(this.state.caretIndex, text.length));
    this.setState({ text, caretIndex: caret });
    return this;
  }

  public getText(): string {
    return this.state.text;
  }

  /**
   * 度量前提变了（自定义字体加载完成、主题换字号…）时调用：只标脏，
   * 真正的重算交给下一次 render（`paramsDirty → calcComponentParams → measureText`）。
   * 见 `ICE.remeasureTexts()` 与 `ICE.loadFont()`。
   */
  public remeasureText(): this {
    this.__paramsDirty = true;
    this.dirty = true;
    this.__lineWidthCache = null;
    return this;
  }

  /**
   * 外部**显式**设置 width/height（应用代码，或布局管理器按容器分配尺寸）时，关掉对应方向的
   * 自动量测 —— 否则下一帧 `measureText → __applyMeasuredSize` 会把刚设的尺寸又改回去，
   * 表现为「setState({width}) 不生效」。
   *
   * 与构造函数里「用户是否显式传 width/height」是同一套语义（见 __autoWidth/__autoHeight）。
   */
  protected __beforeStateMerge(newState: any): boolean {
    if (newState) {
      if (newState.width !== undefined) this.__autoWidth = false;
      if (newState.height !== undefined) this.__autoHeight = false;
      // 任何 state 变化都可能改掉行宽（文本 / 字号 / 字间距 / wrap…）：缓存随之失效
      this.__lineWidthCache = null;
    }
    return super.__beforeStateMerge(newState);
  }

  /**
   * @overwrite
   * 编辑态下接管键盘输入：字符插入 / Backspace / Delete / 方向键移动光标 / Enter 提交。
   */
  protected keyboardEvtHandler(evt: any) {
    if (this.__editInput) {
      return; // input 编辑态：所有输入（含 IME）由 HTML input 处理，避免重复
    }
    if (!this.state.editing) {
      super.keyboardEvtHandler(evt);
      return;
    }
    if (evt.type !== 'keydown') return;

    const key = evt.key;
    const text = this.state.text;
    const caret = this.state.caretIndex;

    if (key === 'Escape') {
      this.stopEditing();
      return;
    }
    if (key === 'Enter') {
      // 多行编辑：回车插入换行；单行编辑（默认）：回车提交（既有行为）
      if (this.__isMultilineEditing()) {
        this.setState({ text: text.slice(0, caret) + '\n' + text.slice(caret), caretIndex: caret + 1 });
      } else {
        this.stopEditing();
      }
      return;
    }
    if (key === 'Backspace') {
      if (caret > 0) {
        // 按 **grapheme** 退格：`a👍b` 里删的是整个 emoji，而不是半个代理对（旧实现会留下坏字符）
        const prev = this.__prevGraphemeBoundary(text, caret);
        this.setState({ text: text.slice(0, prev) + text.slice(caret), caretIndex: prev });
      }
      return;
    }
    if (key === 'Delete') {
      if (caret < text.length) {
        const next = this.__nextGraphemeBoundary(text, caret);
        this.setState({ text: text.slice(0, caret) + text.slice(next) });
      }
      return;
    }
    if (key === 'ArrowLeft') {
      this.setState({ caretIndex: this.__prevGraphemeBoundary(text, caret) });
      return;
    }
    if (key === 'ArrowRight') {
      this.setState({ caretIndex: this.__nextGraphemeBoundary(text, caret) });
      return;
    }
    if (key === 'Home') {
      this.setState({ caretIndex: 0 });
      return;
    }
    if (key === 'End') {
      this.setState({ caretIndex: text.length });
      return;
    }
    // 可打印字符（长度为 1，排除修饰键/控制键）
    if (key && key.length === 1) {
      this.setState({ text: text.slice(0, caret) + key + text.slice(caret), caretIndex: caret + 1 });
      return;
    }
  }

  /** caret 之前最近的一个 grapheme 边界（无 DOM 时按 grapheme 移动/退格；DOM 由浏览器负责）。 */
  private __prevGraphemeBoundary(text: string, caret: number): number {
    if (caret <= 0) return 0;
    const gs = this.__graphemes(text.slice(0, caret));
    if (!gs.length) return 0;
    return caret - gs[gs.length - 1].length;
  }

  /** caret 之后最近的一个 grapheme 边界。 */
  private __nextGraphemeBoundary(text: string, caret: number): number {
    if (caret >= text.length) return text.length;
    const gs = this.__graphemes(text.slice(caret));
    if (!gs.length) return text.length;
    return caret + gs[0].length;
  }

  /** 编辑态是否按多行处理：显式 `multiline`，或文本里已经存在 `\n`。 */
  private __isMultilineEditing(): boolean {
    return !!this.state.multiline || String(this.state.text ?? '').indexOf('\n') >= 0;
  }

  /**
   * 每一行的**行盒**（组件本地坐标，原点在盒子中心）：文字左边缘 `x`、行宽 `width`、行带 `top/height`。
   *
   * 三处共用它，避免各算一遍又漂移：光标（renderCaret）、选区（renderSelection）、
   * 坐标 → 下标（getCaretIndexAt）/ 编辑态命中（containsLocalPoint）。
   * 行宽走缓存（第 8 项），不再逐帧 measureText。
   */
  private __lineBoxes(): Array<{ text: string; x: number; width: number; top: number; height: number }> {
    const renderLines = this.getRenderLines();
    const lineCount = Math.max(1, renderLines.length);
    const textHeight = Number(this.state.textHeight) || this.__fontSizePx();
    const lineHeight = textHeight / lineCount;
    const widths = this.__lineWidths(renderLines.map((line) => line.text));
    const fontSize = this.__fontSizePx();
    const ink = this.__inkMetrics || { ascent: fontSize * 0.8, descent: fontSize * 0.2 };
    const font = this.__fontMetrics || { ascent: fontSize * 0.8, descent: fontSize * 0.2 };
    const inkHeight = Math.max(1, ink.ascent + ink.descent);
    // 行带 = 行高；字形墨迹在行带里**居中**（多行的 leading 上下各一半）
    const leading = Math.max(0, lineHeight - inkHeight);
    const boxes: Array<{ text: string; x: number; width: number; top: number; height: number }> = [];
    for (let i = 0; i < renderLines.length; i++) {
      // `renderLines[i].y` 是**基线**，但它的物理含义随 textBaseline 变（见 __inkMetrics 的注释）：
      // 先把它换算成「字母基线」，再按墨迹上下沿铺开，最后把墨迹在行带里居中。
      const mode = this.state.style.textBaseline || 'alphabetic';
      let baselineRef: number;
      if (mode === 'top' || mode === 'hanging') {
        baselineRef = font.ascent; // y = em 盒顶 → 字母基线在下方 fontAscent 处
      } else if (mode === 'middle') {
        baselineRef = (font.ascent - font.descent) / 2; // y = em 盒中心
      } else if (mode === 'bottom' || mode === 'ideographic') {
        baselineRef = -font.descent; // y = em 盒底
      } else {
        baselineRef = 0; // 'alphabetic'：y 就是字母基线
      }
      const baseline = renderLines[i].y + baselineRef;
      const inkTop = baseline - ink.ascent;
      boxes.push({
        text: renderLines[i].text,
        x: renderLines[i].x,
        width: widths[i] || 0,
        top: inkTop - leading / 2,
        height: lineHeight,
      });
    }
    return boxes;
  }

  /**
   * 选中区间（`selectionStart` → `selectionEnd`，按原始文本下标；-1 表示没有选区）。
   *
   * 选区是**编辑**语义：按 `\n` 拆行定位与 `caretIndex` 一致；开启 `wrap` 的非编辑态下
   * 显示行与原始下标不再一一对应（此时不绘制选区，避免画到错误的位置）。
   */
  public getSelection(): { start: number; end: number } {
    const text = String(this.state.text ?? '');
    const start = Number(this.state.selectionStart);
    const end = Number(this.state.selectionEnd);
    if (!(start >= 0) || !(end >= 0)) {
      return { start: -1, end: -1 };
    }
    return {
      start: Math.max(0, Math.min(start, text.length)),
      end: Math.max(0, Math.min(end, text.length)),
    };
  }

  /** 设置选区（终点省略时 = 光标位置，即「没有选中内容」）；DOM 编辑态会同步给 HTML 输入元素。 */
  public setSelection(start: number, end?: number): this {
    const text = String(this.state.text ?? '');
    const clamp = (n: number): number => Math.max(0, Math.min(Number.isFinite(n) ? n : 0, text.length));
    const s = clamp(start);
    const e = clamp(end === undefined ? start : end);
    this.setState({ selectionStart: s, selectionEnd: e, caretIndex: e });
    if (this.__editInput && typeof this.__editInput.setSelectionRange === 'function') {
      this.__editInput.setSelectionRange(s, e);
    }
    return this;
  }

  /** 全选。 */
  public selectAll(): this {
    return this.setSelection(0, String(this.state.text ?? '').length);
  }

  /** 清空选区（保留光标）。 */
  public clearSelection(): this {
    return this.setSelection(this.state.caretIndex, this.state.caretIndex);
  }

  /**
   * 本地坐标 → 光标下标（**按字形**）。
   *
   * 先按 y 选中行带（行外取最近的一行），再在该行的 grapheme 边界里取**离点击点最近的**一个
   * —— 判定用相邻边界的**中点**（点过中点才开始算下一个字符），这是各主流文本编辑器的手感。
   * 返回值是**原始文本**里的下标（含 `\n` 偏移），可直接喂给 `caretIndex`。
   */
  public getCaretIndexAt(localX: number, localY: number): number {
    const text = String(this.state.text ?? '');
    if (!text) {
      return 0;
    }
    if (this.state.lines && !this.state.editing) {
      // 换行显示行与原始下标不是一一对应：退化为「按行首下标」的粗定位
      return 0;
    }
    const boxes = this.__lineBoxes();
    let box = boxes[0];
    let boxIndex = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (localY >= boxes[i].top && localY <= boxes[i].top + boxes[i].height) {
        box = boxes[i];
        boxIndex = i;
        break;
      }
      // 落在行带之间/之外：取最近的一行
      const center = boxes[i].top + boxes[i].height / 2;
      const boxCenter = box.top + box.height / 2;
      if (Math.abs(localY - center) < Math.abs(localY - boxCenter)) {
        box = boxes[i];
        boxIndex = i;
      }
    }
    // 命中行在原始文本里的起始下标（行序与「按 \n 拆」一致）
    let lineStart = 0;
    const sourceLines = text.split('\n');
    for (let i = 0; i < boxIndex && i < sourceLines.length; i++) {
      lineStart += sourceLines[i].length + 1;
    }
    const measure = this.__measureFn();
    const direction = resolveTextDirection(box.text, this.state.direction);
    const graphemes = this.__graphemes(box.text);
    // 边界 k（0..graphemes.length）在视觉上的 x：LTR 从左往右累加，RTL 从右往左累减
    const boundaries: number[] = [];
    let acc = 0;
    for (let k = 0; k < graphemes.length; k++) {
      boundaries.push(acc);
      acc += measure(graphemes[k]) || 0;
    }
    boundaries.push(acc);
    const visualX = (k: number): number =>
      direction === 'rtl' ? box.x + box.width - boundaries[k] : box.x + boundaries[k];
    let best = 0;
    let bestDistance = Infinity;
    for (let k = 0; k <= graphemes.length; k++) {
      const distance = Math.abs(localX - visualX(k));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = k;
      }
    }
    return lineStart + graphemes.slice(0, best).join('').length;
  }

  /**
   * 编辑态下按**文本行**命中（而不是整个盒子）：点在行带之外（如 padding / 盒子右下空白）不算命中。
   * 非编辑态仍是盒子语义 —— 拖动、框选、双击进入编辑这些既有交互都依赖它。
   */
  protected containsLocalPoint(localX: number, localY: number): boolean {
    if (!super.containsLocalPoint(localX, localY)) {
      return false;
    }
    if (!this.state.editing) {
      return true;
    }
    if (!String(this.state.text ?? '')) {
      return true; // 空文本：整个盒子都算命中，否则没法点进去开始输入
    }
    const slop = this.__fontSizePx() * 0.5;
    const boxes = this.__lineBoxes();
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i];
      if (localY < box.top - slop || localY > box.top + box.height + slop) {
        continue;
      }
      const x0 = Math.min(box.x, box.x + box.width) - slop;
      const x1 = Math.max(box.x, box.x + box.width) + slop;
      if (localX >= x0 && localX <= x1) {
        return true;
      }
    }
    return false;
  }

  /**
   * 绘制选区底色（无 DOM 运行时没有浏览器选区；DOM 编辑态下浏览器 input/textarea 自己会画）。
   */
  private renderSelection(): void {
    if (this.__editInput) {
      return;
    }
    const { start, end } = this.getSelection();
    if (!(end > start)) {
      return;
    }
    if (this.state.lines && !this.state.editing) {
      return; // 换行显示行与原始下标不一一对应（见 getSelection 的注释）
    }
    const text = String(this.state.text ?? '');
    const sourceLines = text.split('\n');
    const boxes = this.__lineBoxes();
    // 没显式给色就跟随主题的 chrome.textSelection（深色主题下会换成更协调的选区色）
    const color = this.state.style.selectionColor || this.themeOf().semantic.chrome.textSelection.color;
    if (!color) {
      return;
    }
    const measure = this.__measureFn();
    const direction = resolveTextDirection(text, this.state.direction);
    this.ctx.save();
    this.ctx.fillStyle = color;
    let lineStart = 0;
    for (let i = 0; i < boxes.length && lineStart <= end; i++) {
      const lineText = boxes[i].text;
      const lineEnd = lineStart + lineText.length;
      if (lineEnd >= start) {
        const from = Math.max(0, start - lineStart);
        const to = Math.min(lineText.length, end - lineStart);
        if (to > from) {
          const prefixStart = measure(lineText.slice(0, from)) || 0;
          const prefixEnd = measure(lineText.slice(0, to)) || 0;
          const width = prefixEnd - prefixStart;
          const x = direction === 'rtl' ? boxes[i].x + boxes[i].width - prefixEnd : boxes[i].x + prefixStart;
          this.ctx.fillRect(x, boxes[i].top, width, boxes[i].height);
        }
      }
      lineStart = lineEnd + 1; // +1：跳过分隔符 \n
      if (i >= sourceLines.length - 1) {
        break;
      }
    }
    this.ctx.restore();
  }

  /**
   * 在编辑态下渲染光标（垂直竖线）。
   *
   * 无 DOM 的运行时（Node / headless）没有浏览器 caret 可用，这里自己算位置，三条规则：
   * - **多行**：`caretIndex` 先按 `\n` 折成「第几行 + 行内偏移」，光标画在对应行（旧实现把整段前缀
   *   都量在一个位置上，多行文本里光标会跑到第一行）；
   * - **方向**：RTL 行的阅读起点在右，光标 x 要从右边缘往左量（`rightEdge - measure(前缀)`）；
   * - **对齐**：与 `getRenderLines()` 同一套（left / center / right，start/end 已按方向解析）。
   *
   * DOM 编辑态直接返回 —— 那时光标由 HTML input 的 `caretColor` 接管（浏览器处理 grapheme / IME 更准）。
   */
  private renderCaret(): void {
    if (this.__editInput) {
      return; // input 编辑态：光标由 HTML input 的可见 caretColor 接管
    }
    const text = String(this.state.text ?? '');
    const caret = Math.max(0, Math.min(this.state.caretIndex, text.length));

    // 行盒统一由 __lineBoxes() 提供：对齐（left/center/right，start/end 已解析）、方向、行高
    // 与选区、坐标→下标换算共用一套公式，避免「光标在选区另一头」这类漂移。
    const boxes = this.__lineBoxes();
    let lineIndex = boxes.length - 1;
    let lineStart = 0;
    for (let i = 0; i < boxes.length; i++) {
      const lineEnd = lineStart + boxes[i].text.length;
      if (caret <= lineEnd) {
        lineIndex = i;
        break;
      }
      lineStart = lineEnd + 1; // +1：跳过分隔符 \n
    }
    const box = boxes[lineIndex];
    const offsetInLine = Math.max(0, Math.min(caret - lineStart, box.text.length));
    const prefix = box.text.slice(0, offsetInLine);
    const direction = resolveTextDirection(box.text, this.state.direction);
    const prefixWidth = this.__measureFn()(prefix) || 0;
    // LTR：文字左边缘往右量前缀；RTL：文字右边缘往左量前缀
    const caretX = direction === 'rtl' ? box.x + box.width - prefixWidth : box.x + prefixWidth;
    const caretTop = box.top;
    const caretBottom = box.top + box.height;

    this.ctx.save();
    this.ctx.strokeStyle = this.state.style.fillStyle || '#000000';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(caretX, caretTop);
    this.ctx.lineTo(caretX, caretBottom);
    this.ctx.stroke();
    this.ctx.restore();
  }

  /**
   * @overwrite
   * @method calcComponentParams
   * - 计算组件最原始的宽高和位置，此时没有经过任何变换，也没有移动坐标原点。
   * - 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   * - 此方法不能依赖原点位置和 transform 矩阵。
   * - 此方法会在 render() 中调用，所以不需要在构造函数中调用。
   * - 此方法中不能使用 setState() ，如果需要修改状态，直接赋值，如：this.state.width = 100;
   * - 子类可以覆盖此方法，实现自己的计算逻辑。
   * @returns
   */
  protected calcComponentParams() {
    if (!this.paramsDirty) {
      return { width: this.state.width, height: this.state.height };
    }
    return this.measureText();
  }

  /**
   * 多行文本的行距系数。
   *
   * 为什么不能直接用 `actualBoundingBoxAscent + Descent`（字形墨迹高度）当行距：
   * 墨迹只覆盖「有笔画的部分」，拉丁字母的 cap-height 比 em 小得多 —— 14px Tahoma 的
   * 墨迹高 ≈ 12px，拿它当行距时中文（墨迹接近满 em）会**上下叠在一起**，看起来像文字被压扁。
   * 按字号 × 1.35 取行距更接近系统的自然行高，同时保证 ≥ 墨迹高度（不会挤）。
   */
  private static readonly LINE_HEIGHT_RATIO = 1.35;

  /**
   * @method measureText
   *
   * - Canvas 中没有提供原生的计算文本高度的有效方法，文本宽高的计算需要使用特殊的方法，这里使用的方法来自 https://longviewcoder.com/2021/02/11/html5-canvas-text-line-height-measurement/
   * - 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * - 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   *
   * FIXME:这里有性能瓶颈，需要进一步优化
   * FIXME:某些运行时环境可能不支持动态插入 HTML 标签，以上测量文本宽高的方法可能存在兼容性问题。
   * FIXME:对文本位置的控制需要更精细的计算方法。
   */
  private measureText(evt?: ICEEvent) {
    // 0) 自动换行：只有显式开启 wrap 且给了可用宽度、且不在编辑态时才重排。
    //    编辑态不换行，避免 caretIndex（按原始文本计）与显示行错位。
    //    没开 wrap 时走「按盒子宽度截断」——两者都只写 state.lines（派生缓存，不进快照），
    //    画布渲染与 SVG 导出共用 getRenderLines()，所以两处必然同口径。
    this.state.lines = this.__computeWrappedLines() || this.__computeTruncatedLines();

    // 优先用 Canvas 的真实字形边界测量，避免 DOM line-height 的 leading 造成 padding 偏差。
    const canvas = this.__measureByCanvas();
    if (canvas) {
      this.__applyMeasuredSize(canvas);
      return { width: this.state.width, height: this.state.height };
    }
    return this.__measureByDOM();
  }

  /**
   * 计算换行后的行数组；返回 null 表示「不换行，按 \n 拆」。
   */
  private __computeWrappedLines(): string[] | null {
    if (!this.state.wrap || this.state.editing) return null;
    const maxWidth = Number(this.state.width);
    if (!(maxWidth > 0)) return null;
    const ctx: any = this.ctx;
    if (!ctx || typeof ctx.measureText !== 'function') return null;

    const measure = this.__measureFn();
    const lines = this.__wrapText(maxWidth, measure);
    return this.__truncateLines(
      lines,
      maxWidth,
      Number(this.state.maxLines) || 0,
      String(this.state.ellipsis ?? '…'),
      measure
    );
  }

  /**
   * **非换行路径**的溢出处理：把每一行截断到盒子内宽（默认追加省略号）。
   *
   * 为什么必须有这一步：调用方给了显式宽度（例如 `ICELabel({ width })`）而文本更长时，
   * 以前是把宽度当 `fillText(..., maxWidth)` 传下去 —— canvas 会**横向压扁字形**，
   * 文字变形成一团（smart-water 顶部 Message 的实测事故）。溢出只能截断或溢出，不能变形。
   *
   * 返回 null 表示「没有一行溢出」：保持原有的零分配快路径。
   * - 自动宽度的文本（调用方没给 width）盒子就是按文字量出来的，不可能溢出；
   * - `textOverflow: 'clip'` 让调用方自己决定怎么裁；
   * - 编辑态不截断：caret / 选区是按**原始文本**算的，截断会让光标与文字错位。
   */
  private __computeTruncatedLines(): string[] | null {
    if (this.state.editing) return null;
    if (String(this.state.textOverflow ?? 'ellipsis') !== 'ellipsis') return null;
    if (this.__autoWidth) return null;
    const width = Number(this.state.width);
    if (!(width > 0)) return null;
    const ctx: any = this.ctx;
    if (!ctx || typeof ctx.measureText !== 'function') return null;
    const { paddingLeft, paddingRight } = this.state.style;
    const available = width - (Number(paddingLeft) || 0) - (Number(paddingRight) || 0);
    if (!(available > 0)) return null;

    const measure = this.__measureFn();
    const ellipsis = String(this.state.ellipsis ?? '…');
    let overflowed = false;
    const out = String(this.state.text ?? '')
      .split('\n')
      .map((line) => {
        if (measure(line) <= available) return line;
        overflowed = true;
        return this.__ellipsizeToWidth(line, available, ellipsis, measure);
      });
    return overflowed ? out : null;
  }

  /** 逐 grapheme 回退，直到「内容 + 省略号」放得下；放不下时至少保留省略号本身。 */
  private __ellipsizeToWidth(line: string, maxWidth: number, ellipsis: string, measure: (s: string) => number): string {
    const gs = this.__graphemes(line);
    while (gs.length > 0 && measure(gs.join('') + ellipsis) > maxWidth) {
      gs.pop();
    }
    return gs.join('') + ellipsis;
  }

  /** 统一的测宽函数：优先 ctx.measureText；无 ctx 时按 fontSize 粗估。 */
  private __measureFn(): (s: string) => number {
    const ctx: any = this.ctx;
    if (this.state.style.font && ctx && typeof ctx.measureText === 'function') {
      ctx.font = this.state.style.font;
    }
    // 字间距必须**在量测之前**写进 ctx：canvas 的 measureText 会把 letterSpacing 算进宽度
    //（含最后一个字符后面的间距，与 fillText 的排版一致），我们自己再补一遍就会多算。
    this.__applyLetterSpacingToCtx();
    const fallbackChar = Number(this.state.style.fontSize) || 12;
    return (s: string): number => {
      if (ctx && typeof ctx.measureText === 'function') {
        const m = ctx.measureText(s);
        return (m && m.width) || 0;
      }
      return s.length * fallbackChar;
    };
  }

  /** 字号（px）：所有相对单位（em / %）与默认行高都按它折算。 */
  private __fontSizePx(): number {
    return Number(this.state.style.fontSize) || 12;
  }

  /** 把 `style.letterSpacing`（数字 / '2px' / '0.2em' / '20%'）归一成 CSS 值写进 ctx。 */
  private __applyLetterSpacingToCtx(): void {
    const ctx: any = this.ctx;
    if (!ctx || !('letterSpacing' in ctx)) {
      return; // 运行时没有 letterSpacing（测试桩 / 老浏览器）：不影响其它口径
    }
    ctx.letterSpacing = resolveLetterSpacingCss(this.state.style.letterSpacing, this.__fontSizePx());
  }

  /**
   * 每一行的行高（px）：
   * - 显式配置（数字 px / 字符串）→ 用它，单行也照用（盒子高度可预测）；
   * - 未配置 → `max(墨迹高, 字号 × 1.35)`（见 LINE_HEIGHT_RATIO 的注释）。
   */
  private __lineAdvance(inkHeight: number): number {
    const explicit = resolveLineHeightPx(this.state.style.lineHeight, this.__fontSizePx());
    if (explicit !== null) {
      return explicit;
    }
    return Math.max(inkHeight, this.__fontSizePx() * ICEText.LINE_HEIGHT_RATIO);
  }

  /**
   * 按 grapheme cluster 切分。
   * 优先 Intl.Segmenter（Baseline 2024），能把 emoji / ZWJ 序列 / 组合字符合成一个单元；
   * 不可用时退化为码点切分（至少不会把代理对拆开）。
   *
   * 实现放在 `text-wrap.ts`（断行策略共用同一份切分 + 缓存）。
   */
  private __graphemes(s: string): string[] {
    return splitGraphemes(s, this.root && this.root.Intl);
  }

  /**
   * 换行：保留段落自身的 `\n`，段内按 `state.wordBreak` 策略断行。
   *
   * 断行规则是**排版**职责（见 `text-wrap.ts`）：`'normal'` 下拉丁词不被硬拆、CJK 逐字断并做禁则；
   * `'break-all'` 保留旧的逐 grapheme 贪心。i18n 词条本身由应用层提供，这里不做任何文本加工。
   */
  private __wrapText(maxWidth: number, measure: (s: string) => number): string[] {
    const out: string[] = [];
    const paragraphs = String(this.state.text ?? '').split('\n');
    const strategy: ICEWordBreak = this.state.wordBreak === 'break-all' ? 'break-all' : 'normal';
    const intl: any = this.root && this.root.Intl;
    for (let p = 0; p < paragraphs.length; p++) {
      const lines = wrapParagraph(paragraphs[p], maxWidth, measure, strategy, intl);
      for (let i = 0; i < lines.length; i++) {
        out.push(lines[i]);
      }
    }
    return out;
  }

  /**
   * 超过 maxLines 时截断末行并追加省略号；逐 grapheme 回退直到「内容+省略号」放得下。
   */
  private __truncateLines(
    lines: string[],
    maxWidth: number,
    maxLines: number,
    ellipsis: string,
    measure: (s: string) => number
  ): string[] {
    if (!(maxLines > 0) || lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = this.__ellipsizeToWidth(kept[maxLines - 1], maxWidth, ellipsis, measure);
    return kept;
  }

  /** 用 Canvas TextMetrics.actualBoundingBox* 测量文本真实宽高；不支持则返回 null 降级。 */
  private __measureByCanvas(): { textWidth: number; textHeight: number } | null {
    if (!this.ctx || typeof this.ctx.measureText !== 'function') return null;
    if (this.state.style.font) {
      this.ctx.font = this.state.style.font;
    }
    // 字间距先进 ctx：下面每一行的 measureText 都要含它（与换行 / 渲染 / 导出同一口径）
    this.__applyLetterSpacingToCtx();
    const lines: string[] = this.state.lines || String(this.state.text ?? '').split('\n');
    let textWidth = 0;
    let maxAscent = 0;
    let maxDescent = 0;
    let fontAscent = 0;
    let fontDescent = 0;
    // 顺手把每一行的宽度记进缓存（第 8 项）：居中 / 右对齐 / 装饰线 / 光标都要用，
    // 否则它们每帧各自 measureText 一遍。
    const lineWidths: number[] = [];
    for (const line of lines) {
      const m = this.ctx.measureText(line);
      const lineWidth = m.width || 0;
      lineWidths.push(lineWidth);
      textWidth = Math.max(textWidth, lineWidth);
      const a = m.actualBoundingBoxAscent;
      const d = m.actualBoundingBoxDescent;
      if (typeof a !== 'number' || typeof d !== 'number') return null; // 环境不支持，降级 DOM
      maxAscent = Math.max(maxAscent, a);
      maxDescent = Math.max(maxDescent, d);
      // 字体 em 盒（可选）：用于把基线语义换算成行带，缺失时按字号粗估
      const fa = (m as any).fontBoundingBoxAscent;
      const fd = (m as any).fontBoundingBoxDescent;
      if (typeof fa === 'number' && typeof fd === 'number') {
        fontAscent = Math.max(fontAscent, fa);
        fontDescent = Math.max(fontDescent, fd);
      }
    }
    this.__cacheLineWidths(lines, lineWidths);
    this.__inkMetrics = { ascent: maxAscent, descent: maxDescent };
    if (fontAscent > 0 || fontDescent > 0) {
      this.__fontMetrics = { ascent: fontAscent, descent: fontDescent };
    } else {
      const fontSize = this.__fontSizePx();
      this.__fontMetrics = { ascent: fontSize * 0.8, descent: fontSize * 0.2 };
    }
    const lineHeight = maxAscent + maxDescent;
    // 显式配了 lineHeight 时，单行也按它算盒高（否则「我给了行高」在单行文本上看不出效果）。
    const explicitLineHeight = resolveLineHeightPx(this.state.style.lineHeight, this.__fontSizePx());
    // 单行且没配 lineHeight：保持「盒子贴合字形墨迹」的既有行为（全库的居中/对齐都按它调过）。
    if (lines.length <= 1 && explicitLineHeight === null) {
      return { textWidth, textHeight: lineHeight };
    }
    // 多行：行距取 max(墨迹高, 字号 × 1.35) × 行数 —— 否则行与行会重叠。
    const advance = this.__lineAdvance(lineHeight);
    return { textWidth, textHeight: advance * lines.length };
  }

  private __applyMeasuredSize(s: { textWidth: number; textHeight: number }): void {
    const { paddingTop, paddingBottom, paddingLeft, paddingRight } = this.state.style;
    const width = s.textWidth + paddingLeft + paddingRight;
    const height = s.textHeight + paddingTop + paddingBottom;
    // 「自动尺寸」以**用户是否显式传了 width/height** 判断（`arrangeParam` 的默认值恰好也是 10，
    // 拿 10 当哨兵会让「我就要一个 10×10 的文本框」被引擎悄悄改大）。
    if (this.__autoWidth) {
      this.state.width = width;
    }
    if (this.__autoHeight) {
      this.state.height = height;
    }
    this.state.textHeight = s.textHeight;
  }

  /** DOM 降级测量：line-height 归一为 1，减少 leading 干扰（旧浏览器 / headless）。 */
  private __measureByDOM() {
    let div;
    try {
      // 无 DOM 的运行时（Node / headless）：这里没有可用的降级量测。
      // 直接按当前 state 尺寸兜底，别靠抛异常走到 catch —— 那会在控制台刷一堆错误日志。
      const doc: any = this.root && this.root.document;
      if (!doc || typeof doc.getElementById !== 'function') {
        return { width: this.state.width, height: this.state.height };
      }
      div = this.root.document.getElementById(utilDivId);
      if (!div) {
        div = this.root.document.createElement('div');
        div.setAttribute('id', utilDivId);
        const styleObj = {
          visibility: 'hidden',
          position: 'absolute',
          top: '0',
          left: '0',
          padding: '0',
          margin: '0',
          border: 'none',
          fontFamily: this.state.style.fontFamily,
          fontWeight: this.state.style.fontWeight,
          fontSize: this.state.style.fontSize + 'px',
          // 字间距 / 行高：与 canvas 路径同口径（数字按 px，相对单位按字号折算）
          letterSpacing: resolveLetterSpacingCss(this.state.style.letterSpacing, this.__fontSizePx()),
          lineHeight: '1',
          // 用 white-space:pre 保留 \n 换行，替代旧的 <br> 拼接（后者是 HTML 注入面）
          whiteSpace: 'pre',
        };
        const explicitLineHeight = resolveLineHeightPx(this.state.style.lineHeight, this.__fontSizePx());
        if (explicitLineHeight !== null) {
          styleObj.lineHeight = explicitLineHeight + 'px';
        }
        for (const key in styleObj) {
          div.style[key] = styleObj[key];
        }
        div.contenteditable = false;
        this.root.document.body.appendChild(div);
      }

      // 安全：文本内容一律走 textContent（旧实现用 innerHTML 拼接 <br>，用户文本里的
      // `<img onerror=...>` 之类会被当作 HTML 执行）。换行由 white-space:pre 负责。
      div.textContent = this.state.text;

      const { paddingTop, paddingBottom, paddingLeft, paddingRight } = this.state.style;
      const cssSize = {
        width: div.offsetWidth + paddingLeft + paddingRight,
        height: div.offsetHeight + paddingTop + paddingBottom,
      };
      // 重要：只覆盖「用户没显式传」的 width/height，保留用户值。
      // 否则 textAlign center 等文字居中逻辑会因为 localOrigin = width/2 被 div 实际宽度覆盖而错位。
      // 只写 state，不改 props（props 是不可变构造入参）。
      if (this.__autoWidth) {
        this.state.width = cssSize.width;
      }
      if (this.__autoHeight) {
        this.state.height = cssSize.height;
      }
      this.state.textHeight = div.offsetHeight; // 纯文本高度（不含 padding），供多行 baseline 计算
      return { width: this.state.width, height: this.state.height };
    } catch (err) {
      console.error(err);
      return { width: this.state.width, height: this.state.height };
    }
  }

  /** 行宽缓存的 key：行内容 + 字体 + 字间距（三者任一变了，行宽就不可信）。 */
  private __lineWidthsKey(lines: string[]): string {
    return (
      lines.join('\u0000') +
      '\u0001' +
      (this.state.style.font || '') +
      '\u0001' +
      resolveLetterSpacingCss(this.state.style.letterSpacing, this.__fontSizePx())
    );
  }

  /** 记下量测阶段算好的行宽（`__measureByCanvas` 专用）。 */
  private __cacheLineWidths(lines: string[], widths: number[]): void {
    this.__lineWidthCache = { key: this.__lineWidthsKey(lines), widths: widths.slice() };
  }

  /**
   * 取逐行宽度：命中缓存直接返回；未命中也**只量这一次**（结果写回缓存）。
   */
  private __lineWidths(lines: string[], measure?: (s: string) => number): number[] {
    const key = this.__lineWidthsKey(lines);
    const cached = this.__lineWidthCache;
    if (cached && cached.key === key && cached.widths.length === lines.length) {
      return cached.widths;
    }
    const fn = measure || this.__measureFn();
    const widths: number[] = [];
    for (let i = 0; i < lines.length; i++) {
      widths.push(fn(lines[i]) || 0);
    }
    this.__lineWidthCache = { key, widths };
    return widths;
  }

  /**
   * 文本的**渲染行布局**：每一行的内容与基线坐标（组件本地坐标）。
   *
   * 画布渲染与 SVG 导出共用这一份口径 —— 两处各算一遍必然漂移（改了对齐公式忘了另一处，
   * 表现为「导出的文字整体偏移」）。返回的 `x` 是**文字左边缘**（左/居中/右对齐都按画布公式算好），
   * `y` 是 baseline 位置。
   */
  public getRenderLines(): Array<{ text: string; x: number; y: number }> {
    const { paddingTop, paddingLeft, paddingRight, textAlign, textBaseline } = this.state.style;
    // 方向与对齐都要先解析：`direction: 'auto'` → ltr/rtl，`textAlign: 'start' | 'end'` → 物理左右
    const direction = this.__resolvedDirection();
    const align = resolveTextAlign(textAlign, direction);
    // 多行文本：优先用换行结果（state.lines），否则按 \n 拆分；
    // 行高用实测的文本总高均分，保证单行与旧基线一致。
    const lines: string[] = this.state.lines || String(this.state.text ?? '').split('\n');
    const textHeight = this.state.textHeight || this.state.style.fontSize;
    const lineHeight = textHeight / lines.length;
    // 水平居右 / 居中必须按各行真实文字宽度计算起点；左对齐沿用 box 左内边距，不需要行宽。
    // 行宽走缓存（第 8 项）：量测阶段已经逐行量过，这里不再重复 measureText。
    const needHAlign = align === 'center' || align === 'right';
    const lineWidths = needHAlign ? this.__lineWidths(lines) : null;
    const result: Array<{ text: string; x: number; y: number }> = [];
    for (let i = 0; i < lines.length; i++) {
      // x 按 textAlign（默认左对齐，与旧行为一致）
      let x = 0 - this.state.localOrigin[0] + paddingLeft;
      if (needHAlign) {
        const lineWidth = lineWidths ? lineWidths[i] || 0 : 0;
        if (align === 'center') {
          x = -lineWidth / 2; // 文字水平中心对齐 localOrigin 中心
        } else {
          // 文字右边缘对齐 box 右内边距处（flush-right）；旧实现把起点放在 box 右缘，导致文字向右溢出
          x = this.state.localOrigin[0] - paddingRight - lineWidth;
        }
      }

      // baselineY 按 textBaseline（默认 bottom，与旧行为一致）
      let baselineY = 0 - this.state.localOrigin[1] + paddingTop + (i + 1) * lineHeight;
      if (textBaseline === 'middle') {
        // 文字垂直中心对齐 localOrigin 中心；多行整体居中
        baselineY = (i - (lines.length - 1) / 2) * lineHeight;
      }
      result.push({ text: lines[i], x, y: baselineY });
    }
    return result;
  }

  /**
   * @method doRender
   * @overwrite
   * 文本是基于 baseline 绘制的，文本是从 y 坐标向屏幕上方绘制的，48 是文本高度，这里需要补偿文本高度。
   * 同时把移动坐标轴原点的偏移量计算进去。
   */
  protected doRender() {
    this.dirty && this.measureText();
    const align = resolveTextAlign(this.state.style.textAlign, this.__resolvedDirection());
    const lines = this.getRenderLines();
    const needHAlign = align === 'center' || align === 'right';
    if (needHAlign) {
      // 下面的 x 是「文字起点（左边缘）」语义，靠手工计算实现对齐。
      // 而 applyStyleToCtx() 已经把 style.textAlign 写进了 ctx —— 若不复位，canvas 会按
      // ctx.textAlign 再对齐一次，文字整体再左偏半个（center）或一个（right）文字宽度。
      // 实测（admin 示例）：按钮 "New Order" x=-35.51 + ctx.textAlign='center'，文字中心左偏 35.5px；
      // 头像字母因此偏出圆形。复位成 left 后与下方公式一致。
      this.ctx.textAlign = 'left';
    }

    // 选区底色画在文字**下面**（无 DOM 运行时没有浏览器选区，由引擎自绘；DOM 编辑态交给浏览器）
    this.renderSelection();

    for (let i = 0; i < lines.length; i++) {
      if (this.state.stroke) {
        this.ctx.strokeText(lines[i].text, lines[i].x, lines[i].y);
      }
      if (this.state.fill) {
        // 第 4 个参数（maxWidth）会让 canvas **横向压扁**字形，不是截断 —— 溢出已经在
        // `__computeTruncatedLines()` 里按省略号处理过了（或由 textOverflow: 'clip' 显式接管）。
        this.ctx.fillText(lines[i].text, lines[i].x, lines[i].y);
      }
    }

    // 文本装饰线（下划线 / 删除线 / 上划线）：canvas 没有原生支持，引擎自绘。
    // 位置用字号比例推导（与 SVG 的 text-decoration 口径一致：都贴着基线）。
    this.__drawTextDecoration(lines);

    // 编辑态下渲染光标
    if (this.state.editing) {
      this.renderCaret();
    }
    super.doRender();
  }

  /**
   * 自绘文本装饰线。
   *
   * - 横向范围取**每一行自己的宽度**（缓存里的行宽，必要时补量一次），居右/居中/RTL 下才对得上文字；
   * - 基线偏移按字号比例：下划线 `+0.12em`、删除线 `-0.30em`、上划线 `-0.80em`（与主流排版接近）；
   * - 颜色：`style.textDecorationColor` 优先，留空跟随 `fillStyle`；粗细 `style.textDecorationWidth`
   *   留 0 时按 `字号 / 14`（至少 1px）。
   */
  private __drawTextDecoration(lines: Array<{ text: string; x: number; y: number }>): void {
    const decorations = resolveTextDecorations(this.state.style.textDecoration);
    if (!decorations.length) {
      return;
    }
    // 文字本身不可见（fill:false）且没显式指定装饰色时，装饰线也不画 —— 避免「空盒子却有横线」
    const color = this.state.style.textDecorationColor || (this.state.fill ? this.state.style.fillStyle : '');
    if (!color) {
      return;
    }
    const fontSize = this.__fontSizePx();
    const width =
      Number(this.state.style.textDecorationWidth) > 0
        ? Number(this.state.style.textDecorationWidth)
        : Math.max(1, fontSize / 14);
    const offsets: Record<string, number> = {
      underline: fontSize * 0.12,
      'line-through': -fontSize * 0.3,
      overline: -fontSize * 0.8,
    };
    const widths = this.__lineWidths(lines.map((line) => line.text));
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
    for (let i = 0; i < lines.length; i++) {
      const lineWidth = widths[i] || 0;
      if (!(lineWidth > 0)) {
        continue;
      }
      for (const decoration of decorations) {
        const y = lines[i].y + (offsets[decoration] || 0);
        this.ctx.beginPath();
        this.ctx.moveTo(lines[i].x, y);
        this.ctx.lineTo(lines[i].x + lineWidth, y);
        this.ctx.stroke();
      }
    }
    this.ctx.restore();
  }

  /**
   * `direction: 'auto'` 需要按文本解析成具体的 ltr/rtl —— canvas 只认 `ltr | rtl | inherit`，
   * 所以这里在通用 style 应用之后覆盖一次（`style.direction` 的原始值 `'auto'` 不会被 canvas 采纳）。
   *
   * 特性检测用 `'direction' in ctx`（不读值）：**不支持 `direction` 的运行时**（老浏览器、
   * 极简测试桩）就跳过，退化为默认 LTR —— 这也是"不能依赖 `direction`"这条兼容纪律的来源。
   */
  protected applyStyleToCtx(): void {
    super.applyStyleToCtx();
    const ctx: any = this.ctx;
    // 字间距：通用透传会把 `letterSpacing: 10`（数字）原样写进 ctx，各运行时对非字符串的容错不一致
    //（Chromium 会归一成 '10px'，其它实现可能直接忽略），这里统一成 px 字符串；相对单位按字号折算。
    this.__applyLetterSpacingToCtx();
    if (ctx && 'direction' in ctx) {
      ctx.direction = this.__resolvedDirection();
      this.__directionApplied = true;
    }
  }

  /** 本帧是否把 `ctx.direction` 写过（用于渲染结束后的归位）。 */
  private __directionApplied = false;

  /**
   * @overwrite
   * 除基类的泄漏属性外，`direction` 也要归位 —— 否则 RTL 文本会把方向"漏"给后面绘制的组件，
   * 破坏「组件渲染自包含」这条铁律（脏矩形局部重绘与离屏缓存都依赖它）。
   */
  public __resetLeakyCtxState(): void {
    if (this.__directionApplied) {
      this.__directionApplied = false;
      const ctx: any = this.ctx;
      if (ctx && 'direction' in ctx) {
        ctx.direction = 'inherit';
      }
    }
    super.__resetLeakyCtxState();
  }

  /** 解析后的文字方向（`'auto'` → 按首个强方向字符判定）。 */
  private __resolvedDirection(): 'ltr' | 'rtl' {
    return resolveTextDirection(String(this.state.text ?? ''), this.state.direction);
  }
}

export default ICEText;
