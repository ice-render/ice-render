import ICEBaseComponent from '../ICEBaseComponent';
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

  public addChild(child: ICEBaseComponent): void {
    child.parentNode = this;
    this.childNodes.push(child);
  }

  public addChildren(arr: Array<ICEBaseComponent>): void {
    arr.forEach((child) => {
      this.addChild(child);
    });
  }

  public removeChild(child: ICEBaseComponent) {
    child.parentNode = null;
    child.ctx = null;
    child.root = null;
    this.childNodes.splice(this.childNodes.indexOf(child), 1);
    //FIXME:destory child???
  }

  public removeChildren(arr: Array<ICEBaseComponent>): void {
    arr.forEach((child) => {
      this.removeChild(child);
    });
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
