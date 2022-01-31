import ICEComponent from '../ICEComponent';

/**
 * TODO:draw text along Path2D
 * @see https://longviewcoder.com/2021/02/11/html5-canvas-text-line-height-measurement/
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEText extends ICEComponent {
  /**
   * @cfg
   * {
   *   text:'文本内容',
   *   left:0,
   *   top:0,
   *   fontSize:48,
   *   fontFamily:'Arial',
   *   fontWeight:24,
   * }
   * FIXME: fontSize/fontFamily/fontWeight 移动到 style 配置项中一起处理。
   * @param props
   */
  constructor(props: any = {}) {
    super({ text: '', left: 0, top: 0, fontSize: 48, fontFamily: 'Arial', fontWeight: 24, ...props });
  }

  /**
   * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
   * 文本尺寸的计算需要使用特殊的方法。
   * 这里使用的方法来自 https://longviewcoder.com/2021/02/11/html5-canvas-text-line-height-measurement/
   * FIXME:某些运行时环境可能不支持动态插入 HTML 标签，以上测量文本宽高的方法可能存在兼容性问题。
   * FIXME:边界盒子的高度与字体高度之间存在误差。
   * @returns
   */
  protected calcOriginalDimension() {
    const div = this.root.document.createElement('div');
    div.contenteditable = false;
    div.innerHTML = this.state.text;
    div.style.position = 'absolute';
    div.style.top = '200px';
    div.style.left = '0';
    div.style.fontFamily = this.state.fontFamily;
    div.style.fontWeight = this.state.fontWeight;
    div.style.fontSize = this.state.fontSize + 'px';
    this.root.document.body.appendChild(div);
    let cssSize = { width: div.offsetWidth, height: div.offsetHeight };
    this.root.document.body.removeChild(div);

    //这里需要同时修改一下 props 中的 width/height ，因为构造时无法计算文本的宽高
    this.props.width = cssSize.width;
    this.props.height = cssSize.height;
    this.state.width = cssSize.width;
    this.state.height = cssSize.height;

    return { width: this.state.width, height: this.state.height };
  }

  /**
   * 文本是基于 baseline 绘制的，文本是从 y 坐标向屏幕上方绘制的，48 是文本高度，这里需要补偿文本高度。
   * 同时把移动坐标轴原点的偏移量计算进去。
   */
  protected doRender() {
    this.ctx.strokeText(
      this.state.text,
      0 - this.state.originPoint.x,
      0 - this.state.originPoint.y + this.state.height,
      this.state.width
    );
    this.ctx.fillText(
      this.state.text,
      0 - this.state.originPoint.x,
      0 - this.state.originPoint.y + this.state.height,
      this.state.width
    );
  }
}

export default ICEText;
