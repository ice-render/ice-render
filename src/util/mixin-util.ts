/**
 * @see https://www.typescriptlang.org/docs/handbook/mixins.html#alternative-pattern
 * @param derivedCtor
 * @param constructors
 */
// export function applyMixins(derivedCtor: any, constructors: any[]) {
//   constructors.forEach((baseCtor) => {
//     Object.getOwnPropertyNames(baseCtor.prototype).forEach((name) => {
//       Object.defineProperty(
//         derivedCtor.prototype,
//         name,
//         Object.getOwnPropertyDescriptor(baseCtor.prototype, name) || Object.create(null)
//       );
//     });
//   });
// }

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

// /**
//  * 这里的 mixin 只拷贝 prototype 上的属性。
//  * @param {Object|Function} target
//  * @param {Object|Function} sorce
//  * @param {Boolean} overlay
//  */
// export function applyMixins(target, source, overlay) {
//   target = 'prototype' in target ? target.prototype : target;
//   source = 'prototype' in source ? source.prototype : source;

//   defaults(target, source, overlay);
// }

// /**
//  * @param {*} target
//  * @param {*} source
//  * @param {Boolean} [overlay=false]
//  */
// export function defaults(target, source, overlay) {
//   for (var key in source) {
//     if (source.hasOwnProperty(key) && (overlay ? source[key] != null : target[key] == null)) {
//       target[key] = source[key];
//     }
//   }
//   return target;
// }
