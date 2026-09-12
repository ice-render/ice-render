/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import { merge } from '../../util/lang';
import ICEEvent from '../../event/ICEEvent';
import ICEComponent from '../ICEComponent';

const utilDivId = '__ICE_UTILS_TEXT_MEASURE_DIV__';

/**
 * TODO:draw text along Path2D
 * @class ICEText 文本
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEText extends ICEComponent {
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
    this.measureText();
  }

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
        wrap: false, //是否按 state.width 自动换行（默认关，保持既有「按 \n 拆行」行为）
        maxLines: 0, //最大行数（0 = 不限）；超出时末行以 ellipsis 截断
        ellipsis: '…', //截断时追加的省略号
        lines: null, //派生：换行后的行数组（不序列化，随 measureText 重算）
        transformable: false, //文本默认不显示变换手柄（选中时只允许拖动），需变换时显式设 true
        style: {
          fontWeight: 'bold',
          fontSize: 32,
          fontFamily: 'Arial',
          lineWidth: 1,
          textBaseline: 'bottom', //@see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
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
   * 无 document 的运行时（Node/小程序）为 null，降级为 canvas keydown 输入。
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
   */
  private __mountEditInput(): void {
    const doc = this.root && this.root.document;
    if (!doc || !doc.body) {
      return; // 无 document（Node/小程序），降级 canvas keydown
    }
    const box = this.getMinBoundingBox(true);
    const canvasRect = this.ice && this.ice.canvasEl ? this.ice.canvasEl.getBoundingClientRect() : { left: 0, top: 0 };
    const { paddingTop, paddingRight, paddingBottom, paddingLeft } = this.state.style;
    const textWidth = Math.max(this.state.width - paddingLeft - paddingRight, 1);
    const textHeight = Math.max(this.state.height - paddingTop - paddingBottom, this.state.style.fontSize);

    const input = doc.createElement('input');
    input.type = 'text';
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
    doc.body.appendChild(input);
    input.focus();
    // 光标定位到末尾（与 canvas 编辑态的光标定位一致）
    input.setSelectionRange(input.value.length, input.value.length);

    input.addEventListener('input', () => {
      this.setText(input.value);
    });
    input.addEventListener('compositionend', () => {
      this.setText(input.value);
    });
    input.addEventListener('keydown', (evt: any) => {
      if ((evt.key === 'Enter' || evt.key === 'Escape') && !evt.isComposing) {
        this.stopEditing();
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

    if (key === 'Enter' || key === 'Escape') {
      this.stopEditing();
      return;
    }
    if (key === 'Backspace') {
      if (caret > 0) {
        this.setState({ text: text.slice(0, caret - 1) + text.slice(caret), caretIndex: caret - 1 });
      }
      return;
    }
    if (key === 'Delete') {
      if (caret < text.length) {
        this.setState({ text: text.slice(0, caret) + text.slice(caret + 1) });
      }
      return;
    }
    if (key === 'ArrowLeft') {
      this.setState({ caretIndex: Math.max(0, caret - 1) });
      return;
    }
    if (key === 'ArrowRight') {
      this.setState({ caretIndex: Math.min(text.length, caret + 1) });
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

  /**
   * 在编辑态下渲染光标（垂直竖线），位置由 caretIndex + ctx.measureText 计算。
   */
  private renderCaret(): void {
    if (this.__editInput) {
      return; // input 编辑态：光标由 HTML input 的可见 caretColor 接管
    }
    const { paddingTop, paddingBottom, paddingLeft } = this.state.style;
    const textBefore = this.state.text.slice(0, this.state.caretIndex);
    let caretX = 0 - this.state.localOrigin[0] + paddingLeft;
    if (typeof this.ctx.measureText === 'function') {
      caretX += this.ctx.measureText(textBefore).width;
    }
    const caretTop = 0 - this.state.localOrigin[1] + paddingTop;
    const caretBottom = 0 - this.state.localOrigin[1] + this.state.height - paddingBottom;

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
    this.state.lines = this.__computeWrappedLines();

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

  /** 统一的测宽函数：优先 ctx.measureText；无 ctx 时按 fontSize 粗估。 */
  private __measureFn(): (s: string) => number {
    const ctx: any = this.ctx;
    if (this.state.style.font && ctx && typeof ctx.measureText === 'function') {
      ctx.font = this.state.style.font;
    }
    const fallbackChar = Number(this.state.style.fontSize) || 12;
    return (s: string): number => {
      if (ctx && typeof ctx.measureText === 'function') {
        const m = ctx.measureText(s);
        return (m && m.width) || 0;
      }
      return s.length * fallbackChar;
    };
  }

  /**
   * 按 grapheme cluster 切分。
   * 优先 Intl.Segmenter（Baseline 2024），能把 emoji / ZWJ 序列 / 组合字符合成一个单元；
   * 不可用时退化为码点切分（至少不会把代理对拆开）。
   */
  private __graphemes(s: string): string[] {
    const intl: any = this.root && this.root.Intl;
    if (intl && typeof intl.Segmenter === 'function') {
      try {
        const seg = new intl.Segmenter(undefined, { granularity: 'grapheme' });
        const out: string[] = [];
        for (const part of seg.segment(s)) {
          out.push(part.segment);
        }
        return out;
      } catch (err) {
        // 某些实现不支持 granularity → 退化
      }
    }
    return Array.from(s);
  }

  /** 贪心换行：逐 grapheme 累加，超过可用宽度即断行。保留段落自身的 \n。 */
  private __wrapText(maxWidth: number, measure: (s: string) => number): string[] {
    const out: string[] = [];
    const paragraphs = String(this.state.text ?? '').split('\n');
    for (let p = 0; p < paragraphs.length; p++) {
      const gs = this.__graphemes(paragraphs[p]);
      let line = '';
      for (let i = 0; i < gs.length; i++) {
        const next = line + gs[i];
        if (line !== '' && measure(next) > maxWidth) {
          out.push(line);
          line = gs[i];
        } else {
          line = next;
        }
      }
      out.push(line);
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
    const gs = this.__graphemes(kept[maxLines - 1]);
    while (gs.length > 0 && measure(gs.join('') + ellipsis) > maxWidth) {
      gs.pop();
    }
    kept[maxLines - 1] = gs.join('') + ellipsis;
    return kept;
  }

  /** 用 Canvas TextMetrics.actualBoundingBox* 测量文本真实宽高；不支持则返回 null 降级。 */
  private __measureByCanvas(): { textWidth: number; textHeight: number } | null {
    if (!this.ctx || typeof this.ctx.measureText !== 'function') return null;
    if (this.state.style.font) {
      this.ctx.font = this.state.style.font;
    }
    const lines: string[] = this.state.lines || String(this.state.text ?? '').split('\n');
    let textWidth = 0;
    let maxAscent = 0;
    let maxDescent = 0;
    for (const line of lines) {
      const m = this.ctx.measureText(line);
      textWidth = Math.max(textWidth, m.width || 0);
      const a = m.actualBoundingBoxAscent;
      const d = m.actualBoundingBoxDescent;
      if (typeof a !== 'number' || typeof d !== 'number') return null; // 环境不支持，降级 DOM
      maxAscent = Math.max(maxAscent, a);
      maxDescent = Math.max(maxDescent, d);
    }
    const lineHeight = maxAscent + maxDescent;
    // 单行：保持「盒子贴合字形墨迹」的既有行为（全库的居中/对齐都按它调过）。
    // 多行：行距取 max(墨迹高, 字号 × 1.35) × 行数 —— 否则行与行会重叠。
    if (lines.length <= 1) {
      return { textWidth, textHeight: lineHeight };
    }
    const fontSize = Number(this.state.style.fontSize) || lineHeight || 12;
    const advance = Math.max(lineHeight, fontSize * ICEText.LINE_HEIGHT_RATIO);
    return { textWidth, textHeight: advance * lines.length };
  }

  private __applyMeasuredSize(s: { textWidth: number; textHeight: number }): void {
    const { paddingTop, paddingBottom, paddingLeft, paddingRight } = this.state.style;
    const width = s.textWidth + paddingLeft + paddingRight;
    const height = s.textHeight + paddingTop + paddingBottom;
    if (this.props.width === 10) {
      this.state.width = width;
    }
    if (this.props.height === 10) {
      this.state.height = height;
    }
    this.state.textHeight = s.textHeight;
  }

  /** DOM 降级测量：line-height 归一为 1，减少 leading 干扰（旧环境/小程序）。 */
  private __measureByDOM() {
    let div;
    try {
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
          lineHeight: '1',
          // 用 white-space:pre 保留 \n 换行，替代旧的 <br> 拼接（后者是 HTML 注入面）
          whiteSpace: 'pre',
        };
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
      // 重要：只覆盖"用户没显式传"的 width/height（默认 10/10 作 sentinel），保留用户值。
      // 否则 textAlign center 等文字居中逻辑会因为 localOrigin = width/2 被 div 实际宽度覆盖而错位。
      // 只写 state，不改 props（props 是不可变构造入参，后续帧仍需依赖 sentinel 判断）。
      if (this.props.width === 10) {
        this.state.width = cssSize.width;
      }
      if (this.props.height === 10) {
        this.state.height = cssSize.height;
      }
      this.state.textHeight = div.offsetHeight; // 纯文本高度（不含 padding），供多行 baseline 计算
      return { width: this.state.width, height: this.state.height };
    } catch (err) {
      console.error(err);
      return { width: this.state.width, height: this.state.height };
    }
  }

  /**
   * @method doRender
   * @overwrite
   * 文本是基于 baseline 绘制的，文本是从 y 坐标向屏幕上方绘制的，48 是文本高度，这里需要补偿文本高度。
   * 同时把移动坐标轴原点的偏移量计算进去。
   */
  protected doRender() {
    this.dirty && this.measureText();
    const { paddingTop, paddingBottom, paddingLeft, paddingRight, textAlign, textBaseline } = this.state.style;
    // 多行文本：优先用换行结果（state.lines），否则按 \n 拆分；
    // 行高用实测的文本总高均分，保证单行与旧基线一致。
    const lines: string[] = this.state.lines || String(this.state.text ?? '').split('\n');
    const textHeight = this.state.textHeight || this.state.style.fontSize;
    const lineHeight = textHeight / lines.length;
    // 水平居右 / 居中必须按各行真实文字宽度计算起点；左对齐沿用 box 左内边距，免逐行 measureText。
    const needHAlign = textAlign === 'center' || textAlign === 'right' || textAlign === 'end';
    const measure = needHAlign ? this.__measureFn() : null;
    if (needHAlign) {
      // 下面的 x 是「文字起点（左边缘）」语义，靠手工计算实现对齐。
      // 而 applyStyleToCtx() 已经把 style.textAlign 写进了 ctx —— 若不复位，canvas 会按
      // ctx.textAlign 再对齐一次，文字整体再左偏半个（center）或一个（right）文字宽度。
      // 实测（admin 示例）：按钮 "New Order" x=-35.51 + ctx.textAlign='center'，文字中心左偏 35.5px；
      // 头像字母因此偏出圆形。复位成 left 后与下方公式一致。
      this.ctx.textAlign = 'left';
    }

    for (let i = 0; i < lines.length; i++) {
      // x 按 textAlign（默认左对齐，与旧行为一致）
      let x = 0 - this.state.localOrigin[0] + paddingLeft;
      if (needHAlign) {
        const lineWidth = measure ? measure(lines[i]) || 0 : 0;
        if (textAlign === 'center') {
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

      if (this.state.stroke) {
        this.ctx.strokeText(lines[i], x, baselineY, this.state.width);
      }
      if (this.state.fill) {
        this.ctx.fillText(lines[i], x, baselineY, this.state.width);
      }
    }

    // 编辑态下渲染光标
    if (this.state.editing) {
      this.renderCaret();
    }
    super.doRender();
  }
}

export default ICEText;
