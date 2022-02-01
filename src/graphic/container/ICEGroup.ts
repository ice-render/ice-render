import ICEComponent from '../ICEComponent';
import ICERect from '../shape/ICERect';

/**
 * @class ICEGroup
 * 容器型组件
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
class ICEGroup extends ICERect {
  public parentNode = null;
  public childNodes = [];

  constructor(props) {
    super(props);
  }

  public addChild(child: ICEComponent) {
    child.parentNode = this;
    this.childNodes.push(child);
  }

  public removeChild(child: ICEComponent) {
    child.parentNode = null;
    child.ctx = null;
    child.root = null;
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    //FIXME:destory child
  }

  protected renderChildren(): void {
    this.childNodes.forEach((child) => {
      child.ctx = this.ctx;
      child.root = this.root;
      child.render();
    });
  }

  /**
   * 先渲染自己，再渲染子组件。
   */
  public render(): void {
    super.render();
    this.renderChildren();
  }
}

export default ICEGroup;
