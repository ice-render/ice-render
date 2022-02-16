import ICEGroup from './ICEGroup';

/**
 * @class ICECompositeComponent
 *
 * 组合型组件
 *
 * - 由多个组件组合在一起构成的组件，可以无限嵌套。
 * - 组合型组件可以带有装饰性的小组件。
 *
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
export default class ICECompositeComponent extends ICEGroup {
  constructor(props: any = {}) {
    super(props);
  }
}
