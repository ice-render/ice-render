/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import merge from 'lodash/merge';
import ICEEvent from '../../event/ICEEvent';
import ICEComponent from '../ICEComponent';

const utilDivId = '__ICE_UTILS_TEXT_MEASURE_DIV__';

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
    super(param);

    this.measureText();
  }

  /**
   * @overwrite
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * 此方法不能依赖原点位置和 transform 矩阵。
   * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
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

      div.innerHTML = this.state.text;

      const { paddingTop, paddingBottom, paddingLeft, paddingRight } = this.state.style;
      let cssSize = {
        width: div.offsetWidth + paddingLeft + paddingRight,
        height: div.offsetHeight + paddingTop + paddingBottom,
      };
      //这里需要同时修改一下 props 中的 width/height ，因为构造时无法计算文本的宽高
      this.props.width = cssSize.width;
      this.props.height = cssSize.height;
      this.state.width = cssSize.width;
      this.state.height = cssSize.height;
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
    if (this.state.stroke) {
      this.ctx.strokeText(
        this.state.text,
        0 - this.state.localOrigin[0] + paddingLeft,
        0 - this.state.localOrigin[1] + this.state.height - paddingBottom,
        this.state.width
      );
    }
    if (this.state.fill) {
      this.ctx.fillText(
        this.state.text,
        0 - this.state.localOrigin[0] + paddingLeft,
        0 - this.state.localOrigin[1] + this.state.height - paddingBottom,
        this.state.width
      );
    }
    super.doRender();
  }
}

export default ICEText;
