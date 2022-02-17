/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import merge from 'lodash/merge';
import { applyMixins } from '../../util/mixin-util';
import ICECompositeComponent from '../container/ICECompositeComponent';
import ICECircle from '../shape/ICECircle';
import ICELinkable from './ICELinkable';

class ICELinkableCircle extends ICECompositeComponent implements ICELinkable {
  constructor(props: any = {}) {
    let param = merge({}, props);
    param.width = param.radius * 2;
    param.height = param.radius * 2;
    //FIXME:变成 ICECompositeComponent 的默认 style
    param.style = { strokeStyle: '#8b0000', fillStyle: 'rgba(255, 255, 49, 0.2)', lineWidth: 1 };
    super(param);

    let { radius, style } = props;

    this.addChild(new ICECircle({ radius, style, interactive: false }));
    this.createLinkSlots();
  }

  protected renderChildren(): void {
    this.setSlotPositions();
    super.renderChildren();
  }

  //for Mixins...
  linkSlots = [];
  slotRadius = 10;
}

//@see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
applyMixins(ICELinkableCircle, [ICELinkable]);

export default ICELinkableCircle;
