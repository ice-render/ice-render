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
import ICECableLike from './ICECableLike';
import ICEVisioLink from './ICEVisioLink';

class ICECablelikeVisioLink extends ICECompositeComponent implements ICECableLike {
  constructor(props: any = {}) {
    let param = merge({}, props);
    //FIXME:变成 ICECompositeComponent 的默认 style
    param.style = { strokeStyle: '#8b0000', fillStyle: 'rgba(255, 255, 49, 0.2)', lineWidth: 1 };
    super(param);

    this.addChild(new ICEVisioLink({ ...props, interactive: false }));
    this.createLinkHooks();
  }

  protected initEvents(): void {
    super.initEvents();
  }

  protected renderChildren(): void {
    this.setHookPositions();
    super.renderChildren();
  }

  //for mixins...
  linkSlots = [];
  hookRadius = 10;
}

//@see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
applyMixins(ICECablelikeVisioLink, [ICECableLike]);

export default ICECablelikeVisioLink;
