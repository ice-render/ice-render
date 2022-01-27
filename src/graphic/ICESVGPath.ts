import ICEPath from './ICEPath';

export default class ICESVGPath extends ICEPath {
  constructor(props) {
    super(props);
  }

  protected createPathObject(): Path2D {
    this.path2D = new Path2D();
    return this.path2D;
  }
}
