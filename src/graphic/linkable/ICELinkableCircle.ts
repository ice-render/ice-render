import ICECircle from '../shape/ICECircle';
import ICELinkable from './ICELinkable';

/**
 * 无法在 ICECircle 类内部直接使用 ICELinkable 来构造可连接的圆，因为 ICESlot 是 ICECircle 的子类，rollup 检测到循环依赖之后编译会报错。
 */
const ICELinkableCircle = ICELinkable(ICECircle);

export default ICELinkableCircle;
