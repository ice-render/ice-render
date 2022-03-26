/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import merge from 'lodash/merge';
import ICE_EVENT_NAME_CONSTS from '../../consts/ICE_EVENT_NAME_CONSTS';
import ICEEvent from '../../event/ICEEvent';
import ICEComponent from '../ICEComponent';

/**
 * TODO:draw text along Path2D
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
   *       fontSize:48,
   *       fontFamily:'Arial',
   *       fontWeight:24,
   *   }
   * }
   * @param props
   */
  constructor(props: any = {}) {
    const param = merge(
      {
        text: '',
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        style: {
          fontWeight: 'bold',
          fontSize: 32,
          fontFamily: 'Arial',
          lineWidth: 1,
        },
      },
      props
    );
    param.style = {
      ...param.style,
      font: `${param.style.fontWeight} ${param.style.fontSize}px ${param.style.fontFamily}`, //CanvasRenderingContext2D 只支持 font 属性，这里手动拼接
      textBaseline: 'bottom', //@see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline
    };
    super(param);
  }

  protected initEvents(): void {
    this.on(ICE_EVENT_NAME_CONSTS.AFTER_ADD, this.measureText, this);
  }

  /**
   * @method measureText
   *
   * - Canvas 中没有提供原生的计算文本高度的有效方法，文本宽高的计算需要使用特殊的方法，这里使用的方法来自 https://longviewcoder.com/2021/02/11/html5-canvas-text-line-height-measurement/
   * - 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * - 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
   *
   * FIXME:某些运行时环境可能不支持动态插入 HTML 标签，以上测量文本宽高的方法可能存在兼容性问题。
   * FIXME:对文本位置的控制需要更精细的计算方法。
   */
  private measureText(evt?: ICEEvent) {
    let div;
    try {
      div = this.root.document.createElement('div');
      const styleObj = {
        padding: '0',
        margin: '0',
        border: 'none',
        position: 'absolute',
        top: '0',
        left: '0',
        fontFamily: this.state.style.fontFamily,
        fontWeight: this.state.style.fontWeight,
        fontSize: this.state.style.fontSize + 'px',
      };
      for (const key in styleObj) {
        div.style[key] = styleObj[key];
      }
      div.contenteditable = false;
      div.innerHTML = this.state.text;

      this.root.document.body.appendChild(div);
      let cssSize = { width: div.offsetWidth, height: div.offsetHeight };

      //这里需要同时修改一下 props 中的 width/height ，因为构造时无法计算文本的宽高
      this.props.width = cssSize.width;
      this.props.height = cssSize.height;
      this.state.width = cssSize.width;
      this.state.height = cssSize.height;
    } finally {
      this.root.document.body.removeChild(div);
    }
  }

  /**
   * @method doRender
   * @override
   * 文本是基于 baseline 绘制的，文本是从 y 坐标向屏幕上方绘制的，48 是文本高度，这里需要补偿文本高度。
   * 同时把移动坐标轴原点的偏移量计算进去。
   */
  protected doRender() {
    if (this.state.stroke) {
      this.ctx.strokeText(
        this.state.text,
        0 - this.state.localOrigin[0],
        0 - this.state.localOrigin[1] + this.state.height,
        this.state.width
      );
    }
    if (this.state.fill) {
      this.ctx.fillText(
        this.state.text,
        0 - this.state.localOrigin[0],
        0 - this.state.localOrigin[1] + this.state.height,
        this.state.width
      );
    }
    super.doRender();
  }
}

export default ICEText;
