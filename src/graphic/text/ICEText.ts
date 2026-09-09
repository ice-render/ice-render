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

    const input = doc.createElement('input');
    input.type = 'text';
    input.value = this.state.text;
    input.style.position = 'absolute';
    input.style.left = canvasRect.left + box.tl[0] + 'px';
    input.style.top = canvasRect.top + box.tl[1] + 'px';
    input.style.width = Math.max(this.state.width, 1) + 'px';
    input.style.height = Math.max(this.state.height, this.state.style.fontSize) + 'px';
    input.style.fontSize = this.state.style.fontSize + 'px';
    input.style.fontFamily = this.state.style.fontFamily;
    input.style.color = 'transparent'; // 文字透明（canvas 显示），只保留光标
    input.style.caretColor = this.state.style.fillStyle || '#000000';
    input.style.background = 'transparent';
    input.style.border = 'none';
    input.style.outline = 'none';
    input.style.padding = '0';
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
    if (!this.dirty) {
      return { width: this.state.width, height: this.state.height };
    }
    return this.measureText();
  }

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
        };
        for (const key in styleObj) {
          div.style[key] = styleObj[key];
        }
        div.contenteditable = false;
        this.root.document.body.appendChild(div);
      }

      div.innerHTML = this.state.text.split('\n').join('<br>');

      const { paddingTop, paddingBottom, paddingLeft, paddingRight } = this.state.style;
      const cssSize = {
        width: div.offsetWidth + paddingLeft + paddingRight,
        height: div.offsetHeight + paddingTop + paddingBottom,
      };
      //这里需要同时修改一下 props 中的 width/height ，因为构造时无法计算文本的宽高
      this.props.width = cssSize.width;
      this.props.height = cssSize.height;
      this.state.width = cssSize.width;
      this.state.height = cssSize.height;
      this.state.textHeight = div.offsetHeight; // 纯文本高度（不含 padding），供多行 baseline 计算
      return { width: this.state.width, height: this.state.height };
    } catch (err) {
      console.error(err);
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
    const { paddingTop, paddingBottom, paddingLeft, paddingRight } = this.state.style;
    // 多行文本：按 \n 拆分，逐行绘制；行高用 DIV 实测的文本高度均分，保证单行与旧基线一致
    const lines = this.state.text.split('\n');
    const textHeight = this.state.textHeight || this.state.style.fontSize;
    const lineHeight = textHeight / lines.length;
    const x = 0 - this.state.localOrigin[0] + paddingLeft;

    for (let i = 0; i < lines.length; i++) {
      const baselineY = 0 - this.state.localOrigin[1] + paddingTop + (i + 1) * lineHeight;
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
