/**
 * Copyright (c) 2022 大漠穷秋.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
/**
 * FIXME:这里需要重构，TS 官方提供的这个版本只拷贝方法，不拷贝属性
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
 * @param derivedCtor
 * @param constructors
 */
export function applyMixins(derivedCtor: any, constructors: any[]) {
  constructors.forEach((baseCtor) => {
    Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
      if (name != 'constructor') {
        Object.defineProperty(
          derivedCtor.prototype,
          name,
          Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || Object.create(null)
        );
      }
    });
  });
}
