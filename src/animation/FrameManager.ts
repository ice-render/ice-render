import { ICE_CONSTS } from '../ICE_CONSTS';
import root from '../nodejs-support/root';

/**
 * 帧频控制器，全局单例，请勿创建多个实例。
 * 在浏览器中，当动画帧频过高时，会导致 CPU 使用率飙升，页面会卡顿。
 * @author 大漠穷秋<damoqiongqiu@126.com>
 */
//TODO:Move these to global config.
//TODO:当帧率小于12时，自动跳帧
//TODO:控制帧率
//TODO:增量渲染

const MAX_FRAME_RATE = 60;
const MIN_FRAME_RATE = 12;
const DEFAULT_FRAME_RATE = 24;

const FrameManager = {
  evtBuses: [],

  frameCallback: function (): void {
    FrameManager.evtBuses.forEach((evtBus) => {
      evtBus.trigger(ICE_CONSTS.ICE_FRAME_EVENT);
    });
    root.requestAnimationFrame(FrameManager.frameCallback);
  },

  start: function (): void {
    //TODO:为 Node 平台自定义一个 requestAnimationFrame 函数，签名、参数、调用方式全部相同。
    root.requestAnimationFrame(FrameManager.frameCallback);
  },

  stop: function (): void {},

  pause: function (): void {},

  resume: function (): void {},

  regitserEvtBus: function (evtBus) {
    if (FrameManager.evtBuses.includes(evtBus)) {
      return;
    }
    FrameManager.evtBuses.push(evtBus);
  },

  delEvtBus: function (evtBus) {
    if (!FrameManager.evtBuses.includes(evtBus)) {
      return;
    }
    FrameManager.evtBuses.splice(FrameManager.evtBuses.indexOf(evtBus), 1);
  },
};

export default FrameManager;
