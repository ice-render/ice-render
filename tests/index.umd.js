/**
 * MIT License
 * 
 * Copyright (c) 2022 大漠穷秋
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
})((function () { 'use strict';

  /**
   * Common utilities
   * @module glMatrix
   */
  var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
  var degree = Math.PI / 180;
  /**
   * Convert Degree To Radian
   *
   * @param {Number} a Angle in Degrees
   */

  function toRadian(a) {
    return a * degree;
  }
  if (!Math.hypot) Math.hypot = function () {
    var y = 0,
        i = arguments.length;

    while (i--) {
      y += arguments[i] * arguments[i];
    }

    return Math.sqrt(y);
  };

  /**
   * 2x3 Matrix
   * @module mat2d
   * @description
   * A mat2d contains six elements defined as:
   * <pre>
   * [a, b,
   *  c, d,
   *  tx, ty]
   * </pre>
   * This is a short form for the 3x3 matrix:
   * <pre>
   * [a, b, 0,
   *  c, d, 0,
   *  tx, ty, 1]
   * </pre>
   * The last column is ignored so the array is shorter and operations are faster.
   */

  /**
   * Creates a new identity mat2d
   *
   * @returns {mat2d} a new 2x3 matrix
   */

  function create$1() {
    var out = new ARRAY_TYPE(6);

    if (ARRAY_TYPE != Float32Array) {
      out[1] = 0;
      out[2] = 0;
      out[4] = 0;
      out[5] = 0;
    }

    out[0] = 1;
    out[3] = 1;
    return out;
  }
  /**
   * Inverts a mat2d
   *
   * @param {mat2d} out the receiving matrix
   * @param {ReadonlyMat2d} a the source matrix
   * @returns {mat2d} out
   */

  function invert(out, a) {
    var aa = a[0],
        ab = a[1],
        ac = a[2],
        ad = a[3];
    var atx = a[4],
        aty = a[5];
    var det = aa * ad - ab * ac;

    if (!det) {
      return null;
    }

    det = 1.0 / det;
    out[0] = ad * det;
    out[1] = -ab * det;
    out[2] = -ac * det;
    out[3] = aa * det;
    out[4] = (ac * aty - ad * atx) * det;
    out[5] = (ab * atx - aa * aty) * det;
    return out;
  }
  /**
   * Multiplies two mat2d's
   *
   * @param {mat2d} out the receiving matrix
   * @param {ReadonlyMat2d} a the first operand
   * @param {ReadonlyMat2d} b the second operand
   * @returns {mat2d} out
   */

  function multiply(out, a, b) {
    var a0 = a[0],
        a1 = a[1],
        a2 = a[2],
        a3 = a[3],
        a4 = a[4],
        a5 = a[5];
    var b0 = b[0],
        b1 = b[1],
        b2 = b[2],
        b3 = b[3],
        b4 = b[4],
        b5 = b[5];
    out[0] = a0 * b0 + a2 * b1;
    out[1] = a1 * b0 + a3 * b1;
    out[2] = a0 * b2 + a2 * b3;
    out[3] = a1 * b2 + a3 * b3;
    out[4] = a0 * b4 + a2 * b5 + a4;
    out[5] = a1 * b4 + a3 * b5 + a5;
    return out;
  }
  /**
   * Rotates a mat2d by the given angle
   *
   * @param {mat2d} out the receiving matrix
   * @param {ReadonlyMat2d} a the matrix to rotate
   * @param {Number} rad the angle to rotate the matrix by
   * @returns {mat2d} out
   */

  function rotate(out, a, rad) {
    var a0 = a[0],
        a1 = a[1],
        a2 = a[2],
        a3 = a[3],
        a4 = a[4],
        a5 = a[5];
    var s = Math.sin(rad);
    var c = Math.cos(rad);
    out[0] = a0 * c + a2 * s;
    out[1] = a1 * c + a3 * s;
    out[2] = a0 * -s + a2 * c;
    out[3] = a1 * -s + a3 * c;
    out[4] = a4;
    out[5] = a5;
    return out;
  }
  /**
   * Scales the mat2d by the dimensions in the given vec2
   *
   * @param {mat2d} out the receiving matrix
   * @param {ReadonlyMat2d} a the matrix to translate
   * @param {ReadonlyVec2} v the vec2 to scale the matrix by
   * @returns {mat2d} out
   **/

  function scale(out, a, v) {
    var a0 = a[0],
        a1 = a[1],
        a2 = a[2],
        a3 = a[3],
        a4 = a[4],
        a5 = a[5];
    var v0 = v[0],
        v1 = v[1];
    out[0] = a0 * v0;
    out[1] = a1 * v0;
    out[2] = a2 * v1;
    out[3] = a3 * v1;
    out[4] = a4;
    out[5] = a5;
    return out;
  }

  /**
   * 2 Dimensional Vector
   * @module vec2
   */

  /**
   * Creates a new, empty vec2
   *
   * @returns {vec2} a new 2D vector
   */

  function create() {
    var out = new ARRAY_TYPE(2);

    if (ARRAY_TYPE != Float32Array) {
      out[0] = 0;
      out[1] = 0;
    }

    return out;
  }
  /**
   * Computes the cross product of two vec2's
   * Note that the cross product must by definition produce a 3D vector
   *
   * @param {vec3} out the receiving vector
   * @param {ReadonlyVec2} a the first operand
   * @param {ReadonlyVec2} b the second operand
   * @returns {vec3} out
   */

  function cross(out, a, b) {
    var z = a[0] * b[1] - a[1] * b[0];
    out[0] = out[1] = 0;
    out[2] = z;
    return out;
  }
  /**
   * Transforms the vec2 with a mat2d
   *
   * @param {vec2} out the receiving vector
   * @param {ReadonlyVec2} a the vector to transform
   * @param {ReadonlyMat2d} m matrix to transform with
   * @returns {vec2} out
   */

  function transformMat2d(out, a, m) {
    var x = a[0],
        y = a[1];
    out[0] = m[0] * x + m[2] * y + m[4];
    out[1] = m[1] * x + m[3] * y + m[5];
    return out;
  }
  /**
   * Perform some operation over an array of vec2s.
   *
   * @param {Array} a the array of vectors to iterate over
   * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
   * @param {Number} offset Number of elements to skip at the beginning of the array
   * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
   * @param {Function} fn Function to call for each vector in the array
   * @param {Object} [arg] additional argument to pass to fn
   * @returns {Array} a
   * @function
   */

  (function () {
    var vec = create();
    return function (a, stride, offset, count, fn, arg) {
      var i, l;

      if (!stride) {
        stride = 2;
      }

      if (!offset) {
        offset = 0;
      }

      if (count) {
        l = Math.min(count * stride + offset, a.length);
      } else {
        l = a.length;
      }

      for (i = offset; i < l; i += stride) {
        vec[0] = a[i];
        vec[1] = a[i + 1];
        fn(vec, vec, arg);
        a[i] = vec[0];
        a[i + 1] = vec[1];
      }

      return a;
    };
  })();

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  /**
   * Removes all key-value entries from the list cache.
   *
   * @private
   * @name clear
   * @memberOf ListCache
   */

  function listCacheClear$1() {
    this.__data__ = [];
    this.size = 0;
  }

  var _listCacheClear = listCacheClear$1;

  /**
   * Performs a
   * [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
   * comparison between two values to determine if they are equivalent.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to compare.
   * @param {*} other The other value to compare.
   * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
   * @example
   *
   * var object = { 'a': 1 };
   * var other = { 'a': 1 };
   *
   * _.eq(object, object);
   * // => true
   *
   * _.eq(object, other);
   * // => false
   *
   * _.eq('a', 'a');
   * // => true
   *
   * _.eq('a', Object('a'));
   * // => false
   *
   * _.eq(NaN, NaN);
   * // => true
   */

  function eq$4(value, other) {
    return value === other || (value !== value && other !== other);
  }

  var eq_1 = eq$4;

  var eq$3 = eq_1;

  /**
   * Gets the index at which the `key` is found in `array` of key-value pairs.
   *
   * @private
   * @param {Array} array The array to inspect.
   * @param {*} key The key to search for.
   * @returns {number} Returns the index of the matched value, else `-1`.
   */
  function assocIndexOf$4(array, key) {
    var length = array.length;
    while (length--) {
      if (eq$3(array[length][0], key)) {
        return length;
      }
    }
    return -1;
  }

  var _assocIndexOf = assocIndexOf$4;

  var assocIndexOf$3 = _assocIndexOf;

  /** Used for built-in method references. */
  var arrayProto = Array.prototype;

  /** Built-in value references. */
  var splice = arrayProto.splice;

  /**
   * Removes `key` and its value from the list cache.
   *
   * @private
   * @name delete
   * @memberOf ListCache
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */
  function listCacheDelete$1(key) {
    var data = this.__data__,
        index = assocIndexOf$3(data, key);

    if (index < 0) {
      return false;
    }
    var lastIndex = data.length - 1;
    if (index == lastIndex) {
      data.pop();
    } else {
      splice.call(data, index, 1);
    }
    --this.size;
    return true;
  }

  var _listCacheDelete = listCacheDelete$1;

  var assocIndexOf$2 = _assocIndexOf;

  /**
   * Gets the list cache value for `key`.
   *
   * @private
   * @name get
   * @memberOf ListCache
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function listCacheGet$1(key) {
    var data = this.__data__,
        index = assocIndexOf$2(data, key);

    return index < 0 ? undefined : data[index][1];
  }

  var _listCacheGet = listCacheGet$1;

  var assocIndexOf$1 = _assocIndexOf;

  /**
   * Checks if a list cache value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf ListCache
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function listCacheHas$1(key) {
    return assocIndexOf$1(this.__data__, key) > -1;
  }

  var _listCacheHas = listCacheHas$1;

  var assocIndexOf = _assocIndexOf;

  /**
   * Sets the list cache `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf ListCache
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the list cache instance.
   */
  function listCacheSet$1(key, value) {
    var data = this.__data__,
        index = assocIndexOf(data, key);

    if (index < 0) {
      ++this.size;
      data.push([key, value]);
    } else {
      data[index][1] = value;
    }
    return this;
  }

  var _listCacheSet = listCacheSet$1;

  var listCacheClear = _listCacheClear,
      listCacheDelete = _listCacheDelete,
      listCacheGet = _listCacheGet,
      listCacheHas = _listCacheHas,
      listCacheSet = _listCacheSet;

  /**
   * Creates an list cache object.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function ListCache$4(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  // Add methods to `ListCache`.
  ListCache$4.prototype.clear = listCacheClear;
  ListCache$4.prototype['delete'] = listCacheDelete;
  ListCache$4.prototype.get = listCacheGet;
  ListCache$4.prototype.has = listCacheHas;
  ListCache$4.prototype.set = listCacheSet;

  var _ListCache = ListCache$4;

  var ListCache$3 = _ListCache;

  /**
   * Removes all key-value entries from the stack.
   *
   * @private
   * @name clear
   * @memberOf Stack
   */
  function stackClear$1() {
    this.__data__ = new ListCache$3;
    this.size = 0;
  }

  var _stackClear = stackClear$1;

  /**
   * Removes `key` and its value from the stack.
   *
   * @private
   * @name delete
   * @memberOf Stack
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */

  function stackDelete$1(key) {
    var data = this.__data__,
        result = data['delete'](key);

    this.size = data.size;
    return result;
  }

  var _stackDelete = stackDelete$1;

  /**
   * Gets the stack value for `key`.
   *
   * @private
   * @name get
   * @memberOf Stack
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */

  function stackGet$1(key) {
    return this.__data__.get(key);
  }

  var _stackGet = stackGet$1;

  /**
   * Checks if a stack value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf Stack
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */

  function stackHas$1(key) {
    return this.__data__.has(key);
  }

  var _stackHas = stackHas$1;

  /** Detect free variable `global` from Node.js. */

  var freeGlobal$1 = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

  var _freeGlobal = freeGlobal$1;

  var freeGlobal = _freeGlobal;

  /** Detect free variable `self`. */
  var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

  /** Used as a reference to the global object. */
  var root$b = freeGlobal || freeSelf || Function('return this')();

  var _root = root$b;

  var root$a = _root;

  /** Built-in value references. */
  var Symbol$3 = root$a.Symbol;

  var _Symbol = Symbol$3;

  var Symbol$2 = _Symbol;

  /** Used for built-in method references. */
  var objectProto$c = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$a = objectProto$c.hasOwnProperty;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var nativeObjectToString$1 = objectProto$c.toString;

  /** Built-in value references. */
  var symToStringTag$1 = Symbol$2 ? Symbol$2.toStringTag : undefined;

  /**
   * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the raw `toStringTag`.
   */
  function getRawTag$1(value) {
    var isOwn = hasOwnProperty$a.call(value, symToStringTag$1),
        tag = value[symToStringTag$1];

    try {
      value[symToStringTag$1] = undefined;
      var unmasked = true;
    } catch (e) {}

    var result = nativeObjectToString$1.call(value);
    if (unmasked) {
      if (isOwn) {
        value[symToStringTag$1] = tag;
      } else {
        delete value[symToStringTag$1];
      }
    }
    return result;
  }

  var _getRawTag = getRawTag$1;

  /** Used for built-in method references. */

  var objectProto$b = Object.prototype;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var nativeObjectToString = objectProto$b.toString;

  /**
   * Converts `value` to a string using `Object.prototype.toString`.
   *
   * @private
   * @param {*} value The value to convert.
   * @returns {string} Returns the converted string.
   */
  function objectToString$1(value) {
    return nativeObjectToString.call(value);
  }

  var _objectToString = objectToString$1;

  var Symbol$1 = _Symbol,
      getRawTag = _getRawTag,
      objectToString = _objectToString;

  /** `Object#toString` result references. */
  var nullTag = '[object Null]',
      undefinedTag = '[object Undefined]';

  /** Built-in value references. */
  var symToStringTag = Symbol$1 ? Symbol$1.toStringTag : undefined;

  /**
   * The base implementation of `getTag` without fallbacks for buggy environments.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the `toStringTag`.
   */
  function baseGetTag$7(value) {
    if (value == null) {
      return value === undefined ? undefinedTag : nullTag;
    }
    return (symToStringTag && symToStringTag in Object(value))
      ? getRawTag(value)
      : objectToString(value);
  }

  var _baseGetTag = baseGetTag$7;

  /**
   * Checks if `value` is the
   * [language type](http://www.ecma-international.org/ecma-262/7.0/#sec-ecmascript-language-types)
   * of `Object`. (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an object, else `false`.
   * @example
   *
   * _.isObject({});
   * // => true
   *
   * _.isObject([1, 2, 3]);
   * // => true
   *
   * _.isObject(_.noop);
   * // => true
   *
   * _.isObject(null);
   * // => false
   */

  function isObject$8(value) {
    var type = typeof value;
    return value != null && (type == 'object' || type == 'function');
  }

  var isObject_1 = isObject$8;

  var baseGetTag$6 = _baseGetTag,
      isObject$7 = isObject_1;

  /** `Object#toString` result references. */
  var asyncTag = '[object AsyncFunction]',
      funcTag$1 = '[object Function]',
      genTag = '[object GeneratorFunction]',
      proxyTag = '[object Proxy]';

  /**
   * Checks if `value` is classified as a `Function` object.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a function, else `false`.
   * @example
   *
   * _.isFunction(_);
   * // => true
   *
   * _.isFunction(/abc/);
   * // => false
   */
  function isFunction$3(value) {
    if (!isObject$7(value)) {
      return false;
    }
    // The use of `Object#toString` avoids issues with the `typeof` operator
    // in Safari 9 which returns 'object' for typed arrays and other constructors.
    var tag = baseGetTag$6(value);
    return tag == funcTag$1 || tag == genTag || tag == asyncTag || tag == proxyTag;
  }

  var isFunction_1 = isFunction$3;

  var root$9 = _root;

  /** Used to detect overreaching core-js shims. */
  var coreJsData$1 = root$9['__core-js_shared__'];

  var _coreJsData = coreJsData$1;

  var coreJsData = _coreJsData;

  /** Used to detect methods masquerading as native. */
  var maskSrcKey = (function() {
    var uid = /[^.]+$/.exec(coreJsData && coreJsData.keys && coreJsData.keys.IE_PROTO || '');
    return uid ? ('Symbol(src)_1.' + uid) : '';
  }());

  /**
   * Checks if `func` has its source masked.
   *
   * @private
   * @param {Function} func The function to check.
   * @returns {boolean} Returns `true` if `func` is masked, else `false`.
   */
  function isMasked$1(func) {
    return !!maskSrcKey && (maskSrcKey in func);
  }

  var _isMasked = isMasked$1;

  /** Used for built-in method references. */

  var funcProto$2 = Function.prototype;

  /** Used to resolve the decompiled source of functions. */
  var funcToString$2 = funcProto$2.toString;

  /**
   * Converts `func` to its source code.
   *
   * @private
   * @param {Function} func The function to convert.
   * @returns {string} Returns the source code.
   */
  function toSource$2(func) {
    if (func != null) {
      try {
        return funcToString$2.call(func);
      } catch (e) {}
      try {
        return (func + '');
      } catch (e) {}
    }
    return '';
  }

  var _toSource = toSource$2;

  var isFunction$2 = isFunction_1,
      isMasked = _isMasked,
      isObject$6 = isObject_1,
      toSource$1 = _toSource;

  /**
   * Used to match `RegExp`
   * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
   */
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

  /** Used to detect host constructors (Safari). */
  var reIsHostCtor = /^\[object .+?Constructor\]$/;

  /** Used for built-in method references. */
  var funcProto$1 = Function.prototype,
      objectProto$a = Object.prototype;

  /** Used to resolve the decompiled source of functions. */
  var funcToString$1 = funcProto$1.toString;

  /** Used to check objects for own properties. */
  var hasOwnProperty$9 = objectProto$a.hasOwnProperty;

  /** Used to detect if a method is native. */
  var reIsNative = RegExp('^' +
    funcToString$1.call(hasOwnProperty$9).replace(reRegExpChar, '\\$&')
    .replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g, '$1.*?') + '$'
  );

  /**
   * The base implementation of `_.isNative` without bad shim checks.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a native function,
   *  else `false`.
   */
  function baseIsNative$1(value) {
    if (!isObject$6(value) || isMasked(value)) {
      return false;
    }
    var pattern = isFunction$2(value) ? reIsNative : reIsHostCtor;
    return pattern.test(toSource$1(value));
  }

  var _baseIsNative = baseIsNative$1;

  /**
   * Gets the value at `key` of `object`.
   *
   * @private
   * @param {Object} [object] The object to query.
   * @param {string} key The key of the property to get.
   * @returns {*} Returns the property value.
   */

  function getValue$1(object, key) {
    return object == null ? undefined : object[key];
  }

  var _getValue = getValue$1;

  var baseIsNative = _baseIsNative,
      getValue = _getValue;

  /**
   * Gets the native function at `key` of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {string} key The key of the method to get.
   * @returns {*} Returns the function if it's native, else `undefined`.
   */
  function getNative$7(object, key) {
    var value = getValue(object, key);
    return baseIsNative(value) ? value : undefined;
  }

  var _getNative = getNative$7;

  var getNative$6 = _getNative,
      root$8 = _root;

  /* Built-in method references that are verified to be native. */
  var Map$4 = getNative$6(root$8, 'Map');

  var _Map = Map$4;

  var getNative$5 = _getNative;

  /* Built-in method references that are verified to be native. */
  var nativeCreate$4 = getNative$5(Object, 'create');

  var _nativeCreate = nativeCreate$4;

  var nativeCreate$3 = _nativeCreate;

  /**
   * Removes all key-value entries from the hash.
   *
   * @private
   * @name clear
   * @memberOf Hash
   */
  function hashClear$1() {
    this.__data__ = nativeCreate$3 ? nativeCreate$3(null) : {};
    this.size = 0;
  }

  var _hashClear = hashClear$1;

  /**
   * Removes `key` and its value from the hash.
   *
   * @private
   * @name delete
   * @memberOf Hash
   * @param {Object} hash The hash to modify.
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */

  function hashDelete$1(key) {
    var result = this.has(key) && delete this.__data__[key];
    this.size -= result ? 1 : 0;
    return result;
  }

  var _hashDelete = hashDelete$1;

  var nativeCreate$2 = _nativeCreate;

  /** Used to stand-in for `undefined` hash values. */
  var HASH_UNDEFINED$1 = '__lodash_hash_undefined__';

  /** Used for built-in method references. */
  var objectProto$9 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$8 = objectProto$9.hasOwnProperty;

  /**
   * Gets the hash value for `key`.
   *
   * @private
   * @name get
   * @memberOf Hash
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function hashGet$1(key) {
    var data = this.__data__;
    if (nativeCreate$2) {
      var result = data[key];
      return result === HASH_UNDEFINED$1 ? undefined : result;
    }
    return hasOwnProperty$8.call(data, key) ? data[key] : undefined;
  }

  var _hashGet = hashGet$1;

  var nativeCreate$1 = _nativeCreate;

  /** Used for built-in method references. */
  var objectProto$8 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$7 = objectProto$8.hasOwnProperty;

  /**
   * Checks if a hash value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf Hash
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function hashHas$1(key) {
    var data = this.__data__;
    return nativeCreate$1 ? (data[key] !== undefined) : hasOwnProperty$7.call(data, key);
  }

  var _hashHas = hashHas$1;

  var nativeCreate = _nativeCreate;

  /** Used to stand-in for `undefined` hash values. */
  var HASH_UNDEFINED = '__lodash_hash_undefined__';

  /**
   * Sets the hash `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf Hash
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the hash instance.
   */
  function hashSet$1(key, value) {
    var data = this.__data__;
    this.size += this.has(key) ? 0 : 1;
    data[key] = (nativeCreate && value === undefined) ? HASH_UNDEFINED : value;
    return this;
  }

  var _hashSet = hashSet$1;

  var hashClear = _hashClear,
      hashDelete = _hashDelete,
      hashGet = _hashGet,
      hashHas = _hashHas,
      hashSet = _hashSet;

  /**
   * Creates a hash object.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function Hash$1(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  // Add methods to `Hash`.
  Hash$1.prototype.clear = hashClear;
  Hash$1.prototype['delete'] = hashDelete;
  Hash$1.prototype.get = hashGet;
  Hash$1.prototype.has = hashHas;
  Hash$1.prototype.set = hashSet;

  var _Hash = Hash$1;

  var Hash = _Hash,
      ListCache$2 = _ListCache,
      Map$3 = _Map;

  /**
   * Removes all key-value entries from the map.
   *
   * @private
   * @name clear
   * @memberOf MapCache
   */
  function mapCacheClear$1() {
    this.size = 0;
    this.__data__ = {
      'hash': new Hash,
      'map': new (Map$3 || ListCache$2),
      'string': new Hash
    };
  }

  var _mapCacheClear = mapCacheClear$1;

  /**
   * Checks if `value` is suitable for use as unique object key.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
   */

  function isKeyable$1(value) {
    var type = typeof value;
    return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
      ? (value !== '__proto__')
      : (value === null);
  }

  var _isKeyable = isKeyable$1;

  var isKeyable = _isKeyable;

  /**
   * Gets the data for `map`.
   *
   * @private
   * @param {Object} map The map to query.
   * @param {string} key The reference key.
   * @returns {*} Returns the map data.
   */
  function getMapData$4(map, key) {
    var data = map.__data__;
    return isKeyable(key)
      ? data[typeof key == 'string' ? 'string' : 'hash']
      : data.map;
  }

  var _getMapData = getMapData$4;

  var getMapData$3 = _getMapData;

  /**
   * Removes `key` and its value from the map.
   *
   * @private
   * @name delete
   * @memberOf MapCache
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */
  function mapCacheDelete$1(key) {
    var result = getMapData$3(this, key)['delete'](key);
    this.size -= result ? 1 : 0;
    return result;
  }

  var _mapCacheDelete = mapCacheDelete$1;

  var getMapData$2 = _getMapData;

  /**
   * Gets the map value for `key`.
   *
   * @private
   * @name get
   * @memberOf MapCache
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function mapCacheGet$1(key) {
    return getMapData$2(this, key).get(key);
  }

  var _mapCacheGet = mapCacheGet$1;

  var getMapData$1 = _getMapData;

  /**
   * Checks if a map value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf MapCache
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function mapCacheHas$1(key) {
    return getMapData$1(this, key).has(key);
  }

  var _mapCacheHas = mapCacheHas$1;

  var getMapData = _getMapData;

  /**
   * Sets the map `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf MapCache
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the map cache instance.
   */
  function mapCacheSet$1(key, value) {
    var data = getMapData(this, key),
        size = data.size;

    data.set(key, value);
    this.size += data.size == size ? 0 : 1;
    return this;
  }

  var _mapCacheSet = mapCacheSet$1;

  var mapCacheClear = _mapCacheClear,
      mapCacheDelete = _mapCacheDelete,
      mapCacheGet = _mapCacheGet,
      mapCacheHas = _mapCacheHas,
      mapCacheSet = _mapCacheSet;

  /**
   * Creates a map cache object to store key-value pairs.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function MapCache$1(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  // Add methods to `MapCache`.
  MapCache$1.prototype.clear = mapCacheClear;
  MapCache$1.prototype['delete'] = mapCacheDelete;
  MapCache$1.prototype.get = mapCacheGet;
  MapCache$1.prototype.has = mapCacheHas;
  MapCache$1.prototype.set = mapCacheSet;

  var _MapCache = MapCache$1;

  var ListCache$1 = _ListCache,
      Map$2 = _Map,
      MapCache = _MapCache;

  /** Used as the size to enable large array optimizations. */
  var LARGE_ARRAY_SIZE = 200;

  /**
   * Sets the stack `key` to `value`.
   *
   * @private
   * @name set
   * @memberOf Stack
   * @param {string} key The key of the value to set.
   * @param {*} value The value to set.
   * @returns {Object} Returns the stack cache instance.
   */
  function stackSet$1(key, value) {
    var data = this.__data__;
    if (data instanceof ListCache$1) {
      var pairs = data.__data__;
      if (!Map$2 || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
        pairs.push([key, value]);
        this.size = ++data.size;
        return this;
      }
      data = this.__data__ = new MapCache(pairs);
    }
    data.set(key, value);
    this.size = data.size;
    return this;
  }

  var _stackSet = stackSet$1;

  var ListCache = _ListCache,
      stackClear = _stackClear,
      stackDelete = _stackDelete,
      stackGet = _stackGet,
      stackHas = _stackHas,
      stackSet = _stackSet;

  /**
   * Creates a stack cache object to store key-value pairs.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function Stack$1(entries) {
    var data = this.__data__ = new ListCache(entries);
    this.size = data.size;
  }

  // Add methods to `Stack`.
  Stack$1.prototype.clear = stackClear;
  Stack$1.prototype['delete'] = stackDelete;
  Stack$1.prototype.get = stackGet;
  Stack$1.prototype.has = stackHas;
  Stack$1.prototype.set = stackSet;

  var _Stack = Stack$1;

  var getNative$4 = _getNative;

  var defineProperty$2 = (function() {
    try {
      var func = getNative$4(Object, 'defineProperty');
      func({}, '', {});
      return func;
    } catch (e) {}
  }());

  var _defineProperty = defineProperty$2;

  var defineProperty$1 = _defineProperty;

  /**
   * The base implementation of `assignValue` and `assignMergeValue` without
   * value checks.
   *
   * @private
   * @param {Object} object The object to modify.
   * @param {string} key The key of the property to assign.
   * @param {*} value The value to assign.
   */
  function baseAssignValue$3(object, key, value) {
    if (key == '__proto__' && defineProperty$1) {
      defineProperty$1(object, key, {
        'configurable': true,
        'enumerable': true,
        'value': value,
        'writable': true
      });
    } else {
      object[key] = value;
    }
  }

  var _baseAssignValue = baseAssignValue$3;

  var baseAssignValue$2 = _baseAssignValue,
      eq$2 = eq_1;

  /**
   * This function is like `assignValue` except that it doesn't assign
   * `undefined` values.
   *
   * @private
   * @param {Object} object The object to modify.
   * @param {string} key The key of the property to assign.
   * @param {*} value The value to assign.
   */
  function assignMergeValue$2(object, key, value) {
    if ((value !== undefined && !eq$2(object[key], value)) ||
        (value === undefined && !(key in object))) {
      baseAssignValue$2(object, key, value);
    }
  }

  var _assignMergeValue = assignMergeValue$2;

  /**
   * Creates a base function for methods like `_.forIn` and `_.forOwn`.
   *
   * @private
   * @param {boolean} [fromRight] Specify iterating from right to left.
   * @returns {Function} Returns the new base function.
   */

  function createBaseFor$1(fromRight) {
    return function(object, iteratee, keysFunc) {
      var index = -1,
          iterable = Object(object),
          props = keysFunc(object),
          length = props.length;

      while (length--) {
        var key = props[fromRight ? length : ++index];
        if (iteratee(iterable[key], key, iterable) === false) {
          break;
        }
      }
      return object;
    };
  }

  var _createBaseFor = createBaseFor$1;

  var createBaseFor = _createBaseFor;

  /**
   * The base implementation of `baseForOwn` which iterates over `object`
   * properties returned by `keysFunc` and invokes `iteratee` for each property.
   * Iteratee functions may exit iteration early by explicitly returning `false`.
   *
   * @private
   * @param {Object} object The object to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @param {Function} keysFunc The function to get the keys of `object`.
   * @returns {Object} Returns `object`.
   */
  var baseFor$1 = createBaseFor();

  var _baseFor = baseFor$1;

  var _cloneBuffer = {exports: {}};

  (function (module, exports) {
  var root = _root;

  /** Detect free variable `exports`. */
  var freeExports = exports && !exports.nodeType && exports;

  /** Detect free variable `module`. */
  var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports;

  /** Built-in value references. */
  var Buffer = moduleExports ? root.Buffer : undefined,
      allocUnsafe = Buffer ? Buffer.allocUnsafe : undefined;

  /**
   * Creates a clone of  `buffer`.
   *
   * @private
   * @param {Buffer} buffer The buffer to clone.
   * @param {boolean} [isDeep] Specify a deep clone.
   * @returns {Buffer} Returns the cloned buffer.
   */
  function cloneBuffer(buffer, isDeep) {
    if (isDeep) {
      return buffer.slice();
    }
    var length = buffer.length,
        result = allocUnsafe ? allocUnsafe(length) : new buffer.constructor(length);

    buffer.copy(result);
    return result;
  }

  module.exports = cloneBuffer;
  }(_cloneBuffer, _cloneBuffer.exports));

  var root$7 = _root;

  /** Built-in value references. */
  var Uint8Array$1 = root$7.Uint8Array;

  var _Uint8Array = Uint8Array$1;

  var Uint8Array = _Uint8Array;

  /**
   * Creates a clone of `arrayBuffer`.
   *
   * @private
   * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
   * @returns {ArrayBuffer} Returns the cloned array buffer.
   */
  function cloneArrayBuffer$1(arrayBuffer) {
    var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
    new Uint8Array(result).set(new Uint8Array(arrayBuffer));
    return result;
  }

  var _cloneArrayBuffer = cloneArrayBuffer$1;

  var cloneArrayBuffer = _cloneArrayBuffer;

  /**
   * Creates a clone of `typedArray`.
   *
   * @private
   * @param {Object} typedArray The typed array to clone.
   * @param {boolean} [isDeep] Specify a deep clone.
   * @returns {Object} Returns the cloned typed array.
   */
  function cloneTypedArray$1(typedArray, isDeep) {
    var buffer = isDeep ? cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
    return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
  }

  var _cloneTypedArray = cloneTypedArray$1;

  /**
   * Copies the values of `source` to `array`.
   *
   * @private
   * @param {Array} source The array to copy values from.
   * @param {Array} [array=[]] The array to copy values to.
   * @returns {Array} Returns `array`.
   */

  function copyArray$1(source, array) {
    var index = -1,
        length = source.length;

    array || (array = Array(length));
    while (++index < length) {
      array[index] = source[index];
    }
    return array;
  }

  var _copyArray = copyArray$1;

  var isObject$5 = isObject_1;

  /** Built-in value references. */
  var objectCreate = Object.create;

  /**
   * The base implementation of `_.create` without support for assigning
   * properties to the created object.
   *
   * @private
   * @param {Object} proto The object to inherit from.
   * @returns {Object} Returns the new object.
   */
  var baseCreate$1 = (function() {
    function object() {}
    return function(proto) {
      if (!isObject$5(proto)) {
        return {};
      }
      if (objectCreate) {
        return objectCreate(proto);
      }
      object.prototype = proto;
      var result = new object;
      object.prototype = undefined;
      return result;
    };
  }());

  var _baseCreate = baseCreate$1;

  /**
   * Creates a unary function that invokes `func` with its argument transformed.
   *
   * @private
   * @param {Function} func The function to wrap.
   * @param {Function} transform The argument transform.
   * @returns {Function} Returns the new function.
   */

  function overArg$2(func, transform) {
    return function(arg) {
      return func(transform(arg));
    };
  }

  var _overArg = overArg$2;

  var overArg$1 = _overArg;

  /** Built-in value references. */
  var getPrototype$2 = overArg$1(Object.getPrototypeOf, Object);

  var _getPrototype = getPrototype$2;

  /** Used for built-in method references. */

  var objectProto$7 = Object.prototype;

  /**
   * Checks if `value` is likely a prototype object.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
   */
  function isPrototype$4(value) {
    var Ctor = value && value.constructor,
        proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto$7;

    return value === proto;
  }

  var _isPrototype = isPrototype$4;

  var baseCreate = _baseCreate,
      getPrototype$1 = _getPrototype,
      isPrototype$3 = _isPrototype;

  /**
   * Initializes an object clone.
   *
   * @private
   * @param {Object} object The object to clone.
   * @returns {Object} Returns the initialized clone.
   */
  function initCloneObject$1(object) {
    return (typeof object.constructor == 'function' && !isPrototype$3(object))
      ? baseCreate(getPrototype$1(object))
      : {};
  }

  var _initCloneObject = initCloneObject$1;

  /**
   * Checks if `value` is object-like. A value is object-like if it's not `null`
   * and has a `typeof` result of "object".
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is object-like, else `false`.
   * @example
   *
   * _.isObjectLike({});
   * // => true
   *
   * _.isObjectLike([1, 2, 3]);
   * // => true
   *
   * _.isObjectLike(_.noop);
   * // => false
   *
   * _.isObjectLike(null);
   * // => false
   */

  function isObjectLike$7(value) {
    return value != null && typeof value == 'object';
  }

  var isObjectLike_1 = isObjectLike$7;

  var baseGetTag$5 = _baseGetTag,
      isObjectLike$6 = isObjectLike_1;

  /** `Object#toString` result references. */
  var argsTag$1 = '[object Arguments]';

  /**
   * The base implementation of `_.isArguments`.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an `arguments` object,
   */
  function baseIsArguments$1(value) {
    return isObjectLike$6(value) && baseGetTag$5(value) == argsTag$1;
  }

  var _baseIsArguments = baseIsArguments$1;

  var baseIsArguments = _baseIsArguments,
      isObjectLike$5 = isObjectLike_1;

  /** Used for built-in method references. */
  var objectProto$6 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$6 = objectProto$6.hasOwnProperty;

  /** Built-in value references. */
  var propertyIsEnumerable = objectProto$6.propertyIsEnumerable;

  /**
   * Checks if `value` is likely an `arguments` object.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an `arguments` object,
   *  else `false`.
   * @example
   *
   * _.isArguments(function() { return arguments; }());
   * // => true
   *
   * _.isArguments([1, 2, 3]);
   * // => false
   */
  var isArguments$3 = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
    return isObjectLike$5(value) && hasOwnProperty$6.call(value, 'callee') &&
      !propertyIsEnumerable.call(value, 'callee');
  };

  var isArguments_1 = isArguments$3;

  /**
   * Checks if `value` is classified as an `Array` object.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an array, else `false`.
   * @example
   *
   * _.isArray([1, 2, 3]);
   * // => true
   *
   * _.isArray(document.body.children);
   * // => false
   *
   * _.isArray('abc');
   * // => false
   *
   * _.isArray(_.noop);
   * // => false
   */

  var isArray$5 = Array.isArray;

  var isArray_1 = isArray$5;

  /** Used as references for various `Number` constants. */

  var MAX_SAFE_INTEGER$1 = 9007199254740991;

  /**
   * Checks if `value` is a valid array-like length.
   *
   * **Note:** This method is loosely based on
   * [`ToLength`](http://ecma-international.org/ecma-262/7.0/#sec-tolength).
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a valid length, else `false`.
   * @example
   *
   * _.isLength(3);
   * // => true
   *
   * _.isLength(Number.MIN_VALUE);
   * // => false
   *
   * _.isLength(Infinity);
   * // => false
   *
   * _.isLength('3');
   * // => false
   */
  function isLength$2(value) {
    return typeof value == 'number' &&
      value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER$1;
  }

  var isLength_1 = isLength$2;

  var isFunction$1 = isFunction_1,
      isLength$1 = isLength_1;

  /**
   * Checks if `value` is array-like. A value is considered array-like if it's
   * not a function and has a `value.length` that's an integer greater than or
   * equal to `0` and less than or equal to `Number.MAX_SAFE_INTEGER`.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is array-like, else `false`.
   * @example
   *
   * _.isArrayLike([1, 2, 3]);
   * // => true
   *
   * _.isArrayLike(document.body.children);
   * // => true
   *
   * _.isArrayLike('abc');
   * // => true
   *
   * _.isArrayLike(_.noop);
   * // => false
   */
  function isArrayLike$4(value) {
    return value != null && isLength$1(value.length) && !isFunction$1(value);
  }

  var isArrayLike_1 = isArrayLike$4;

  var isArrayLike$3 = isArrayLike_1,
      isObjectLike$4 = isObjectLike_1;

  /**
   * This method is like `_.isArrayLike` except that it also checks if `value`
   * is an object.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an array-like object,
   *  else `false`.
   * @example
   *
   * _.isArrayLikeObject([1, 2, 3]);
   * // => true
   *
   * _.isArrayLikeObject(document.body.children);
   * // => true
   *
   * _.isArrayLikeObject('abc');
   * // => false
   *
   * _.isArrayLikeObject(_.noop);
   * // => false
   */
  function isArrayLikeObject$1(value) {
    return isObjectLike$4(value) && isArrayLike$3(value);
  }

  var isArrayLikeObject_1 = isArrayLikeObject$1;

  var isBuffer$3 = {exports: {}};

  /**
   * This method returns `false`.
   *
   * @static
   * @memberOf _
   * @since 4.13.0
   * @category Util
   * @returns {boolean} Returns `false`.
   * @example
   *
   * _.times(2, _.stubFalse);
   * // => [false, false]
   */

  function stubFalse() {
    return false;
  }

  var stubFalse_1 = stubFalse;

  (function (module, exports) {
  var root = _root,
      stubFalse = stubFalse_1;

  /** Detect free variable `exports`. */
  var freeExports = exports && !exports.nodeType && exports;

  /** Detect free variable `module`. */
  var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports;

  /** Built-in value references. */
  var Buffer = moduleExports ? root.Buffer : undefined;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeIsBuffer = Buffer ? Buffer.isBuffer : undefined;

  /**
   * Checks if `value` is a buffer.
   *
   * @static
   * @memberOf _
   * @since 4.3.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a buffer, else `false`.
   * @example
   *
   * _.isBuffer(new Buffer(2));
   * // => true
   *
   * _.isBuffer(new Uint8Array(2));
   * // => false
   */
  var isBuffer = nativeIsBuffer || stubFalse;

  module.exports = isBuffer;
  }(isBuffer$3, isBuffer$3.exports));

  var baseGetTag$4 = _baseGetTag,
      getPrototype = _getPrototype,
      isObjectLike$3 = isObjectLike_1;

  /** `Object#toString` result references. */
  var objectTag$2 = '[object Object]';

  /** Used for built-in method references. */
  var funcProto = Function.prototype,
      objectProto$5 = Object.prototype;

  /** Used to resolve the decompiled source of functions. */
  var funcToString = funcProto.toString;

  /** Used to check objects for own properties. */
  var hasOwnProperty$5 = objectProto$5.hasOwnProperty;

  /** Used to infer the `Object` constructor. */
  var objectCtorString = funcToString.call(Object);

  /**
   * Checks if `value` is a plain object, that is, an object created by the
   * `Object` constructor or one with a `[[Prototype]]` of `null`.
   *
   * @static
   * @memberOf _
   * @since 0.8.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
   * @example
   *
   * function Foo() {
   *   this.a = 1;
   * }
   *
   * _.isPlainObject(new Foo);
   * // => false
   *
   * _.isPlainObject([1, 2, 3]);
   * // => false
   *
   * _.isPlainObject({ 'x': 0, 'y': 0 });
   * // => true
   *
   * _.isPlainObject(Object.create(null));
   * // => true
   */
  function isPlainObject$1(value) {
    if (!isObjectLike$3(value) || baseGetTag$4(value) != objectTag$2) {
      return false;
    }
    var proto = getPrototype(value);
    if (proto === null) {
      return true;
    }
    var Ctor = hasOwnProperty$5.call(proto, 'constructor') && proto.constructor;
    return typeof Ctor == 'function' && Ctor instanceof Ctor &&
      funcToString.call(Ctor) == objectCtorString;
  }

  var isPlainObject_1 = isPlainObject$1;

  var baseGetTag$3 = _baseGetTag,
      isLength = isLength_1,
      isObjectLike$2 = isObjectLike_1;

  /** `Object#toString` result references. */
  var argsTag = '[object Arguments]',
      arrayTag = '[object Array]',
      boolTag = '[object Boolean]',
      dateTag = '[object Date]',
      errorTag = '[object Error]',
      funcTag = '[object Function]',
      mapTag$2 = '[object Map]',
      numberTag = '[object Number]',
      objectTag$1 = '[object Object]',
      regexpTag = '[object RegExp]',
      setTag$2 = '[object Set]',
      stringTag$1 = '[object String]',
      weakMapTag$1 = '[object WeakMap]';

  var arrayBufferTag = '[object ArrayBuffer]',
      dataViewTag$1 = '[object DataView]',
      float32Tag = '[object Float32Array]',
      float64Tag = '[object Float64Array]',
      int8Tag = '[object Int8Array]',
      int16Tag = '[object Int16Array]',
      int32Tag = '[object Int32Array]',
      uint8Tag = '[object Uint8Array]',
      uint8ClampedTag = '[object Uint8ClampedArray]',
      uint16Tag = '[object Uint16Array]',
      uint32Tag = '[object Uint32Array]';

  /** Used to identify `toStringTag` values of typed arrays. */
  var typedArrayTags = {};
  typedArrayTags[float32Tag] = typedArrayTags[float64Tag] =
  typedArrayTags[int8Tag] = typedArrayTags[int16Tag] =
  typedArrayTags[int32Tag] = typedArrayTags[uint8Tag] =
  typedArrayTags[uint8ClampedTag] = typedArrayTags[uint16Tag] =
  typedArrayTags[uint32Tag] = true;
  typedArrayTags[argsTag] = typedArrayTags[arrayTag] =
  typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
  typedArrayTags[dataViewTag$1] = typedArrayTags[dateTag] =
  typedArrayTags[errorTag] = typedArrayTags[funcTag] =
  typedArrayTags[mapTag$2] = typedArrayTags[numberTag] =
  typedArrayTags[objectTag$1] = typedArrayTags[regexpTag] =
  typedArrayTags[setTag$2] = typedArrayTags[stringTag$1] =
  typedArrayTags[weakMapTag$1] = false;

  /**
   * The base implementation of `_.isTypedArray` without Node.js optimizations.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
   */
  function baseIsTypedArray$1(value) {
    return isObjectLike$2(value) &&
      isLength(value.length) && !!typedArrayTags[baseGetTag$3(value)];
  }

  var _baseIsTypedArray = baseIsTypedArray$1;

  /**
   * The base implementation of `_.unary` without support for storing metadata.
   *
   * @private
   * @param {Function} func The function to cap arguments for.
   * @returns {Function} Returns the new capped function.
   */

  function baseUnary$1(func) {
    return function(value) {
      return func(value);
    };
  }

  var _baseUnary = baseUnary$1;

  var _nodeUtil = {exports: {}};

  (function (module, exports) {
  var freeGlobal = _freeGlobal;

  /** Detect free variable `exports`. */
  var freeExports = exports && !exports.nodeType && exports;

  /** Detect free variable `module`. */
  var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports;

  /** Detect free variable `process` from Node.js. */
  var freeProcess = moduleExports && freeGlobal.process;

  /** Used to access faster Node.js helpers. */
  var nodeUtil = (function() {
    try {
      // Use `util.types` for Node.js 10+.
      var types = freeModule && freeModule.require && freeModule.require('util').types;

      if (types) {
        return types;
      }

      // Legacy `process.binding('util')` for Node.js < 10.
      return freeProcess && freeProcess.binding && freeProcess.binding('util');
    } catch (e) {}
  }());

  module.exports = nodeUtil;
  }(_nodeUtil, _nodeUtil.exports));

  var baseIsTypedArray = _baseIsTypedArray,
      baseUnary = _baseUnary,
      nodeUtil = _nodeUtil.exports;

  /* Node.js helper references. */
  var nodeIsTypedArray = nodeUtil && nodeUtil.isTypedArray;

  /**
   * Checks if `value` is classified as a typed array.
   *
   * @static
   * @memberOf _
   * @since 3.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
   * @example
   *
   * _.isTypedArray(new Uint8Array);
   * // => true
   *
   * _.isTypedArray([]);
   * // => false
   */
  var isTypedArray$3 = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

  var isTypedArray_1 = isTypedArray$3;

  /**
   * Gets the value at `key`, unless `key` is "__proto__" or "constructor".
   *
   * @private
   * @param {Object} object The object to query.
   * @param {string} key The key of the property to get.
   * @returns {*} Returns the property value.
   */

  function safeGet$2(object, key) {
    if (key === 'constructor' && typeof object[key] === 'function') {
      return;
    }

    if (key == '__proto__') {
      return;
    }

    return object[key];
  }

  var _safeGet = safeGet$2;

  var baseAssignValue$1 = _baseAssignValue,
      eq$1 = eq_1;

  /** Used for built-in method references. */
  var objectProto$4 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$4 = objectProto$4.hasOwnProperty;

  /**
   * Assigns `value` to `key` of `object` if the existing value is not equivalent
   * using [`SameValueZero`](http://ecma-international.org/ecma-262/7.0/#sec-samevaluezero)
   * for equality comparisons.
   *
   * @private
   * @param {Object} object The object to modify.
   * @param {string} key The key of the property to assign.
   * @param {*} value The value to assign.
   */
  function assignValue$1(object, key, value) {
    var objValue = object[key];
    if (!(hasOwnProperty$4.call(object, key) && eq$1(objValue, value)) ||
        (value === undefined && !(key in object))) {
      baseAssignValue$1(object, key, value);
    }
  }

  var _assignValue = assignValue$1;

  var assignValue = _assignValue,
      baseAssignValue = _baseAssignValue;

  /**
   * Copies properties of `source` to `object`.
   *
   * @private
   * @param {Object} source The object to copy properties from.
   * @param {Array} props The property identifiers to copy.
   * @param {Object} [object={}] The object to copy properties to.
   * @param {Function} [customizer] The function to customize copied values.
   * @returns {Object} Returns `object`.
   */
  function copyObject$1(source, props, object, customizer) {
    var isNew = !object;
    object || (object = {});

    var index = -1,
        length = props.length;

    while (++index < length) {
      var key = props[index];

      var newValue = customizer
        ? customizer(object[key], source[key], key, object, source)
        : undefined;

      if (newValue === undefined) {
        newValue = source[key];
      }
      if (isNew) {
        baseAssignValue(object, key, newValue);
      } else {
        assignValue(object, key, newValue);
      }
    }
    return object;
  }

  var _copyObject = copyObject$1;

  /**
   * The base implementation of `_.times` without support for iteratee shorthands
   * or max array length checks.
   *
   * @private
   * @param {number} n The number of times to invoke `iteratee`.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array} Returns the array of results.
   */

  function baseTimes$1(n, iteratee) {
    var index = -1,
        result = Array(n);

    while (++index < n) {
      result[index] = iteratee(index);
    }
    return result;
  }

  var _baseTimes = baseTimes$1;

  /** Used as references for various `Number` constants. */

  var MAX_SAFE_INTEGER = 9007199254740991;

  /** Used to detect unsigned integer values. */
  var reIsUint = /^(?:0|[1-9]\d*)$/;

  /**
   * Checks if `value` is a valid array-like index.
   *
   * @private
   * @param {*} value The value to check.
   * @param {number} [length=MAX_SAFE_INTEGER] The upper bounds of a valid index.
   * @returns {boolean} Returns `true` if `value` is a valid index, else `false`.
   */
  function isIndex$2(value, length) {
    var type = typeof value;
    length = length == null ? MAX_SAFE_INTEGER : length;

    return !!length &&
      (type == 'number' ||
        (type != 'symbol' && reIsUint.test(value))) &&
          (value > -1 && value % 1 == 0 && value < length);
  }

  var _isIndex = isIndex$2;

  var baseTimes = _baseTimes,
      isArguments$2 = isArguments_1,
      isArray$4 = isArray_1,
      isBuffer$2 = isBuffer$3.exports,
      isIndex$1 = _isIndex,
      isTypedArray$2 = isTypedArray_1;

  /** Used for built-in method references. */
  var objectProto$3 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$3 = objectProto$3.hasOwnProperty;

  /**
   * Creates an array of the enumerable property names of the array-like `value`.
   *
   * @private
   * @param {*} value The value to query.
   * @param {boolean} inherited Specify returning inherited property names.
   * @returns {Array} Returns the array of property names.
   */
  function arrayLikeKeys$1(value, inherited) {
    var isArr = isArray$4(value),
        isArg = !isArr && isArguments$2(value),
        isBuff = !isArr && !isArg && isBuffer$2(value),
        isType = !isArr && !isArg && !isBuff && isTypedArray$2(value),
        skipIndexes = isArr || isArg || isBuff || isType,
        result = skipIndexes ? baseTimes(value.length, String) : [],
        length = result.length;

    for (var key in value) {
      if ((inherited || hasOwnProperty$3.call(value, key)) &&
          !(skipIndexes && (
             // Safari 9 has enumerable `arguments.length` in strict mode.
             key == 'length' ||
             // Node.js 0.10 has enumerable non-index properties on buffers.
             (isBuff && (key == 'offset' || key == 'parent')) ||
             // PhantomJS 2 has enumerable non-index properties on typed arrays.
             (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
             // Skip index properties.
             isIndex$1(key, length)
          ))) {
        result.push(key);
      }
    }
    return result;
  }

  var _arrayLikeKeys = arrayLikeKeys$1;

  /**
   * This function is like
   * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
   * except that it includes inherited enumerable properties.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   */

  function nativeKeysIn$1(object) {
    var result = [];
    if (object != null) {
      for (var key in Object(object)) {
        result.push(key);
      }
    }
    return result;
  }

  var _nativeKeysIn = nativeKeysIn$1;

  var isObject$4 = isObject_1,
      isPrototype$2 = _isPrototype,
      nativeKeysIn = _nativeKeysIn;

  /** Used for built-in method references. */
  var objectProto$2 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$2 = objectProto$2.hasOwnProperty;

  /**
   * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   */
  function baseKeysIn$1(object) {
    if (!isObject$4(object)) {
      return nativeKeysIn(object);
    }
    var isProto = isPrototype$2(object),
        result = [];

    for (var key in object) {
      if (!(key == 'constructor' && (isProto || !hasOwnProperty$2.call(object, key)))) {
        result.push(key);
      }
    }
    return result;
  }

  var _baseKeysIn = baseKeysIn$1;

  var arrayLikeKeys = _arrayLikeKeys,
      baseKeysIn = _baseKeysIn,
      isArrayLike$2 = isArrayLike_1;

  /**
   * Creates an array of the own and inherited enumerable property names of `object`.
   *
   * **Note:** Non-object values are coerced to objects.
   *
   * @static
   * @memberOf _
   * @since 3.0.0
   * @category Object
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   * @example
   *
   * function Foo() {
   *   this.a = 1;
   *   this.b = 2;
   * }
   *
   * Foo.prototype.c = 3;
   *
   * _.keysIn(new Foo);
   * // => ['a', 'b', 'c'] (iteration order is not guaranteed)
   */
  function keysIn$2(object) {
    return isArrayLike$2(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
  }

  var keysIn_1 = keysIn$2;

  var copyObject = _copyObject,
      keysIn$1 = keysIn_1;

  /**
   * Converts `value` to a plain object flattening inherited enumerable string
   * keyed properties of `value` to own properties of the plain object.
   *
   * @static
   * @memberOf _
   * @since 3.0.0
   * @category Lang
   * @param {*} value The value to convert.
   * @returns {Object} Returns the converted plain object.
   * @example
   *
   * function Foo() {
   *   this.b = 2;
   * }
   *
   * Foo.prototype.c = 3;
   *
   * _.assign({ 'a': 1 }, new Foo);
   * // => { 'a': 1, 'b': 2 }
   *
   * _.assign({ 'a': 1 }, _.toPlainObject(new Foo));
   * // => { 'a': 1, 'b': 2, 'c': 3 }
   */
  function toPlainObject$1(value) {
    return copyObject(value, keysIn$1(value));
  }

  var toPlainObject_1 = toPlainObject$1;

  var assignMergeValue$1 = _assignMergeValue,
      cloneBuffer = _cloneBuffer.exports,
      cloneTypedArray = _cloneTypedArray,
      copyArray = _copyArray,
      initCloneObject = _initCloneObject,
      isArguments$1 = isArguments_1,
      isArray$3 = isArray_1,
      isArrayLikeObject = isArrayLikeObject_1,
      isBuffer$1 = isBuffer$3.exports,
      isFunction = isFunction_1,
      isObject$3 = isObject_1,
      isPlainObject = isPlainObject_1,
      isTypedArray$1 = isTypedArray_1,
      safeGet$1 = _safeGet,
      toPlainObject = toPlainObject_1;

  /**
   * A specialized version of `baseMerge` for arrays and objects which performs
   * deep merges and tracks traversed objects enabling objects with circular
   * references to be merged.
   *
   * @private
   * @param {Object} object The destination object.
   * @param {Object} source The source object.
   * @param {string} key The key of the value to merge.
   * @param {number} srcIndex The index of `source`.
   * @param {Function} mergeFunc The function to merge values.
   * @param {Function} [customizer] The function to customize assigned values.
   * @param {Object} [stack] Tracks traversed source values and their merged
   *  counterparts.
   */
  function baseMergeDeep$1(object, source, key, srcIndex, mergeFunc, customizer, stack) {
    var objValue = safeGet$1(object, key),
        srcValue = safeGet$1(source, key),
        stacked = stack.get(srcValue);

    if (stacked) {
      assignMergeValue$1(object, key, stacked);
      return;
    }
    var newValue = customizer
      ? customizer(objValue, srcValue, (key + ''), object, source, stack)
      : undefined;

    var isCommon = newValue === undefined;

    if (isCommon) {
      var isArr = isArray$3(srcValue),
          isBuff = !isArr && isBuffer$1(srcValue),
          isTyped = !isArr && !isBuff && isTypedArray$1(srcValue);

      newValue = srcValue;
      if (isArr || isBuff || isTyped) {
        if (isArray$3(objValue)) {
          newValue = objValue;
        }
        else if (isArrayLikeObject(objValue)) {
          newValue = copyArray(objValue);
        }
        else if (isBuff) {
          isCommon = false;
          newValue = cloneBuffer(srcValue, true);
        }
        else if (isTyped) {
          isCommon = false;
          newValue = cloneTypedArray(srcValue, true);
        }
        else {
          newValue = [];
        }
      }
      else if (isPlainObject(srcValue) || isArguments$1(srcValue)) {
        newValue = objValue;
        if (isArguments$1(objValue)) {
          newValue = toPlainObject(objValue);
        }
        else if (!isObject$3(objValue) || isFunction(objValue)) {
          newValue = initCloneObject(srcValue);
        }
      }
      else {
        isCommon = false;
      }
    }
    if (isCommon) {
      // Recursively merge objects and arrays (susceptible to call stack limits).
      stack.set(srcValue, newValue);
      mergeFunc(newValue, srcValue, srcIndex, customizer, stack);
      stack['delete'](srcValue);
    }
    assignMergeValue$1(object, key, newValue);
  }

  var _baseMergeDeep = baseMergeDeep$1;

  var Stack = _Stack,
      assignMergeValue = _assignMergeValue,
      baseFor = _baseFor,
      baseMergeDeep = _baseMergeDeep,
      isObject$2 = isObject_1,
      keysIn = keysIn_1,
      safeGet = _safeGet;

  /**
   * The base implementation of `_.merge` without support for multiple sources.
   *
   * @private
   * @param {Object} object The destination object.
   * @param {Object} source The source object.
   * @param {number} srcIndex The index of `source`.
   * @param {Function} [customizer] The function to customize merged values.
   * @param {Object} [stack] Tracks traversed source values and their merged
   *  counterparts.
   */
  function baseMerge$1(object, source, srcIndex, customizer, stack) {
    if (object === source) {
      return;
    }
    baseFor(source, function(srcValue, key) {
      stack || (stack = new Stack);
      if (isObject$2(srcValue)) {
        baseMergeDeep(object, source, key, srcIndex, baseMerge$1, customizer, stack);
      }
      else {
        var newValue = customizer
          ? customizer(safeGet(object, key), srcValue, (key + ''), object, source, stack)
          : undefined;

        if (newValue === undefined) {
          newValue = srcValue;
        }
        assignMergeValue(object, key, newValue);
      }
    }, keysIn);
  }

  var _baseMerge = baseMerge$1;

  /**
   * This method returns the first argument it receives.
   *
   * @static
   * @since 0.1.0
   * @memberOf _
   * @category Util
   * @param {*} value Any value.
   * @returns {*} Returns `value`.
   * @example
   *
   * var object = { 'a': 1 };
   *
   * console.log(_.identity(object) === object);
   * // => true
   */

  function identity$2(value) {
    return value;
  }

  var identity_1 = identity$2;

  /**
   * A faster alternative to `Function#apply`, this function invokes `func`
   * with the `this` binding of `thisArg` and the arguments of `args`.
   *
   * @private
   * @param {Function} func The function to invoke.
   * @param {*} thisArg The `this` binding of `func`.
   * @param {Array} args The arguments to invoke `func` with.
   * @returns {*} Returns the result of `func`.
   */

  function apply$1(func, thisArg, args) {
    switch (args.length) {
      case 0: return func.call(thisArg);
      case 1: return func.call(thisArg, args[0]);
      case 2: return func.call(thisArg, args[0], args[1]);
      case 3: return func.call(thisArg, args[0], args[1], args[2]);
    }
    return func.apply(thisArg, args);
  }

  var _apply = apply$1;

  var apply = _apply;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeMax = Math.max;

  /**
   * A specialized version of `baseRest` which transforms the rest array.
   *
   * @private
   * @param {Function} func The function to apply a rest parameter to.
   * @param {number} [start=func.length-1] The start position of the rest parameter.
   * @param {Function} transform The rest array transform.
   * @returns {Function} Returns the new function.
   */
  function overRest$1(func, start, transform) {
    start = nativeMax(start === undefined ? (func.length - 1) : start, 0);
    return function() {
      var args = arguments,
          index = -1,
          length = nativeMax(args.length - start, 0),
          array = Array(length);

      while (++index < length) {
        array[index] = args[start + index];
      }
      index = -1;
      var otherArgs = Array(start + 1);
      while (++index < start) {
        otherArgs[index] = args[index];
      }
      otherArgs[start] = transform(array);
      return apply(func, this, otherArgs);
    };
  }

  var _overRest = overRest$1;

  /**
   * Creates a function that returns `value`.
   *
   * @static
   * @memberOf _
   * @since 2.4.0
   * @category Util
   * @param {*} value The value to return from the new function.
   * @returns {Function} Returns the new constant function.
   * @example
   *
   * var objects = _.times(2, _.constant({ 'a': 1 }));
   *
   * console.log(objects);
   * // => [{ 'a': 1 }, { 'a': 1 }]
   *
   * console.log(objects[0] === objects[1]);
   * // => true
   */

  function constant$1(value) {
    return function() {
      return value;
    };
  }

  var constant_1 = constant$1;

  var constant = constant_1,
      defineProperty = _defineProperty,
      identity$1 = identity_1;

  /**
   * The base implementation of `setToString` without support for hot loop shorting.
   *
   * @private
   * @param {Function} func The function to modify.
   * @param {Function} string The `toString` result.
   * @returns {Function} Returns `func`.
   */
  var baseSetToString$1 = !defineProperty ? identity$1 : function(func, string) {
    return defineProperty(func, 'toString', {
      'configurable': true,
      'enumerable': false,
      'value': constant(string),
      'writable': true
    });
  };

  var _baseSetToString = baseSetToString$1;

  /** Used to detect hot functions by number of calls within a span of milliseconds. */

  var HOT_COUNT = 800,
      HOT_SPAN = 16;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeNow = Date.now;

  /**
   * Creates a function that'll short out and invoke `identity` instead
   * of `func` when it's called `HOT_COUNT` or more times in `HOT_SPAN`
   * milliseconds.
   *
   * @private
   * @param {Function} func The function to restrict.
   * @returns {Function} Returns the new shortable function.
   */
  function shortOut$1(func) {
    var count = 0,
        lastCalled = 0;

    return function() {
      var stamp = nativeNow(),
          remaining = HOT_SPAN - (stamp - lastCalled);

      lastCalled = stamp;
      if (remaining > 0) {
        if (++count >= HOT_COUNT) {
          return arguments[0];
        }
      } else {
        count = 0;
      }
      return func.apply(undefined, arguments);
    };
  }

  var _shortOut = shortOut$1;

  var baseSetToString = _baseSetToString,
      shortOut = _shortOut;

  /**
   * Sets the `toString` method of `func` to return `string`.
   *
   * @private
   * @param {Function} func The function to modify.
   * @param {Function} string The `toString` result.
   * @returns {Function} Returns `func`.
   */
  var setToString$1 = shortOut(baseSetToString);

  var _setToString = setToString$1;

  var identity = identity_1,
      overRest = _overRest,
      setToString = _setToString;

  /**
   * The base implementation of `_.rest` which doesn't validate or coerce arguments.
   *
   * @private
   * @param {Function} func The function to apply a rest parameter to.
   * @param {number} [start=func.length-1] The start position of the rest parameter.
   * @returns {Function} Returns the new function.
   */
  function baseRest$1(func, start) {
    return setToString(overRest(func, start, identity), func + '');
  }

  var _baseRest = baseRest$1;

  var eq = eq_1,
      isArrayLike$1 = isArrayLike_1,
      isIndex = _isIndex,
      isObject$1 = isObject_1;

  /**
   * Checks if the given arguments are from an iteratee call.
   *
   * @private
   * @param {*} value The potential iteratee value argument.
   * @param {*} index The potential iteratee index or key argument.
   * @param {*} object The potential iteratee object argument.
   * @returns {boolean} Returns `true` if the arguments are from an iteratee call,
   *  else `false`.
   */
  function isIterateeCall$1(value, index, object) {
    if (!isObject$1(object)) {
      return false;
    }
    var type = typeof index;
    if (type == 'number'
          ? (isArrayLike$1(object) && isIndex(index, object.length))
          : (type == 'string' && index in object)
        ) {
      return eq(object[index], value);
    }
    return false;
  }

  var _isIterateeCall = isIterateeCall$1;

  var baseRest = _baseRest,
      isIterateeCall = _isIterateeCall;

  /**
   * Creates a function like `_.assign`.
   *
   * @private
   * @param {Function} assigner The function to assign values.
   * @returns {Function} Returns the new assigner function.
   */
  function createAssigner$1(assigner) {
    return baseRest(function(object, sources) {
      var index = -1,
          length = sources.length,
          customizer = length > 1 ? sources[length - 1] : undefined,
          guard = length > 2 ? sources[2] : undefined;

      customizer = (assigner.length > 3 && typeof customizer == 'function')
        ? (length--, customizer)
        : undefined;

      if (guard && isIterateeCall(sources[0], sources[1], guard)) {
        customizer = length < 3 ? undefined : customizer;
        length = 1;
      }
      object = Object(object);
      while (++index < length) {
        var source = sources[index];
        if (source) {
          assigner(object, source, index, customizer);
        }
      }
      return object;
    });
  }

  var _createAssigner = createAssigner$1;

  var baseMerge = _baseMerge,
      createAssigner = _createAssigner;

  /**
   * This method is like `_.assign` except that it recursively merges own and
   * inherited enumerable string keyed properties of source objects into the
   * destination object. Source properties that resolve to `undefined` are
   * skipped if a destination value exists. Array and plain object properties
   * are merged recursively. Other objects and value types are overridden by
   * assignment. Source objects are applied from left to right. Subsequent
   * sources overwrite property assignments of previous sources.
   *
   * **Note:** This method mutates `object`.
   *
   * @static
   * @memberOf _
   * @since 0.5.0
   * @category Object
   * @param {Object} object The destination object.
   * @param {...Object} [sources] The source objects.
   * @returns {Object} Returns `object`.
   * @example
   *
   * var object = {
   *   'a': [{ 'b': 2 }, { 'd': 4 }]
   * };
   *
   * var other = {
   *   'a': [{ 'c': 3 }, { 'e': 5 }]
   * };
   *
   * _.merge(object, other);
   * // => { 'a': [{ 'b': 2, 'c': 3 }, { 'd': 4, 'e': 5 }] }
   */
  var merge = createAssigner(function(object, source, srcIndex) {
    baseMerge(object, source, srcIndex);
  });

  var merge_1 = merge;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  //!ICE 自定的事件名称常量，原生 DOM 事件的名称不变。
  const ICE_EVENT_NAME_CONSTS = {
    ICE_FRAME_EVENT: 'ICE_FRAME_EVENT',
    BEFORE_RENDER: 'BEFORE_RENDER',
    AFTER_RENDER: 'AFTER_RENDER',
    BEFORE_ADD: 'BEFORE_ADD',
    //在 addChild() 方法中的第一行执行
    AFTER_ADD: 'AFTER_ADD',
    //在 addChild() 方法返回之前执行
    BEFORE_REMOVE: 'BEFORE_REMOVE',
    //在 removeChild() 方法中的第一行执行
    AFTER_REMOVE: 'AFTER_REMOVE',
    //在 removeChild() 方法返回之前执行
    ROUND_FINISH: 'ROUND_FINISH',
    //当渲染器完成一轮渲染时，会触发此事件
    HOOK_MOUSEDOWN: 'HOOK_MOUSEDOWN',
    HOOK_MOUSEMOVE: 'HOOK_MOUSEMOVE',
    HOOK_MOUSEUP: 'HOOK_MOUSEUP',
    BEFORE_RESIZE: 'BEFORE_RESIZE',
    AFTER_RESIZE: 'AFTER_RESIZE',
    BEFORE_ROTATE: 'BEFORE_ROTATE',
    AFTER_ROTATE: 'AFTER_ROTATE',
    BEFORE_MOVE: 'BEFORE_MOVE',
    AFTER_MOVE: 'AFTER_MOVE'
  };

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * @class ICEEvent
   *
   * - 在 ICE 中，所有事件都会被转化成 ICEEvent 进行处理。
   * - ICEEvent 用来模拟 W3C 定义的 Event 接口，ICE 自定义的事件也使用此实现，事件对象上能获取到的属性不同。
   * - 从原始 DOM 事件转发出来的 ICEEvent 实例包含 Event 接口上所定义的所有属性，ICE 内部代码创建的 ICEEvent 实例上只包含很少的自定义属性。
   * - 如果事件是从原始 DOM 事件包装而来，那么ICEEvent 实例的 originalEvent 属性是原始 DOM 事件对象，否则 originalEvent 属性为 null。
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Event
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class ICEEvent {
    constructor() {
      let evt = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      let data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      this.originalEvent = void 0;
      this.param = void 0;

      for (let p in evt) {
        this[p] = evt[p];
      }

      for (let p in data) {
        this[p] = data[p];
      }
    }

  }

  var overArg = _overArg;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeKeys$1 = overArg(Object.keys, Object);

  var _nativeKeys = nativeKeys$1;

  var isPrototype$1 = _isPrototype,
      nativeKeys = _nativeKeys;

  /** Used for built-in method references. */
  var objectProto$1 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$1 = objectProto$1.hasOwnProperty;

  /**
   * The base implementation of `_.keys` which doesn't treat sparse arrays as dense.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   */
  function baseKeys$1(object) {
    if (!isPrototype$1(object)) {
      return nativeKeys(object);
    }
    var result = [];
    for (var key in Object(object)) {
      if (hasOwnProperty$1.call(object, key) && key != 'constructor') {
        result.push(key);
      }
    }
    return result;
  }

  var _baseKeys = baseKeys$1;

  var getNative$3 = _getNative,
      root$6 = _root;

  /* Built-in method references that are verified to be native. */
  var DataView$1 = getNative$3(root$6, 'DataView');

  var _DataView = DataView$1;

  var getNative$2 = _getNative,
      root$5 = _root;

  /* Built-in method references that are verified to be native. */
  var Promise$2 = getNative$2(root$5, 'Promise');

  var _Promise = Promise$2;

  var getNative$1 = _getNative,
      root$4 = _root;

  /* Built-in method references that are verified to be native. */
  var Set$1 = getNative$1(root$4, 'Set');

  var _Set = Set$1;

  var getNative = _getNative,
      root$3 = _root;

  /* Built-in method references that are verified to be native. */
  var WeakMap$1 = getNative(root$3, 'WeakMap');

  var _WeakMap = WeakMap$1;

  var DataView = _DataView,
      Map$1 = _Map,
      Promise$1 = _Promise,
      Set = _Set,
      WeakMap = _WeakMap,
      baseGetTag$2 = _baseGetTag,
      toSource = _toSource;

  /** `Object#toString` result references. */
  var mapTag$1 = '[object Map]',
      objectTag = '[object Object]',
      promiseTag = '[object Promise]',
      setTag$1 = '[object Set]',
      weakMapTag = '[object WeakMap]';

  var dataViewTag = '[object DataView]';

  /** Used to detect maps, sets, and weakmaps. */
  var dataViewCtorString = toSource(DataView),
      mapCtorString = toSource(Map$1),
      promiseCtorString = toSource(Promise$1),
      setCtorString = toSource(Set),
      weakMapCtorString = toSource(WeakMap);

  /**
   * Gets the `toStringTag` of `value`.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the `toStringTag`.
   */
  var getTag$1 = baseGetTag$2;

  // Fallback for data views, maps, sets, and weak maps in IE 11 and promises in Node.js < 6.
  if ((DataView && getTag$1(new DataView(new ArrayBuffer(1))) != dataViewTag) ||
      (Map$1 && getTag$1(new Map$1) != mapTag$1) ||
      (Promise$1 && getTag$1(Promise$1.resolve()) != promiseTag) ||
      (Set && getTag$1(new Set) != setTag$1) ||
      (WeakMap && getTag$1(new WeakMap) != weakMapTag)) {
    getTag$1 = function(value) {
      var result = baseGetTag$2(value),
          Ctor = result == objectTag ? value.constructor : undefined,
          ctorString = Ctor ? toSource(Ctor) : '';

      if (ctorString) {
        switch (ctorString) {
          case dataViewCtorString: return dataViewTag;
          case mapCtorString: return mapTag$1;
          case promiseCtorString: return promiseTag;
          case setCtorString: return setTag$1;
          case weakMapCtorString: return weakMapTag;
        }
      }
      return result;
    };
  }

  var _getTag = getTag$1;

  var baseKeys = _baseKeys,
      getTag = _getTag,
      isArguments = isArguments_1,
      isArray$2 = isArray_1,
      isArrayLike = isArrayLike_1,
      isBuffer = isBuffer$3.exports,
      isPrototype = _isPrototype,
      isTypedArray = isTypedArray_1;

  /** `Object#toString` result references. */
  var mapTag = '[object Map]',
      setTag = '[object Set]';

  /** Used for built-in method references. */
  var objectProto = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty = objectProto.hasOwnProperty;

  /**
   * Checks if `value` is an empty object, collection, map, or set.
   *
   * Objects are considered empty if they have no own enumerable string keyed
   * properties.
   *
   * Array-like values such as `arguments` objects, arrays, buffers, strings, or
   * jQuery-like collections are considered empty if they have a `length` of `0`.
   * Similarly, maps and sets are considered empty if they have a `size` of `0`.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is empty, else `false`.
   * @example
   *
   * _.isEmpty(null);
   * // => true
   *
   * _.isEmpty(true);
   * // => true
   *
   * _.isEmpty(1);
   * // => true
   *
   * _.isEmpty([1, 2, 3]);
   * // => false
   *
   * _.isEmpty({ 'a': 1 });
   * // => false
   */
  function isEmpty(value) {
    if (value == null) {
      return true;
    }
    if (isArrayLike(value) &&
        (isArray$2(value) || typeof value == 'string' || typeof value.splice == 'function' ||
          isBuffer(value) || isTypedArray(value) || isArguments(value))) {
      return !value.length;
    }
    var tag = getTag(value);
    if (tag == mapTag || tag == setTag) {
      return !value.size;
    }
    if (isPrototype(value)) {
      return !baseKeys(value).length;
    }
    for (var key in value) {
      if (hasOwnProperty.call(value, key)) {
        return false;
      }
    }
    return true;
  }

  var isEmpty_1 = isEmpty;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  let root$1 = null;

  (() => {
    root$1 = window || global || {};
    root$1.requestFrame = root$1.requestAnimationFrame || root$1.webkitRequestAnimationFrame || root$1.mozRequestAnimationFrame || root$1.oRequestAnimationFrame || root$1.msRequestAnimationFrame; // ||
    // function (callback) {
    //   root.setTimeout(callback, 1000 / FPS);
    // };
  })();

  var root$2 = root$1;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICEEventTarget
   *
   * - canvas 标签内部没有事件机制，模仿 W3C 定义的 EventTaregt 接口，为 Canvas 内部的组件添加事件机制。
   * - ICE 内部的大部分组件都是 ICEEventTarget 的子类。
   * - 部分 API 名称模仿 jQuery ，方便使用者调用。
   *
   * TODO:需要完整模拟 W3C 和 jQuery 提供的事件接口，在 API 名称和调用逻辑上保持完全一致。
   *
   * listeners 的结构：
   * {
   *    "click":[
   *        {
   *          callback:fn1,
   *          scope:window
   *        },
   *        {
   *          callback:fn2,
   *          scope:component-1
   *        }
   *     ],
   *    "mousemove":[
   *        {
   *          callback:fn1,
   *          scope:window
   *        },
   *        {
   *          callback:fn2,
   *          scope:component-1
   *        }
   *     ]
   * }
   *
   * @abstract
   * @author 大漠穷秋<damoqiongqiu@126.com>
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
   */

  class ICEEventTarget {
    constructor() {
      this.listeners = {};
      this.suspendedEventNames = [];
    }
    /**
     * @method on
     * 添加事件监听
     * @param eventName
     * @param fn
     * @param scope
     */


    on(eventName, fn) {
      let scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : root$2;

      if (!this.listeners[eventName]) {
        this.listeners[eventName] = [];
      }

      this.off(eventName, fn, scope);
      this.listeners[eventName].push({
        callback: fn,
        scope: scope
      });
    }
    /**
     * @method off
     * 删除事件监听
     * @param eventName
     * @param fn
     * @param scope
     * @returns
     */


    off(eventName, fn) {
      let scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : root$2;
      let arr = this.listeners[eventName];
      if (!arr) return;
      arr = [...arr];

      for (let i = 0; i < arr.length; i++) {
        let item = arr[i];

        if (item.callback === fn && item.scope === scope) {
          this.listeners[eventName].splice(i, 1);
          return;
        }
      }
    }
    /**
     * @method once
     * 一次性事件，触发一次就自动删除自己。
     * @param eventName
     * @param fn
     */


    once(eventName, fn) {
      let scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : root$2;
      const that = this;

      function callback(evt) {
        that.off(eventName, callback, scope);
        fn.call(scope, evt);
      }

      that.on(eventName, callback, scope);
    }
    /**
     * @method dispatchEvent
     *
     * 触发事件。
     *
     * 所有事件都会被转换成 ICEEvent 实例。
     *
     * @param eventName
     * @param originalEvent
     * @param param
     * @returns
     */


    trigger(eventName) {
      let originalEvent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      let param = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      if (isEmpty_1(this.listeners[eventName])) return false;
      if (this.suspendedEventNames.includes(eventName)) return false;
      let iceEvent;

      if (originalEvent) {
        iceEvent = new ICEEvent(originalEvent);
        iceEvent.originalEvent = originalEvent.originalEvent ? originalEvent.originalEvent : originalEvent;
        iceEvent.param = { ...param
        };
      } else {
        iceEvent = new ICEEvent({
          type: eventName,
          timeStamp: Date.now(),
          param: { ...param
          }
        });
      }

      let arr = this.listeners[eventName];

      for (let i = 0; i < arr.length; i++) {
        let item = arr[i];
        item.callback.call(item.scope, iceEvent);
      }

      return true;
    }
    /**
     * @method suspend
     * 挂起事件。
     * @param eventName
     */


    suspend(eventName) {
      if (eventName && !this.suspendedEventNames.includes(eventName)) {
        this.suspendedEventNames.push(eventName);
      }
    }
    /**
     * @method resume
     * 恢复事件。
     * @param eventName
     */


    resume(eventName) {
      this.suspendedEventNames.splice(this.suspendedEventNames.findIndex(el => el === eventName), 1);
    }
    /**
     * @method purgeEvents
     * 清除所有事件。
     */


    purgeEvents() {
      this.listeners = {};
      this.suspendedEventNames = [];
    }
    /**
     * @method hasListener
     * 查询是否带有某个事件监听器。
     * @param eventName
     * @param fn
     * @param scope
     * @returns
     */


    hasListener(eventName, fn) {
      let scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : root$2;

      if (!this.listeners[eventName]) {
        return false;
      }

      let arr = this.listeners[eventName];
      if (!arr) return false;

      for (let i = 0; i < arr.length; i++) {
        let item = arr[i];

        if (item.callback === fn && item.scope === scope) {
          return true;
        }
      }

      return false;
    }

  } //增加别名，模拟 W3C 的 EventTarget 接口


  ICEEventTarget.prototype.addEventListener = ICEEventTarget.prototype.on;
  ICEEventTarget.prototype.removeEventListener = ICEEventTarget.prototype.off;
  ICEEventTarget.prototype.dispatchEvent = ICEEventTarget.prototype.trigger;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICEBoundingBox 用4点法描述的边界盒子。
   *
   * - 边界盒子一定是矩形。
   * - 边界盒子总是绘制在全局坐标系中。
   * - 边界盒子总是通过自身的坐标点进行变换，而不是变换 canvas.ctx 。
   * - 边界盒子总是通过组件的参数计算出来的，直接修改边界盒子不影响组件本身的参数。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEBoundingBox {
    //top-left
    //top-right
    //bottom-left
    //bottom-right
    //center-point
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      this.tl = [0, 0];
      this.tr = [0, 0];
      this.bl = [0, 0];
      this.br = [0, 0];
      this.center = [0, 0];
      this.tl = [props[0], props[1]];
      this.tr = [props[2], props[3]];
      this.bl = [props[4], props[5]];
      this.br = [props[6], props[7]];
      this.center = [props[8], props[9]];
    }
    /**
     * 从指定的 top/left/width/height 构建 ICEBoundingBox。
     * @param left
     * @param top
     * @param width
     * @param height
     * @returns
     */


    static fromDimension(left, top, width, height) {
      let tl = [left, top];
      let tr = [left + width, top];
      let bl = [left, top + height];
      let br = [left + width, top + height];
      let center = [left + width / 2, top + height / 2];
      return new ICEBoundingBox([...tl, ...tr, ...bl, ...br, ...center]);
    }
    /**
     * 判断指定的坐标点是否位于边界矩形内部，向右水平射线法。
     * 这里参考了 fabricjs 的实现方式。
     * @see http://fabricjs.com/
     * @param point
     * @returns
     */


    containsPoint(point) {
      //只考虑凸包的情况：[x,y]有一个值位于最大最小值之外，则不可能包含在边界盒子内部。
      const {
        minX,
        minY,
        maxX,
        maxY
      } = this.getMinAndMaxPoint();

      if (point[0] < minX || point[0] > maxX || point[1] < minY || point[1] > maxY) {
        return false;
      }

      let xcount = 0; //交叉点个数

      let xi; //交点的 x 坐标

      const boudingLines = this.getBoundingLines();

      for (let i = 0; i < boudingLines.length; i++) {
        const line = boudingLines[i]; //特例1：点位于线段下方，水平射线不可能与线段交叉

        if (point[1] > line.o[1] && point[1] > line.d[1]) {
          continue;
        } //特例2：点位于线段上方，水平射线不可能与线段交叉


        if (point[1] < line.o[1] && point[1] < line.d[1]) {
          continue;
        }

        if (line.o[0] === line.d[0] && line.o[0] >= point[0]) {
          //特例3：处理垂直于 x 轴（平行于 y 轴）的特殊情况
          xi = line.o[0];
        } else {
          //斜率法求向右的射线与线段的交点 x 坐标
          const k = (line.d[1] - line.o[1]) / (line.d[0] - line.o[0]); //斜率

          xi = line.o[0] + (point[1] - line.o[1]) / k;
        }

        if (xi > point[0]) {
          //只处理向右侧的射线情况即可
          xcount++;
        }

        if (xcount === 2) {
          continue;
        }
      }

      return xcount !== 0 && xcount % 2 === 1;
    }
    /**
     * 获取边界盒子的边所构成的线段，由于边界盒子总是被定义成 4 边形，这里直接简化处理。
     */


    getBoundingLines() {
      const line_1 = {
        o: [...this.tl],
        d: [...this.tr]
      }; //o:origin, d:destination

      const line_2 = {
        o: [...this.tr],
        d: [...this.br]
      };
      const line_3 = {
        o: [...this.br],
        d: [...this.bl]
      };
      const line_4 = {
        o: [...this.bl],
        d: [...this.tl]
      };
      return [line_1, line_2, line_3, line_4];
    }
    /**
     * 获取边界盒子 x,y 的最大和最小值
     * @returns
     */


    getMinAndMaxPoint() {
      //取任意一个顶点坐标作为初始值，然后与其它3个顶点的坐标进行比较
      let minX = this.tl[0];
      let minY = this.tl[1];
      let maxX = this.tl[0];
      let maxY = this.tl[1];
      const arr = [this.tr, this.bl, this.br];

      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];

        if (p[0] < minX) {
          minX = p[0];
        }

        if (p[0] > maxX) {
          maxX = p[0];
        }

        if (p[1] < minY) {
          minY = p[1];
        }

        if (p[1] > maxY) {
          maxY = p[1];
        }
      }

      return {
        minX,
        minY,
        maxX,
        maxY
      };
    }
    /**
     * FIXME:需要实现
     * 另一个边界盒子是否完全位于当前盒子内部。
     * @param box
     * @returns
     */


    containsBox(box) {
      return false;
    }
    /**
     * 是否与另一个盒子存在相交的部分。
     * @param box
     * @returns
     */


    isIntersect(box) {
      let left1 = this.tl[0];
      let right1 = this.br[0];
      let top1 = this.tl[1];
      let bottom1 = this.br[1];
      let left2 = box.tl[0];
      let right2 = box.br[0];
      let top2 = box.tl[1];
      let bottom2 = box.br[1];
      let isIntersect = !(left1 > right2 || top1 > bottom2 || right1 < left2 || bottom1 < top2);
      return isIntersect;
    }
    /**
     * @param matrix
     * @returns A new ICEBoundingBox instance.
     */


    transform(matrix) {
      const tl = transformMat2d([], this.tl, matrix);
      const tr = transformMat2d([], this.tr, matrix);
      const bl = transformMat2d([], this.bl, matrix);
      const br = transformMat2d([], this.br, matrix);
      const center = transformMat2d([], this.center, matrix);
      return new ICEBoundingBox([...tl, ...tr, ...bl, ...br, ...center]);
    }
    /**
     * @param box
     * @returns A new ICEBoundingBox instance.
     */


    union(box) {
      return null;
    }

    get width() {
      const deltaX = this.br[0] - this.bl[0];
      const deltaY = this.br[1] - this.bl[1];
      return Math.hypot(deltaX, deltaY);
    }

    get height() {
      const deltaX = this.br[0] - this.tr[0];
      const deltaY = this.br[1] - this.tr[1];
      return Math.hypot(deltaX, deltaY);
    }

    get left() {
      return this.tl[0];
    } //不允许设置 left 参数


    set left(num) {
      throw new Error('Can not set left to ICEBoundingBox directly.');
    }

    get top() {
      return this.tl[1];
    } //不允许设置 top 参数


    set top(num) {
      throw new Error('Can not set top to ICEBoundingBox directly.');
    }

    get centerX() {
      return this.center[0];
    }

    get centerY() {
      return this.center[1];
    }

    get centerPoint() {
      return this.center;
    } //FIXME:这里的计算方法有问题，需要重新实现


    get topCenter() {
      return [this.tl[0] + (this.tr[0] - this.tl[0]) / 2, this.tl[1] + (this.tr[1] - this.tl[1]) / 2];
    } //FIXME:这里的计算方法有问题，需要重新实现


    get rightCenter() {
      return [this.tr[0] + (this.br[0] - this.tr[0]) / 2, this.tr[1] + (this.br[1] - this.tr[1]) / 2];
    } //FIXME:这里的计算方法有问题，需要重新实现


    get bottomCenter() {
      return [this.bl[0] + (this.br[0] - this.bl[0]) / 2, this.bl[1] + (this.br[1] - this.bl[1]) / 2];
    } //FIXME:这里的计算方法有问题，需要重新实现


    get leftCenter() {
      return [this.tl[0] + (this.bl[0] - this.tl[0]) / 2, this.tl[1] + (this.bl[1] - this.tl[1]) / 2];
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  class ICEMatrix {
    constructor() {}
    /**
     * 从变换矩阵计算旋转角度。
     * @param matrix
     * @returns 角度
     */


    static calcRotateAngleFromMatrix(matrix) {
      let radians = 0;
      let a = matrix[0];
      let b = matrix[1];
      const temp = Math.hypot(a, b);
      let sin = b / temp;
      let cos = a / temp;
      radians = Math.acos(cos);

      if (sin < 0) {
        radians += Math.PI / 2;
      }

      return radians * (180 / Math.PI);
    }
    /**
     * 从变换矩阵计算缩放参数。
     * @param matrix
     * @returns 缩放数组
     */


    static calcScaleFromMatrix(matrix) {
      let a = matrix[0];
      let b = matrix[1];
      let c = matrix[2];
      let d = matrix[3];
      const scaleX = Math.hypot(a, b) / a;
      const scaleY = Math.hypot(c, d) / d;
      return [scaleX, scaleY];
    }

  }

  /**
   * 按照指定的路径获取 Object 上的值
   * @param {*} object
   * @param {*} path
   * @returns
   */
  function getVal(object, path) {
    return path.split('.').reduce((res, prop) => res[prop], object);
  }
  /**
   * @method flattenTree
   *
   * 把 tree 形结构拉平成数组结构。
   *
   * @param result
   * @param childNodes
   * @param level
   * @param pid
   * @returns
   */

  function flattenTree() {
    let result = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];
    let childNodes = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];
    let level = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 1;
    let pid = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : null;

    for (let i = 0; i < childNodes.length; i++) {
      const node = childNodes[i];
      node._level = level;
      node._pid = pid;
      result.push(node);
      flattenTree(result, node.childNodes || [], level + 1, node.id);
    }

    return result;
  }

  /**
   * !gl-matrix 的当前版本中没有提供 skew 函数，需要手动合 https://github.com/toji/gl-matrix/pull/293
   * @see https://github.com/talltyler/gl-matrix/commit/7c408d649073f6240f4694041ceb2af5f5284658
   */

  /**
   * Skew (shear) a mat2d by the given angle
   *
   * @param {mat2d} out the receiving matrix
   * @param {mat2d} a the matrix to skew
   * @param {Number} rad the angle to skew the matrix by
   * @param {Number} rad the angle to skew the matrix by
   * @returns {mat2d} out
   */
  function skew(out, a, radX, radY) {
    let x = Math.tan(radX);
    let y = Math.tan(radY);
    out[0] = a[0];
    out[1] = a[1] + x;
    out[2] = a[2] + y;
    out[3] = a[3];
    out[4] = a[4];
    out[5] = a[5];
    return out;
  }

  /**
   * @see https://www.w3resource.com/javascript-exercises/javascript-math-exercise-23.php
   */
  function uuid() {
    if (root$2.crypto) {
      return root$2.crypto.randomUUID();
    } else {
      var dt = Date.now();
      var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (dt + Math.random() * 16) % 16 | 0;
        dt = Math.floor(dt / 16);
        return (c == 'x' ? r : r & 0x3 | 0x8).toString(16);
      });
      return uuid;
    }
  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICEComponent
   *
   * 最顶级的抽象类，Canvas 内部所有可见的组件都是它的子类。
   *
   * @abstract
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEComponent extends ICEEventTarget {
    //组件当前归属的 ICE 实例，在处理一些内部逻辑时需要引用当前所在的 ICE 实例。只有当组件被 addChild() 方法加入到显示列表中之后， ice 属性才会有值。
    //当对象被添加到 canvas 中时，ICE 会自动设置 root 的值，没有被添加到 canvas 中的对象 root 为 null 。
    //当对象被添加到 canvas 中时，ICE 会自动设置 ctx 的值，没有被添加到 canvas 中的对象 ctx 为 null 。
    //事件总线， evtBus 在 render() 方法被调用时才会被设置，在被渲染出来之前，evtBus 为 null 。
    //所有组件都有父组件，但不一定都有子组件，只有容器型的组件才有子组件。如果父组件为 null ，说明直接添加在 canvas 中。
    //静态属性，实例计数器

    /**
     * @cfg
     * {
     *   id: 'ICE_XXXXXXX',                                      //UUID
     *   left: 0,                                                //x 坐标相对于父组件的偏移量
     *   top: 0,                                                 //y 坐标相对于父组件的偏移量
     *   width: 0,                                               //原始宽度，没有经过变换
     *   height: 0,                                              //原始高度，没有经过变换
     *   style: { fillStyle: 'red', strokeStyle: 'blue', lineWidth: 1 },
     *   animations: {},
     *   transform: {                                            //组件自身的变换参数，不包含父组件
     *     translate: [0, 0],                                    //平移，像素
     *     scale: [1, 1],                                        //X轴缩放倍数，Y轴缩放倍数
     *     skew: [0, 0],                                         //X轴扭曲角度，Y轴扭曲角度
     *     rotate: 0,                                            //旋转角度
     *   },
     *   linearMatrix: [],                            //线性变换矩阵，不含平移，按照 gl-matrix 的格式定义
     *   composedMatrix: [],                          //复合变换矩阵，包含所有祖先节点的平移、原点移动、线性变换计算，composedMatrix 不会实时更新，如果需要获取当前最新的变换矩阵，需要调用 composeMatrix() 方法。按照 gl-matrix 的格式定义
     *   origin:'localCenter',
     *   localOrigin: [0,0],                          //相对于组件本地坐标系（组件内部的左上角为 [0,0] 点）计算的原点坐标
     *   absoluteOrigin: [0,0],                       //相对于全局坐标系（canvas 的左上角 [0,0] 点）计算的原点坐标
     *   zIndex: ICEComponent.instanceCounter++,      //类似于 CSS 中的 zIndex
     *   display:true,                                //如果 display 为 false ， Renderer 不会调用其 render 方法，对象在内存中存在，但是不会被渲染出来。如果 display 为 false ，所有子组件也不会被渲染出来。
     *   draggable:true,                              //是否可以拖动
     *   transformable:true,                          //是否可以进行变换：scale/rotate/skew ，以及 resize ，但是不控制拖动
     *   linkable:true,                               //组件是否可以用连接线连接起来，如果此状态为 true ，ICELinkSlotManager 在运行时会动态在组件上创建连接插槽 ICELinkSlot 的实例
     *   interactive: true,                           //是否可以进行用户交互操作，如果此参数为 false ， draggable, transformable TODO:动画运行过程中不允许选中，不能进行交互？？？
     *   showMinBoundingBox:true,                     //是否显示最小包围盒，开发时打开，主要用于 debug
     *   showMaxBoundingBox:true,                     //是否显示最大包围盒，开发时打开，主要用于 debug
     * }
     * @param props
     */

    /**
     * 在 ICE 引擎中，所有对象都可以启用动画效果，所以对象的 state 随时可能发生变化。
     * props 与 state 之间的关系与行为模式借鉴自 React 框架，概念模型完全一致。
     * @see https://reactjs.org/docs/components-and-props.html
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super();
      this.ice = void 0;
      this.root = void 0;
      this.ctx = void 0;
      this.evtBus = void 0;
      this.parentNode = void 0;
      this.__dirty = true;
      this.props = {
        id: 'ICE_' + uuid(),
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        style: {
          fillStyle: 'red',
          strokeStyle: 'blue',
          lineWidth: 1
        },
        fill: true,
        stroke: true,
        animations: {},
        transform: {
          translate: [0, 0],
          scale: [1, 1],
          skew: [0, 0],
          rotate: 0 //degree

        },
        linearMatrix: [],
        composedMatrix: [],
        origin: 'localCenter',
        localOrigin: [0, 0],
        absoluteOrigin: [0, 0],
        zIndex: ICEComponent.instanceCounter++,
        display: true,
        draggable: true,
        transformable: true,
        interactive: true,
        linkable: true,
        showMinBoundingBox: true,
        showMaxBoundingBox: true
      };
      this.state = { ...this.props
      };
      this.props = merge_1(this.props, props);
      this.state = JSON.parse(JSON.stringify(this.props));
      this.initEvents();
    }
    /**
     * 子类需要提供自己的实现。
     */


    initEvents() {}
    /**
     * !Important: 核心方法，FrameManager 会调度此方法进行实际的渲染操作。
     * !Important: 这些方法调用有顺序
     */


    render() {
      this.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_RENDER);

      if (!this.state.display) {
        return;
      }

      this.calcComponentParams();
      this.applyStyleToCtx();
      this.applyTransformToCtx();
      this.doRender();
      this.trigger(ICE_EVENT_NAME_CONSTS.AFTER_RENDER);
      this.dirty = false;
    }

    applyStyleToCtx() {
      const _style = { ...this.props.style,
        ...this.state.style
      };

      for (let p in _style) {
        this.ctx[p] = _style[p];
      }
    }
    /**
     * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
     * 此方法不能依赖原点位置和 transform 矩阵。
     * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     * @returns
     */


    calcComponentParams() {
      return {
        width: this.state.width,
        height: this.state.height
      };
    }
    /**
     * 计算本地原点坐标，相对于组件本地坐标系。
     * 此方法依赖于 width/height ，需要先计算组件的尺寸，然后才能调用此方法。
     * @returns
     */


    calcLocalOrigin() {
      let point = [0, 0];
      let position = this.state.origin;

      if (!position || position === 'localCenter') {
        let halfWidth = this.state.width / 2;
        let halfHeight = this.state.height / 2;
        point[0] = halfWidth;
        point[1] = halfHeight;
      } //FIXME:计算原点位于其它位置的情况


      this.state.localOrigin = point;
      return point;
    }
    /**
     * 根据原点位置描述计算原点坐标值。
     * 移动坐标原点后，组件内部所有的坐标点数值、边界盒子的坐标，都会受到影响。
     * 计算出的原点数值已经包含了所有父层的移位和变换。
     * @method calcAbsoluteOrigin
     */


    calcAbsoluteOrigin() {
      let tx = getVal(this, 'state.transform.translate.0') + this.state.left;
      let ty = getVal(this, 'state.transform.translate.1') + this.state.top;
      let point = [...this.calcLocalOrigin()];
      point[0] += tx;
      point[1] += ty;

      if (this.parentNode) {
        let pLocalX = this.parentNode.state.localOrigin[0];
        let pLocalY = this.parentNode.state.localOrigin[1];
        point = transformMat2d([], point, [1, 0, 0, 1, -pLocalX, -pLocalY]);
        let pcm = this.parentNode.state.composedMatrix;
        point = transformMat2d([], point, pcm);
      }

      this.state.absoluteOrigin = point;
      return point;
    }
    /**
     * 计算线性变换矩阵，此矩阵不包含平移操作。
     * 线性变换顺序：旋转->错切->缩放
     * 由于矩阵变换有顺序，这里采用符合自然理解的顺序进行。
     * @method calcLinearMatrix
     * @returns
     */


    calcLinearMatrix() {
      let matrix = create$1(); //step1: skew

      const skewX = getVal(this, 'state.transform.skew.0');
      const skewY = getVal(this, 'state.transform.skew.1');
      matrix = skew([], matrix, toRadian(skewX), toRadian(skewY)); //step2: rotate

      let angle = getVal(this, 'state.transform.rotate');
      matrix = rotate([], matrix, toRadian(angle)); //step3: scale

      const scaleX = getVal(this, 'state.transform.scale.0');
      const scaleY = getVal(this, 'state.transform.scale.1');
      matrix = scale([], matrix, [scaleX, scaleY]);
      this.state.linearMatrix = matrix;
      return matrix;
    }
    /**
     * 复合所有祖先节点的线性变换矩阵，获得相对于全局 canvas 对象的变换矩阵。
     * @returns
     */


    calcAbsoluteLinearMatrix() {
      let component = this;
      let matrix = component.calcLinearMatrix();

      while (component.parentNode) {
        matrix = multiply([], component.parentNode.state.linearMatrix, matrix);
        component = component.parentNode;
      }

      this.state.absoluteLinearMatrix = matrix;
      return matrix;
    }
    /**
     * 仿射变换由2步完成：
     * - ctx 平移到指定的原点。
     * - ctx 进行线性变换。
     *
     * Canvas 绘图过程中的仿射变换动作与线性代数中的规则有差异：
     * - Canvas 的 Y 坐标轴方向是向下的。
     * - Canvas 在做仿射变换时，变换的是 ctx 本身，而不是组件对象，相当于画布本身是具有弹性的可变形对象。
     *
     * @method composeMatrix
     * @returns
     */


    composeMatrix() {
      //step-1: 移动到指定原点（全局坐标系）。
      let origin = this.calcAbsoluteOrigin();
      let translationMatrix = [1, 0, 0, 1, origin[0], origin[1]]; //step-2: 计算线性变换矩阵，包含了所有祖先节点的线性变换。

      let linearMatrix = this.calcAbsoluteLinearMatrix(); //step-3: 计算综合变换矩阵，相当于先在 canvas 默认原点（左上角位置）进行变换，然后在平移到计算出的原点位置。

      let composedMatrix = multiply([], translationMatrix, linearMatrix);
      this.state.composedMatrix = composedMatrix;
      return composedMatrix;
    }
    /**
     * 把变换矩阵应用到 this.ctx 上
     */


    applyTransformToCtx() {
      let matrix = this.dirty ? this.composeMatrix() : this.state.composedMatrix;
      this.ctx.setTransform(...matrix);
    }
    /**
     * 所有子类都应该提供具体的实现。
     * @method doRender
     */


    doRender() {
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.lineWidth = 1;

      if (this.state.showMinBoundingBox) {
        let minBox = this.getMinBoundingBox();
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.fillStyle = 'rgba(0,0,0,0)';
        this.ctx.beginPath();
        this.ctx.moveTo(minBox.tl[0], minBox.tl[1]);
        this.ctx.lineTo(minBox.tr[0], minBox.tr[1]);
        this.ctx.lineTo(minBox.br[0], minBox.br[1]);
        this.ctx.lineTo(minBox.bl[0], minBox.bl[1]);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();
      }

      if (this.state.showMaxBoundingBox) {
        let maxBox = this.getMaxBoundingBox();
        this.ctx.strokeStyle = '#0000ff';
        this.ctx.fillStyle = 'rgba(0,0,0,0)';
        this.ctx.beginPath();
        this.ctx.moveTo(maxBox.tl[0], maxBox.tl[1]);
        this.ctx.lineTo(maxBox.tr[0], maxBox.tr[1]);
        this.ctx.lineTo(maxBox.br[0], maxBox.br[1]);
        this.ctx.lineTo(maxBox.bl[0], maxBox.bl[1]);
        this.ctx.closePath();
        this.ctx.stroke();
        this.ctx.fill();
      }
    }
    /**
     * 获取组件的最小包围盒，此盒子的变换矩阵与组件自身完全相同。
     * 此方法需要在 render() 之后调用，组件没有渲染时无法计算最小包围盒。
     * @returns
     */


    getMinBoundingBox() {
      let refresh = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      //先基于组件本地坐标系进行计算
      let originX = this.state.localOrigin[0];
      let originY = this.state.localOrigin[1];
      let width = this.state.width;
      let height = this.state.height;
      let boundingBox = new ICEBoundingBox([0 - originX, 0 - originY, 0 - originX + width, 0 - originY, 0 - originX, 0 - originY + height, 0 - originX + width, 0 - originY + height, 0, 0]); //再用 composedMatrix 进行变换

      const matrix = refresh ? this.composeMatrix() : this.state.composedMatrix;
      boundingBox = boundingBox.transform(matrix);
      return boundingBox;
    }
    /**
     * 获取组件的最大包围盒：
     * - 盒子保持水平和竖直，不旋转、不错切。
     * - 盒子的4边在全局坐标 X/Y 轴上的投影范围与组件完全一致。
     * @returns
     */


    getMaxBoundingBox() {
      let refresh = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      let boundingBox = this.getMinBoundingBox(refresh);
      let {
        minX,
        minY,
        maxX,
        maxY
      } = boundingBox.getMinAndMaxPoint();
      let center = boundingBox.centerPoint;
      boundingBox = new ICEBoundingBox([minX, minY, maxX, minY, minX, maxY, maxX, maxY, center[0], center[1]]);
      return boundingBox;
    }
    /**
     * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
     * @param newState
     */


    setState(newState) {
      merge_1(this.state, newState);
      this.dirty = true;

      if (this.ice) {
        this.ice.dirty = true;
      }
    }

    set dirty(flag) {
      this.__dirty = flag; //FIXME:加上时间控制，避免过度绘制
    }

    get dirty() {
      return this.__dirty;
    }
    /**
     * 相对于父组件的坐标系和原点。
     * @param left
     * @param top
     * @param evt
     */


    setPosition(left, top) {
      let evt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new ICEEvent();
      this.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_MOVE, { ...evt,
        left,
        top
      });
      this.setState({
        left,
        top
      });
      this.trigger(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, { ...evt,
        left,
        top
      });
    }
    /**
     * 在全局空间(canvas)中移动指定的位移。
     * 注意：此方法用于直接设置组件在全局空间中的位移，而不是相对于其它坐标系。
     * @param tx
     * @param ty
     * @param evt
     */


    moveGlobalPosition(tx, ty) {
      let evt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new ICEEvent();

      //如果组件存在嵌套，需要先用逆矩阵抵消所有祖先节点 transform 导致的坐标偏移。
      if (this.parentNode) {
        let point = [tx, ty];
        let matrix = invert([], this.parentNode.state.absoluteLinearMatrix);
        point = transformMat2d([], point, matrix);
        tx = point[0];
        ty = point[1];
      }

      this.setPosition(this.state.left + tx, this.state.top + ty, { ...evt,
        tx,
        ty
      });
    }
    /**
     * 直接设置在全局空间 (canvas) 中的位置。
     * 注意：此方法用于直接设置组件在全局空间中的位置，而不是相对于其它坐标系。
     * @param left
     * @param top
     * @param evt
     */


    setGlobalPosition(left, top) {
      let evt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new ICEEvent();

      //如果组件存在嵌套，需要先用逆矩阵抵消所有祖先节点 transform 导致的坐标偏移。
      if (this.parentNode) {
        let point = [left, top];
        let matrix = invert([], this.parentNode.state.absoluteLinearMatrix);
        point = transformMat2d([], point, matrix);
        left = point[0];
        top = point[1];
      }

      this.setPosition(left, top, { ...evt,
        left,
        top
      });
    }
    /**
     * 在全局空间(canvas)中旋转指定的角度。
     * 注意：此方法用于直接设置组件在全局空间中的旋转角，而不是相对于其它坐标系。
     * @param rotateAngle
     */


    setGlobalRotate(rotateAngle) {
      if (this.parentNode) {
        //组件存在嵌套的情况下，减掉所有祖先节点旋转角的总和。
        let matrix = this.parentNode.state.absoluteLinearMatrix;
        let angle = ICEMatrix.calcRotateAngleFromMatrix(matrix);
        rotateAngle -= angle;
      }

      this.setState({
        transform: {
          rotate: rotateAngle
        }
      });
    }
    /**
     * 组件局部坐标系中的点转换成全局空间(canvas)中的点，包含移动原点的操作。
     * @param localX
     * @param localY
     * @returns
     */


    localToGlobal(localX, localY) {
      let point = [localX, localY];
      let matrix = this.state.composedMatrix;
      point = transformMat2d([], point, matrix);
      return point;
    }
    /**
     * 全局空间(canvas)中的点转换成组件局部坐标系中的点，包含移动原点的操作。
     * @param globalX
     * @param globalY
     * @returns
     */


    globalToLocal(globalX, globalY) {
      let point = [globalX, globalY];
      let matrix = invert([], this.state.composedMatrix);
      point = transformMat2d([], point, matrix);
      return point;
    }
    /**
     * 根据变换矩阵计算组件在全局空间(canvas)中的旋转角度。
     * @returns
     */


    getRotateAngle() {
      return this.state.transform.rotate;
    }

    getLocalLeftTop() {
      let box = this.getMinBoundingBox(true);
      let width = box.width;
      let height = box.height;
      let left = box.centerX - box.width / 2;
      let top = box.centerY - box.height / 2;
      return {
        left,
        top,
        width,
        height
      };
    }

    containsPoint(x, y) {
      return this.getMinBoundingBox().containsPoint([x, y]);
    }
    /**
     * @method destory
     * 销毁组件
     * - FIXME:立即停止组件上的所有动画效果
     * - 需要清理绑定的事件
     * - 带有子节点的组件需要先销毁子节点，然后再销毁自身。
     */


    destory() {
      this.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, null, {
        component: this
      });
      this.purgeEvents();
      this.ice = null;
      this.ctx = null;
      this.root = null;
      this.evtBus = null;
      this.parentNode = null;
    }

  }

  ICEComponent.instanceCounter = 0;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  const defaultSrc = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALkAAAC2CAYAAACF+yyJAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAtoSURBVHhe7Z3tj15FHYb9VxUVo7zFUBWC8YXoF9++GENMRAWRKAkxGj8pihpjFBVF1CBlKaUU+wK0pYVqt12fn+6xs7PXnDPzO3O2Z+a5r+T6ss995nm2vXf3vM68570vXNuTsmdVctm9KrnsXpVcdq9KLrtXJZfdq5LL7lXJZfeq5LJ7VXLZvSq57F6VXHavSi67VyWX3auSy+5VyWX3quSye1Vy2b0quexelVx2r0ouu1cll92rksvuVcll96rksntVctm9KrnsXpVcdq9KLrtXJZfdq5LL7lXJZfeq5LJ7VfIjcIy7j/M2sp4q+YKWQNvLOqrkC+nhodO7OJacp0q+gHO4/2UVvbYqeWXH+O2lG3sf29nd++Eb1/e/wtC40q9KXtGfX+Dy3v4PzpspKCt9quQVJSgXS1BO+lTJK0pQLvab/zz8F+CjL3FWlquSV/KBE7v79bwJ5VISlJPlquSV/AXsj1MuJUE5Wa5KXsmfvKWSr1WVvJJ2BiWGciljLm/2figny1XJK0pQLvbS4d15zEmfKnlFicfPXsdsKEE56VMlr+hdx7mwqV2P75/ji0dvboahvPSpkle2BjSu9KuSL+AcaDw5T5V8IT3QOHK+KvmCni/oOm0v66iSO/zz5Rv71cwr56Nn+ADzmUs3MB8bQq/LcVVyhzHvg0wsQbnYmCfPTZ+SlAdVyQv92mm4crPhzokHkgnKhaagrEyrkjtM8eAr6UfXCMoNpqCsHFcld5rC7g3PzVPOTPHZkR8imbbpkqeg7BKm+NXFw0Un4swH4CavgTuOaH6Wd/gYGbOt2GTJc8k5IJxrileuHjxzQoSv37uTHutWfh8x9zU4m0BTJd959+apu1z+tdmExgoN+euVvNN6oSnCe1aI4bUvneKDWWPI5PrhFw++F2VC6dG7HGistdpMyc/9u7zgA/bfSGMOxlBmyhT2qVOv29efSNykZYTj5xrz2Jn0KcdvOQs+QGOu0SZKbn+u5/LAyJ/ZGO/uQSnPvp3+waXxc4x57nL6L9Ncnh0Ze002UfIUlDVTUNYkKJdjDWjcHD938vBuD+XMFJQ1U1B2ba6+5HZWgaBsKPFwhdN7Oc6BxsuVoJxJUC6UuJi4V35Nrr7kBOVIYk6uRA80TonEnBxJUG5NquQbbZLNGMqVWgJtX2rMcNA7lTMoR9JRBOXWZHMlt4d+KUc+VTBNRIydzaFcqTnQdqXeVjBbAEE5ki5YUW5NNlfy+CLLmN876y+5QTmPYyc/Ke+RoJxJUC5lDGXWpHZX9iUo55WgnFeCciZBOfL5K4d/ZCm3JlXyfR+BBxso55WgnFeCciZBOZKg3Jpcfcl/nJiwnrKhqWt5x3byLwr98kK9BxQIynmNscn+KWemoGxo6uIVZdfk6ktupqCseW1sJ3gf2o6gnEeCch4vwPCUy4G2M/8OuykGZddmEyW3ZUjG+PSJ3f9etr+eUe6Y8H2I8PU5EpTzSISv0370FF8+tbv38c1fA/oBCgnfZ602UXJzSexGJXsPe7A4Jv4cXgnKeSTs6zXu+Rkj/hxrtZmSm15yt6Xc11+vc/80QTmPMXb7Qg60bS7xZ1izTZXcLLmn/Orm/zrc1vubLRzDK0G5Un9zsXxXxB7GDsewSUlLCLdtweZKPjh2f/m7Ublj/zhyiytBY5RKUK7UEuy7pjEGfwZXiENomxZstuQ1zIW2LfE1ezwpAeVLzIW23Ra3uuSDOdB2U9rzkDn8yfnwQQ73ahU5/SYv4Y3NJjQO6eGDI4vahqYmOBpjm5dM3KqSp66elnL3yPQQNaBxB2twttIdlq3YfcmXJHyfF96ZPpgdzvb84HzeD1s4/pJ8pvNJi7or+e8Lz5wQdrXPxqIFaGNy/zbEn9PM4W8ZVyvte7bxPhRNR+Hh7YL79Vuxq5J7ic+nx6ZmlcqBxoudA403+LuJ2yHGoPFadWtL/qnNb2kaY8wShlsFch2bIo6gMcYsvRBmD5zQOC26NSWvdbD1/oky2k1itF2uT8Py5SHfrVS+qYNw2qZVuyq5FSDkngVPmxGU80pQrpYhdqsyZVq1uwPPo5KgnFeCcnJaldwpQTmvBOXktCq5U4JyXgnKyWlVcqcE5bwSlJPTquROCcp5JSgnp1XJnRKU80pQTk6rkjslKOeVoJycViV3SlDOK0E5Oa1K7pSgnFeCcnJaldwpQTmvBOXktF2VPL6sP/Zww1wJynklKFfLkKm7Mluzq5KPUesGram7Be3mVtou119PTDGhG7TK3ZqSx3xy4VttHx1ZWpC05ztLoDHG1K22nehl6mkYPTTRtt0deP6hwuNvX3z1f7/l7bf9FLmTjMaf08zBVoiewiZLsvFqPP4WriLdi92VPPQoJ7zMeZB5WAJdDzIfrV2XPLbWlBR3aUqKptyqkseWcqagHB40udAybnXJB3Og7ab8ROY0cXaASNtPmXM4oGni9Js8C9q2xFOa8POW2mzJbdchhZ3yo20GS8/A0BilEpQrtQT7rmmMQVsIbAzapgWbK/lLmoT/gJ5J+L/62sGzKY/B8o5jhNu2YFMl95K7LeVaXE7lG6/nlZa2zSX+DGu2mZIvyTDbFV0hjD+HV4JyHgn7+lFeJ1izTZQ8Z4lDuzqpJQ5vEr6ec9U05guv7u7d//Lu3lsTPyfh+6zVJkqegrLmyDHp/6HtCMp5JCjn8SgWq039oFB2ba6+5LWXHS9ZjrvlZceP7XDOTEHZ0NRZKcquydWXnKAcSVDOfATOMFDOK0E5rwTlTIJyJEG5NamS70tQzitBOa8E5UyCcuRzlw//Nqfcmmyu5Ceu5l8Ctxv/YyhnEpTzOHZCj/IeCcqZBOVSxlBmTTZX8pLlPmjxVcqZMbYYLuVKzYG2K5XmTaecSVCOLHmftajdlY12qiyGcqWWQNuXGmM7Fjk5g3IkHXpSbk2q5AW5Ej3QOCUSc3IkQbk1ufqS33Hc9w9LfDuxjg9BuVznQOPlSlDOJCgXStg5esquydWX3ExBWTMFZU2CcjnWgMbN8fMn83e7UlDWTEHZtdlEyUtXRiPGpqCIsXs+KDdlKc+PXG6n8XOMsVN+lDPnYldBady12UTJTVvX3kvqAGwwhjJTphjem7CvP3EufYIxHD/XmO+MzP9iN6bNgcZco82U3Bx7wibF1AMUZshfRn7zpUxxJXhvYnjtK6fSj8kNmVzvjI5hKBP6sLPoNNZabarkg7l4dztKTHEyumhFhK8f20kX/VZ+HzH23Cptv2abLPlgCsouYQqbzzAnG2duHzn2+MiLB7NLaWt4Ekfxg7aUTZf8VpoitQ9MUM5M4VkqXarkLlM8ODITFUG5wRSUleOq5IWmJvaxAz7KDxKUC01BWZlWJXcYcxtkYgnKxcY8ea7egxzbokruMLynml6PtbnKiWcyZ84KodfluCr5gp5P73EcgraXdVTJF9IDjSPnq5Iv4BxoPDlPlbyyNaBxpV+VvKK2pCJxaZeL+zg8g2q8uRmG8tKnSl5RImdJQoJy0qdKXlGCcrEX4foS5aRPlbySdHMV5VLGlMxKIMdVySv504LpL0iCcrJclbyStEoD5VISlJPlquSVpIVtKZeSoJwsVyWvKEG5WHrWcpuXJKytSl5RgnKxBOWkT5W8ok8nVk+zNe8pb6agrPSpkld2DLu11hYB+NHE8uc0rvSrki/gHO5r8Gn4tauSL6SHh06r4Euoki9oCbS9rKNKfgSOcY9OFS6uSi67VyWX3auSy+5VyWX3quSye1Vy2b0quexelVx2r0ouu1cll92rksvuVcll96rksntVctm9KrnsXpVcdq9KLrtXJZfdq5LL7lXJZfeq5LJ7VXLZvSq57F6VXHavSi67VyWX3auSy+5VyWX3quSye1Vy2b0quezca3v/AeMnvtkH1pHJAAAAAElFTkSuQmCC';
  /**
   * @class ICEImage
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEImage extends ICEComponent {
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        width: 100,
        height: 100,
        src: defaultSrc,
        ...props
      });
    }

    doRender() {
      if (this.state.src) {
        const {
          loaded,
          image
        } = this.ice.imageCache.setImage(this.state.src);

        if (loaded) {
          this.ctx.drawImage(image, 0 - this.state.localOrigin[0], 0 - this.state.localOrigin[1], this.state.width, this.state.height);
        }
      }

      super.doRender();
    }

  }

  /**
   * Checks if `value` is `null` or `undefined`.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is nullish, else `false`.
   * @example
   *
   * _.isNil(null);
   * // => true
   *
   * _.isNil(void 0);
   * // => true
   *
   * _.isNil(NaN);
   * // => false
   */

  function isNil(value) {
    return value == null;
  }

  var isNil_1 = isNil;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * @class GeoLine
   * A geometrically line, invisible, no dimension, just used for mathematical operations.
   * This implementation is improved from http://diagramo.com/ .
   *
   *
   * 几何学意义上的直线，它不可见，没有宽度，用来进行数学运算。此实现从 diagramo 改进而来：http://diagramo.com/ 。
   *
   * @docauthor 大漠穷秋 <damoqiongqiu@126.com>
   */
  class GeoLine {
    constructor(startPoint, endPoint) {
      this.startPoint = startPoint;
      this.endPoint = endPoint;
    }

    contains(x, y) {
      let delta = 3;
      let lineLength = Math.hypot(this.endPoint.x - this.startPoint.x, this.endPoint.y - this.startPoint.y);
      let len1 = Math.hypot(x - this.startPoint.x, y - this.startPoint.y);
      let len2 = Math.hypot(x - this.endPoint.x, y - this.endPoint.y);

      if (len1 + len2 >= lineLength - delta && len1 + len2 <= lineLength + delta) {
        return true;
      }

      return false;
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * @class GeoPoint
   * A geometrically point, invisible, no dimension, just used for mathematical operations.
   * This implementation is improved from http://diagramo.com/ .
   *
   *
   * 几何学意义上的点，它不可见，没有大小，用来进行数学运算。此实现从 diagramo 改进而来：http://diagramo.com/ 。
   *
   * @docauthor 大漠穷秋 <damoqiongqiu@126.com>
   */
  class GeoPoint {
    /**
     * @constructor GeoPoint
     * @param {*} x
     * @param {*} y
     */
    constructor() {
      let x = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 0;
      let y = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
      this.x = x;
      this.y = y;
    }
    /**
     *
     * @method load
     * Creates a {GeoPoint} out of JSON parsed object.
     *
     *
     * 从 JSON 对象创建 {GeoPoint} 实例。
     * @param {JSONObject} o the JSON parsed object
     * @return {GeoPoint} a newly constructed GeoPoint
     */


    static load(o) {
      return new GeoPoint(Number(o.x), Number(o.y));
    }
    /**
     *
     * @method cloneArray
     * Clones an array of points.
     *
     *
     * 克隆一组点。
     * @param {Array} v - the array of {GeoPoint}s
     * @return an {Array} of {GeoPoint}s
     */


    static cloneArray(v) {
      let newPoints = [];

      for (let i = 0; i < v.length; i++) {
        newPoints.push(v[i].clone());
      }

      return newPoints;
    }
    /**
     * @method equals
     * Tests if this point is equals to other point.
     *
     *
     * 测试当前点是否与另一个点相等。
     * @param {GeoPoint} anotherPoint - the other point
     */


    equals(anotherPoint) {
      return this.x == anotherPoint.x && this.y == anotherPoint.y;
    }
    /**
     * @method clone
     * Clone current GeoPoint.
     *
     *
     * 克隆当前点。
     */


    clone() {
      let newPoint = new GeoPoint(this.x, this.y);
      return newPoint;
    }

  }

  /** Used to match a single whitespace character. */

  var reWhitespace = /\s/;

  /**
   * Used by `_.trim` and `_.trimEnd` to get the index of the last non-whitespace
   * character of `string`.
   *
   * @private
   * @param {string} string The string to inspect.
   * @returns {number} Returns the index of the last non-whitespace character.
   */
  function trimmedEndIndex$1(string) {
    var index = string.length;

    while (index-- && reWhitespace.test(string.charAt(index))) {}
    return index;
  }

  var _trimmedEndIndex = trimmedEndIndex$1;

  var trimmedEndIndex = _trimmedEndIndex;

  /** Used to match leading whitespace. */
  var reTrimStart = /^\s+/;

  /**
   * The base implementation of `_.trim`.
   *
   * @private
   * @param {string} string The string to trim.
   * @returns {string} Returns the trimmed string.
   */
  function baseTrim$1(string) {
    return string
      ? string.slice(0, trimmedEndIndex(string) + 1).replace(reTrimStart, '')
      : string;
  }

  var _baseTrim = baseTrim$1;

  var baseGetTag$1 = _baseGetTag,
      isObjectLike$1 = isObjectLike_1;

  /** `Object#toString` result references. */
  var symbolTag = '[object Symbol]';

  /**
   * Checks if `value` is classified as a `Symbol` primitive or object.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a symbol, else `false`.
   * @example
   *
   * _.isSymbol(Symbol.iterator);
   * // => true
   *
   * _.isSymbol('abc');
   * // => false
   */
  function isSymbol$2(value) {
    return typeof value == 'symbol' ||
      (isObjectLike$1(value) && baseGetTag$1(value) == symbolTag);
  }

  var isSymbol_1 = isSymbol$2;

  var baseTrim = _baseTrim,
      isObject = isObject_1,
      isSymbol$1 = isSymbol_1;

  /** Used as references for various `Number` constants. */
  var NAN = 0 / 0;

  /** Used to detect bad signed hexadecimal string values. */
  var reIsBadHex = /^[-+]0x[0-9a-f]+$/i;

  /** Used to detect binary string values. */
  var reIsBinary = /^0b[01]+$/i;

  /** Used to detect octal string values. */
  var reIsOctal = /^0o[0-7]+$/i;

  /** Built-in method references without a dependency on `root`. */
  var freeParseInt = parseInt;

  /**
   * Converts `value` to a number.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to process.
   * @returns {number} Returns the number.
   * @example
   *
   * _.toNumber(3.2);
   * // => 3.2
   *
   * _.toNumber(Number.MIN_VALUE);
   * // => 5e-324
   *
   * _.toNumber(Infinity);
   * // => Infinity
   *
   * _.toNumber('3.2');
   * // => 3.2
   */
  function toNumber$2(value) {
    if (typeof value == 'number') {
      return value;
    }
    if (isSymbol$1(value)) {
      return NAN;
    }
    if (isObject(value)) {
      var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
      value = isObject(other) ? (other + '') : other;
    }
    if (typeof value != 'string') {
      return value === 0 ? value : +value;
    }
    value = baseTrim(value);
    var isBinary = reIsBinary.test(value);
    return (isBinary || reIsOctal.test(value))
      ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
      : (reIsBadHex.test(value) ? NAN : +value);
  }

  var toNumber_1 = toNumber$2;

  var toNumber$1 = toNumber_1;

  /** Used as references for various `Number` constants. */
  var INFINITY$1 = 1 / 0,
      MAX_INTEGER = 1.7976931348623157e+308;

  /**
   * Converts `value` to a finite number.
   *
   * @static
   * @memberOf _
   * @since 4.12.0
   * @category Lang
   * @param {*} value The value to convert.
   * @returns {number} Returns the converted number.
   * @example
   *
   * _.toFinite(3.2);
   * // => 3.2
   *
   * _.toFinite(Number.MIN_VALUE);
   * // => 5e-324
   *
   * _.toFinite(Infinity);
   * // => 1.7976931348623157e+308
   *
   * _.toFinite('3.2');
   * // => 3.2
   */
  function toFinite$1(value) {
    if (!value) {
      return value === 0 ? value : 0;
    }
    value = toNumber$1(value);
    if (value === INFINITY$1 || value === -INFINITY$1) {
      var sign = (value < 0 ? -1 : 1);
      return sign * MAX_INTEGER;
    }
    return value === value ? value : 0;
  }

  var toFinite_1 = toFinite$1;

  var toFinite = toFinite_1;

  /**
   * Converts `value` to an integer.
   *
   * **Note:** This method is loosely based on
   * [`ToInteger`](http://www.ecma-international.org/ecma-262/7.0/#sec-tointeger).
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to convert.
   * @returns {number} Returns the converted integer.
   * @example
   *
   * _.toInteger(3.2);
   * // => 3
   *
   * _.toInteger(Number.MIN_VALUE);
   * // => 0
   *
   * _.toInteger(Infinity);
   * // => 1.7976931348623157e+308
   *
   * _.toInteger('3.2');
   * // => 3
   */
  function toInteger$1(value) {
    var result = toFinite(value),
        remainder = result % 1;

    return result === result ? (remainder ? result - remainder : result) : 0;
  }

  var toInteger_1 = toInteger$1;

  /**
   * A specialized version of `_.map` for arrays without support for iteratee
   * shorthands.
   *
   * @private
   * @param {Array} [array] The array to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array} Returns the new mapped array.
   */

  function arrayMap$1(array, iteratee) {
    var index = -1,
        length = array == null ? 0 : array.length,
        result = Array(length);

    while (++index < length) {
      result[index] = iteratee(array[index], index, array);
    }
    return result;
  }

  var _arrayMap = arrayMap$1;

  var Symbol = _Symbol,
      arrayMap = _arrayMap,
      isArray$1 = isArray_1,
      isSymbol = isSymbol_1;

  /** Used as references for various `Number` constants. */
  var INFINITY = 1 / 0;

  /** Used to convert symbols to primitives and strings. */
  var symbolProto = Symbol ? Symbol.prototype : undefined,
      symbolToString = symbolProto ? symbolProto.toString : undefined;

  /**
   * The base implementation of `_.toString` which doesn't convert nullish
   * values to empty strings.
   *
   * @private
   * @param {*} value The value to process.
   * @returns {string} Returns the string.
   */
  function baseToString$1(value) {
    // Exit early for strings to avoid a performance hit in some environments.
    if (typeof value == 'string') {
      return value;
    }
    if (isArray$1(value)) {
      // Recursively convert values (susceptible to call stack limits).
      return arrayMap(value, baseToString$1) + '';
    }
    if (isSymbol(value)) {
      return symbolToString ? symbolToString.call(value) : '';
    }
    var result = (value + '');
    return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
  }

  var _baseToString = baseToString$1;

  var baseToString = _baseToString;

  /**
   * Converts `value` to a string. An empty string is returned for `null`
   * and `undefined` values. The sign of `-0` is preserved.
   *
   * @static
   * @memberOf _
   * @since 4.0.0
   * @category Lang
   * @param {*} value The value to convert.
   * @returns {string} Returns the converted string.
   * @example
   *
   * _.toString(null);
   * // => ''
   *
   * _.toString(-0);
   * // => '-0'
   *
   * _.toString([1, 2, 3]);
   * // => '1,2,3'
   */
  function toString$1(value) {
    return value == null ? '' : baseToString(value);
  }

  var toString_1 = toString$1;

  var root = _root,
      toInteger = toInteger_1,
      toNumber = toNumber_1,
      toString = toString_1;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeIsFinite = root.isFinite,
      nativeMin = Math.min;

  /**
   * Creates a function like `_.round`.
   *
   * @private
   * @param {string} methodName The name of the `Math` method to use when rounding.
   * @returns {Function} Returns the new round function.
   */
  function createRound$1(methodName) {
    var func = Math[methodName];
    return function(number, precision) {
      number = toNumber(number);
      precision = precision == null ? 0 : nativeMin(toInteger(precision), 292);
      if (precision && nativeIsFinite(number)) {
        // Shift with exponential notation to avoid floating-point issues.
        // See [MDN](https://mdn.io/round#Examples) for more details.
        var pair = (toString(number) + 'e').split('e'),
            value = func(pair[0] + 'e' + (+pair[1] + precision));

        pair = (toString(value) + 'e').split('e');
        return +(pair[0] + 'e' + (+pair[1] - precision));
      }
      return func(number);
    };
  }

  var _createRound = createRound$1;

  var createRound = _createRound;

  /**
   * Computes `number` rounded to `precision`.
   *
   * @static
   * @memberOf _
   * @since 3.10.0
   * @category Math
   * @param {number} number The number to round.
   * @param {number} [precision=0] The precision to round to.
   * @returns {number} Returns the rounded number.
   * @example
   *
   * _.round(4.006);
   * // => 4
   *
   * _.round(4.006, 2);
   * // => 4.01
   *
   * _.round(4060, -2);
   * // => 4100
   */
  var round = createRound('round');

  var round_1 = round;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  class GeoUtil {
    constructor() {
      throw new Error('GeoUtil is a static util class.');
    }
    /**
     *
     * 已知向量原点和向量坐标值，求向量相对于 X 轴正向的旋转角度。
     *
     * 两个点需要处于同一个坐标系中。
     *
     * rotateAngle 的数值范围限定在 [0,360] 度之间，闭区间。
     *
     * @param x
     * @param y
     * @param originX
     * @param originY
     * @returns
     */


    static calcRotateAngle(x, y, originX, originY) {
      let deltaX = x - originX;
      let deltaY = y - originY;
      const temp = Math.hypot(deltaX, deltaY);
      let cos = deltaX / temp;
      let sin = deltaY / temp; //Math.acos 的返回值处于 [0,PI] 之间，根据 sin 的正负号进行判断之后， rotateAngle 处于 [-180,180] 度之间
      //先加 360 度，保证 rotateAngle 为正值，再对 360 取模，最终让 rotateAngle 的返回值始终处于 [0,360] 度之间

      let sign = sin < 0 ? -1 : 1;
      let rotateAngle = sign * Math.acos(cos) * 180 / Math.PI + 360;
      rotateAngle = rotateAngle % 360;
      return rotateAngle;
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICEPath
   *
   * 路径
   *
   * @abstract
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEPath extends ICEComponent {
    /**
     * @cfg
     * {
     *   dots:[]  //可选参数，路径上的点。
     * }
     * @param props
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        closePath: true,
        ...props
      });
      this.path2D = new Path2D();
    }
    /**
     * @method doRender
     * @overwrite
     */


    doRender() {
      if (this.dirty) {
        this.ctx.beginPath();
        this.createPathObject();
      } //FIXME:想办法减少已下3条指令的执行次数


      if (this.state.closePath) {
        this.ctx.closePath();
      }

      if (this.state.fill) {
        this.ctx.fill(this.path2D);
      }

      if (this.state.stroke) {
        this.ctx.stroke(this.path2D);
      }

      super.doRender();
    }
    /**
     * @method createPathObject
     * 创建 Path2D 对象，子类需要提供具体实现，此方法仅创建对象实例，不会立即绘制到画布上，绘制过程由 Renderer 进行调度。
     * @see https://developer.mozilla.org/en-US/docs/Web/API/Path2D/Path2D
     */


  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICEDotPath
   *
   * 基于一系列点进行绘制的路径。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEDotPath extends ICEPath {
    /**
     * FIXME:编写完整的配置项描述
     * @cfg
     * {
     *
     * }
     *
     * @param props
     */
    constructor(props) {
      //dots 是内部计算使用的属性
      super({
        dots: [],
        transformedDots: [],
        closePath: true,
        ...props
      });
    }
    /**
     * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
     * 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
     * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     * @overwrite
     * @returns
     */


    calcComponentParams() {
      if (!this.dirty) {
        return {
          width: this.state.width,
          height: this.state.height
        };
      } //DotPath 需要先计算每个点的坐标，然后才能计算 width/height


      this.calcDots();
      let points = this.calc4VertexPoints();
      let width = Math.abs(points[1][0] - points[0][0]); //maxX-minX

      let height = Math.abs(points[2][1] - points[0][1]); //maxY-minY

      this.state.width = width;
      this.state.height = height;
      return {
        width: this.state.width,
        height: this.state.height
      };
    }
    /**
     * 点状路径在重新计算本地原点坐标之后，需要移动内部所有点的位置。
     * @overwrite
     * @returns
     */


    calcLocalOrigin() {
      let origin = super.calcLocalOrigin();

      for (let i = 0; i < this.state.dots.length; i++) {
        let dot = this.state.dots[i];
        dot = transformMat2d([], dot, [1, 0, 0, 1, -origin[0], -origin[1]]);
        this.state.dots[i] = dot;
      }

      return origin;
    }
    /**
     * @returns
     */


    createPathObject() {
      this.path2D = new Path2D();
      this.path2D.moveTo(this.state.dots[0][0], this.state.dots[0][1]);

      for (let i = 1; i < this.state.dots.length; i++) {
        const dot = this.state.dots[i];
        this.path2D.lineTo(dot[0], dot[1]);
      }

      return this.path2D;
    }
    /**
     * 计算路径上的关键点:
     * - 默认的坐标原点是 (0,0) 位置。
     * - 这些点没有经过 transform 矩阵变换。
     * this.calcComponentParams() 会依赖此方法，在计算尺寸时还没有确定原点坐标，所以 calcDots() 方法内部不能依赖原点坐标，只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     * @returns
     */


    calcDots() {
      this.state.dots = [];
      return this.state.dots;
    }
    /**
     *
     * 计算4个顶点：
     * - 相对于组件本地的坐标系，原点位于左上角，没有经过矩阵变换。
     * - 返回值用于计算组件的原始 width/height 。
     *
     * @returns
     */


    calc4VertexPoints() {
      let minX = this.state.dots[0][0];
      let minY = this.state.dots[0][1];
      let maxX = this.state.dots[0][0];
      let maxY = this.state.dots[0][1];

      for (let i = 1; i < this.state.dots.length; i++) {
        let dot = this.state.dots[i];

        if (dot[0] < minX) {
          minX = dot[0];
        }

        if (dot[0] > maxX) {
          maxX = dot[0];
        }

        if (dot[1] < minY) {
          minY = dot[1];
        }

        if (dot[1] > maxY) {
          maxY = dot[1];
        }
      } //top-left point


      const x1 = minX;
      const y1 = minY; //top-right point

      const x2 = maxX;
      const y2 = minY; //bottom-left point

      const x3 = minX;
      const y3 = maxY; //bottom-right point

      const x4 = maxX;
      const y4 = maxY;
      return [[x1, y1], [x2, y2], [x3, y3], [x4, y4]];
    }

    applyTransformToCtx() {
      super.applyTransformToCtx();

      if (!this.dirty) {
        return;
      }

      const matrix = this.state.composedMatrix;
      const dots = this.state.dots;
      this.state.transformedDots = [];

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const point = transformMat2d([], dot, matrix);
        this.state.transformedDots.push(point);
      }
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   *
   * @class ICEPolyLine
   *
   * 折线
   *
   * 基本特征：
   *
   * - ICEPolyLine 由多个点构成，如果折线上的所有点共线，则折线在外观上退化成直线。
   * - ICEPolyLine 上至少存在 2 个点，否则无法画线。如果点数恰好为 2 ，折线退化成一条直线。
   * - ICEPolyLine 以及所有子类不能进行 transform 操作。
   * - ICEPolyLine 以及所有子类的 left/top 总是被设置为 startPoint 。
   * - ICEPolyLine 以及所有子类的原点都在 startPoint 上，而不在几何中心点。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEPolyLine extends ICEDotPath {
    /**
     * {
     *  start:{componnet:ICEComponent,position:'T'},
     *  end:{component:ICEComponent,position:'B'}
     * }
     */
    //记录连接到了哪个组件上

    /**
     * FIXME:编写完整的配置项描述
     * @cfg
     * {
     *  lineType: 'solid', //solid, dashed
     *  lineWidth:2,
     *  arrow: 'none',     //none, start, end ,both
     *  closePath:false,
     *  points:[],         //点的坐标
     * }
     *
     * @param props
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      let param = ICEPolyLine.arrangeParam(props);
      super(param);
      this.links = {
        start: {},
        end: {}
      };
    }
    /**
     *
     * 整理并校验构造参数。
     *
     * @static
     * @param props
     * @returns
     */


    static arrangeParam(props) {
      //dots 是内部计算使用的属性，外部传参用 points 属性
      //points 是一个数组，用来描述一系列的坐标点，这些点会被按照顺序连接起来，example: [[0,0],[10,10],[20,20],[30,30]]
      let param = { ...{
          lineType: 'solid',
          lineWidth: 2,
          arrow: 'none',
          points: [],
          showMinBoundingBox: false,
          showMaxBoundingBox: false,
          links: {}
        },
        ...props,
        ...{
          linkable: false,
          //所有线条类型的组件 linkable 都为 false ，因为在 ICE 中，用线条连接线条是没有意义的，线条之间不能互相连接。
          closePath: false,
          fill: false
        }
      }; //至少有2个点，如果点数少于2个，自动填充。

      let len = param.points.length;

      if (len < 2) {
        if (len === 0) {
          param.points.push([0, 0]);
          param.points.push([10, 10]);
        } else if (len === 1) {
          param.points.push([10, 10]);
        }
      } //ICEPolyLine 的参数需要特殊处理，总是把 left/top 移动到第 0 个点的位置，外部传递的 left/top ， translate[0]/translate[1] 都无效。


      param = { ...param,
        ...{
          left: props.points[0][0],
          top: props.points[0][1],
          transform: {
            translate: [0, 0],
            scale: [1, 1],
            skew: [0, 0],
            rotate: 0 //degree

          }
        }
      }; //保证 lineWidth 不小于0

      if (param.style.lineWidth <= 0) {
        param.style.lineWidth = 2;
      }

      return param;
    }
    /**
     * @override
     */


    initEvents() {
      super.initEvents(); //如果 props 里面的 links 数据结构不为空，在渲染器完成一轮渲染之后，自动建立连接关系。
      //在反序列化时需要进行此操作。

      this.once(ICE_EVENT_NAME_CONSTS.AFTER_ADD, this.afterAddHandler, this);
    }

    afterAddHandler(evt) {
      //连接线的两端分别与一个组件关联，因此需要等待渲染器完成一轮渲染之后才能建立连接，否则需要连接的对象可能还没有渲染出来。
      this.evtBus.once(ICE_EVENT_NAME_CONSTS.ROUND_FINISH, this.makeConnection, this);
    }

    makeConnection() {
      const links = this.props.links;

      if (links) {
        if (links.start) {
          const id = links.start.id;
          const position = links.start.position;

          if (id && position) {
            const component = this.ice.findComponent(id);
            this.setLink('start', component, position);
          }
        }

        if (links.end) {
          const id = links.end.id;
          const position = links.end.position;

          if (id && position) {
            const component = this.ice.findComponent(id);
            this.setLink('end', component, position);
          }
        }
      }

      this.ice.dirty = true;
    }

    setLink(terminal, component, position) {
      this.removeLink(terminal, component, position);
      this.links[terminal] = {
        component: component,
        position: position
      };
      component.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.followComponent, this);
      component.once(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.followComponent, this);
      this.followComponent(); //重新设置连接信息，连接线连接到组件上之后，自身不再能拖拽

      const _temp = {};

      for (let p in this.links) {
        let obj = this.links[p];

        if (obj.component && obj.position) {
          _temp[p] = {
            id: obj.component.props.id,
            position: obj.position
          };
        }
      }

      this.setState({
        links: { ..._temp
        },
        draggable: false
      });
    }

    removeLink(terminal, component, position) {
      const _component = this.links[terminal].component;
      const _position = this.links[terminal].position;

      if (_component === component && _position === position) {
        _component && _component.off(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.followComponent, this);
        this.links[terminal] = {};
        this.state.links[terminal] = {};
      } //如果两端都没有连接的组件，连接线自身变成可拖动


      if (!this.links.start.component && !this.links.end.component) {
        this.setState({
          draggable: true
        });
      }
    }
    /**
     * @method
     * 连接的组件位置发生移动之后，重新计算连接线的起点和终点。
     */


    followComponent(evt) {
      for (let terminal in this.links) {
        const position = this.links[terminal].position;
        const component = this.links[terminal].component;

        if (!position || !component) {
          continue;
        }

        const box = component.getMaxBoundingBox();
        let temp = [0, 0];

        switch (position) {
          case 'T':
            temp = box.topCenter;
            break;

          case 'R':
            temp = box.rightCenter;
            break;

          case 'B':
            temp = box.bottomCenter;
            break;

          case 'L':
            temp = box.leftCenter;
            break;
        }

        switch (terminal) {
          case 'start':
            this.setState({
              startPoint: [...temp]
            });
            break;

          case 'end':
            this.setState({
              endPoint: [...temp]
            });
            break;
        }
      }
    }
    /**
     * ICEPolyLine 有自己的特殊处理，它的原点永远在 (0,0) 位置，而不在几何中点。
     * @overwrite
     * @returns
     */


    calcLocalOrigin() {
      let point = [0, 0];
      this.state.localOrigin = point;
      return point;
    }
    /**
     * ICEPolyLine 有自己特殊的计算方式：
     * - 原点总是放在 startPoint 的位置。
     * - 数值相对于组件本地坐标系进行计算。
     * @overwrite
     * @returns
     */


    calcDots() {
      let left = this.state.left;
      let top = this.state.top;
      this.state.dots = [];

      for (let i = 0; i < this.state.points.length; i++) {
        const p = this.state.points[i];
        let x = p[0] - left;
        let y = p[1] - top;
        this.state.dots.push([x, y]);
      }

      return this.state.dots;
    }
    /**
     * 动态向线条上增加一个点
     * @param point
     * @param index
     */


    addDot(point, index) {
      this.state.points.splice(index, 0, point);
      this.state.dots.splice(index, 0, [point[0], point[1]]);
    }
    /**
     * 从线条上删掉一个点，如果线条上的点数已经小于等于 2 ，则什么都不做。
     * @param index
     */


    rmDot(index) {
      if (this.state.points.length < 3) {
        return false;
      }

      this.state.points.splice(index, 1);
      this.state.dots.splice(index, 1);
      return true;
    }
    /**
     * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
     * 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
     * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     * @overwrite
     * @returns
     */


    calcComponentParams() {
      if (!this.dirty) {
        return {
          width: this.state.width,
          height: this.state.height
        };
      }

      this.calcDots();
      let points = this.calc4VertexPoints(); //最小包围盒的4个顶点

      let width = Math.abs(points[1][0] - points[0][0]); //maxX-minX

      let height = this.state.style.lineWidth; //先进行共线判断，如果所有点都在同一条直线上，那么边界盒子的整体高度就等于线条的粗细

      if (this.isDotsOnSameLine()) {
        this.state.width = width;
        this.state.height = height;
        return {
          width: this.state.width,
          height: this.state.height
        };
      } else {
        height = Math.abs(points[2][1] - points[0][1]); //maxY-minY

        this.state.width = width;
        this.state.height = height;
        return {
          width: this.state.width,
          height: this.state.height
        };
      }
    }
    /**
     * 进行共线判断，如果所有点都在同一条直线上，那么边界盒子的整体高度就等于线条的粗细
     * @returns
     */


    isDotsOnSameLine() {
      let len = this.state.points.length;
      let startX = round_1(this.state.points[0][0], 2);
      let startY = round_1(this.state.points[0][1], 2);
      let endX = round_1(this.state.points[len - 1][0], 2);
      let endY = round_1(this.state.points[len - 1][1], 2);
      let counter = 0;
      let vector1 = [endX - startX, endY - startY]; //起点和终点构成的向量坐标

      for (let i = 0; i < len; i++) {
        let p = this.state.points[i];
        let vector2 = [p[0] - startX, p[1] - startY];
        let crossProduct = cross([], vector1, vector2)[2];

        if (crossProduct === 0) {
          counter++;
        }
      } //折线上的所有点都共线，外观上已经退化成一条直线


      if (counter === len) {
        return true;
      }

      return false;
    }
    /**
     * 计算4个顶点：
     * - 相对于组件本地的坐标系，原点位于左上角，没有经过矩阵变换。
     * - 返回值用于计算组件的原始 width/height 。
     * @returns
     */


    calc4VertexPoints() {
      if (this.isDotsOnSameLine()) {
        return this.splitEndpointsTo4Points();
      } else {
        return super.calc4VertexPoints();
      }
    }
    /**
     * 把直线的2个端点分裂成4个点，把线条的粗细参数(lineWidth)当成高度看待，方便计算最小包围盒。
     * @returns
     */


    splitEndpointsTo4Points() {
      let len = this.state.points.length;
      let startX = 0; //由于 ICEPolyLine 总是把 left/top 与起点重合，所以这里的 startX 总是为 0

      let startY = 0; //由于 ICEPolyLine 总是把 left/top 与起点重合，所以这里的 startY 总是为 0

      let endX = this.state.points[len - 1][0] - this.state.points[0][0];
      let endY = this.state.points[len - 1][1] - this.state.points[0][1];
      let angle = this.getRotateAngle();
      let height = this.state.height;
      let deltaX = Math.cos(angle * Math.PI / 180) * height / 2;
      let deltaY = Math.sin(angle * Math.PI / 180) * height / 2;
      deltaX = round_1(deltaX, 3);
      deltaY = round_1(deltaY, 3); //计算4个顶点，让边界盒子紧贴直线

      let point1 = [startX + deltaX, startY + deltaY];
      let point2 = [startX - deltaX, startY - deltaY];
      let point3 = [endX + deltaX, endY + deltaY];
      let point4 = [endX - deltaX, endY - deltaY];
      return [point1, point2, point3, point4];
    }
    /**
     * 获取组件的最小包围盒，此盒子的变换矩阵与组件自身完全相同。
     * @returns
     */


    getMinBoundingBox() {
      //先基于组件本地坐标系进行计算
      let originX = this.state.localOrigin[0];
      let originY = this.state.localOrigin[1];
      let points = this.calc4VertexPoints();
      let boundingBox = new ICEBoundingBox([points[0][0] - originX, points[0][1] - originY, points[1][0] - originX, points[1][1] - originY, points[2][0] - originX, points[2][1] - originY, points[3][0] - originX, points[3][1] - originY, 0, 0]); //再用 composedMatrix 进行变换

      boundingBox = boundingBox.transform(this.state.composedMatrix);
      return boundingBox;
    }
    /**
     * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
     *
     * ICEPolyLine 有自己特殊的处理方法：
     *
     * - ICEPolyLine 的 width/height 属性总是计算出来的，不能直接修改，不接受 width/height 配置项。
     * - ICEPolyLine ICEPolyLine 不能进行 transform 操作，不接受 transform 配置项。
     * - ICEPolyLine 可以直接修改 points 。
     * - ICEPolyLine 的 left/top 数值可以直接修改，修改 left/top 时，会重新计算起点和终点坐标，保证 left/top 与 startPoint 始终保持在同一个点上。
     *
     * @overwrite
     * @param newState
     */


    setState(newState) {
      //ICEPolyLine 的 width/height 属性总是计算出来的，不能直接修改，不接受 width/height 配置项。
      if (!isNil_1(newState.width)) {
        delete newState.width;
      }

      if (!isNil_1(newState.height)) {
        delete newState.height;
      } //ICEPolyLine 不能进行 transform 操作，不接受 transform 配置项。


      if (!isNil_1(newState.transform)) {
        delete newState.transform;
      }

      if (!isNil_1(newState.left)) {
        let deltaX = newState.left - this.state.points[0][0];

        for (let i = 0; i < this.state.points.length; i++) {
          this.state.points[i][0] += deltaX;
        }
      }

      if (!isNil_1(newState.top)) {
        let deltaY = newState.top - this.state.points[0][1];

        for (let i = 0; i < this.state.points.length; i++) {
          this.state.points[i][1] += deltaY;
        }
      }

      if (!isNil_1(newState.startPoint)) {
        this.state.points[0] = [...newState.startPoint]; //对 ICEPolyLine 来说，需要保证 left/top 与起点始终重合。

        this.state.left = this.state.points[0][0];
        this.state.top = this.state.points[0][1];
      }

      if (!isNil_1(newState.endPoint)) {
        let len = this.state.points.length;
        this.state.points[len - 1] = [...newState.endPoint];
      }

      super.setState(newState);
    }
    /**
     * 获取旋转角
     * @returns
     */


    getRotateAngle() {
      //先进行共线判断，如果所有点都共线，则旋转角等于直线斜率对应的旋转角。
      if (this.isDotsOnSameLine()) {
        let startX = 0; //由于 ICEPolyLine 总是把 left/top 与 startPoint 重合，所以这里的 startX 总是为 0

        let startY = 0; //由于 ICEPolyLine 总是把 left/top 与 startPoint 重合，所以这里的 startY 总是为 0

        let len = this.state.points.length;
        let endX = this.state.points[len - 1][0] - this.state.points[0][0];
        let endY = this.state.points[len - 1][1] - this.state.points[0][1]; //计算直线的旋转角

        let angle = GeoUtil.calcRotateAngle(endX, endY, startX, startY);
        angle += 90; //加90度，法向

        return angle;
      } else {
        return super.getRotateAngle();
      }
    }
    /**
     * 判断给定的坐标点是否位于线段上。
     * 计算方法：如果给点的坐标点到线段两端的距离之和等于线段长度，则表示点位于线段上，允许一定的误差范围，用 delta 参数进行调节。
     * 算法来源：http://www.jeffreythompson.org/collision-detection/line-point.php
     * @param x
     * @param y
     * @returns
     */


    containsPoint(x, y) {
      const delta = 3; //允许的浮点运算误差，正负区间内，调节此参数可以扩大或者缩小精确度。

      const lines = this.getLines();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const x1 = line.o[0];
        const y1 = line.o[1];
        const x2 = line.d[0];
        const y2 = line.d[1];
        const lineLength = Math.hypot(x2 - x1, y2 - y1);
        const len1 = Math.hypot(x1 - x, y1 - y);
        const len2 = Math.hypot(x2 - x, y2 - y);

        if (len1 + len2 >= lineLength - delta && len1 + len2 <= lineLength + delta) {
          return true;
        }
      }

      return false;
    }

    getLines() {
      const result = [];
      const dots = this.state.transformedDots;

      if (!dots || dots.length < 2) {
        return result;
      }

      for (let i = 0; i < dots.length - 1; i++) {
        const x1 = dots[i][0];
        const y1 = dots[i][1];
        const x2 = dots[i + 1][0];
        const y2 = dots[i + 1][1];
        const line = {
          o: [x1, y1],
          d: [x2, y2]
        }; //o:origin, d:destination

        result.push(line);
      }

      return result;
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * ! FIXME: 删掉对 GeoPoint/GeoLine/GeoUtil 的依赖
   * @class ICEVisioLink
   *
   * Visio 型的连接线
   *
   * 模拟 Microsoft Visio 中的折线算法，此实现从 diagramo 改进而来：http://diagramo.com/ 。
   *
   * 基本特性：
   *
   * - ICEVisioLink 只有 2 个端点，起点和终点。
   * - 除起始点和终点坐标之外，其它点会自动插值计算。
   * - ICEVisioLink 只能连接 2 个非线条类的组件。
   * - 线条互相之间不能连接，在 ICE 引擎中，不能用线条连接线条。
   * - 每一个可以被连接的组件上都有 4 个插槽（Slot），4 个插槽分布在组件最小边界盒子 4 条边的几何中点位置上。
   * - ICEVisioLink 的端点在移动时会判断是否与某个插槽发生碰撞，如果与某个插槽发生碰撞， ICEVisioLink 会连接到插槽所在的组件上。
   * - 同一个插槽（Slot）上可以连 N 根线，Slot 与 ICEVisioLink 之间的关系是 1->N 。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEVisioLink extends ICEPolyLine {
    /**
     * FIXME:补全 props 配置项的描述
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      props = ICEVisioLink.arrangeParam(props);
      super(props);
    }

    static arrangeParam(props) {
      if (isNil_1(props.startPoint)) {
        props.startPoint = [0, 0];
      }

      if (isNil_1(props.endPoint)) {
        props.endPoint = [10, 10];
      }

      props.points = [[...props.startPoint], [...props.endPoint]]; //escapeDistance 疏散距离，是 4 个距离边界盒子边缘的点，线条从组件上出来时会首先经过这些点。

      props = {
        escapeDistance: 30,
        ...props
      };
      return props;
    }
    /**
     * ICEVisioLink 有自己特殊的计算方式。
     *
     * @overwrite
     * @returns
     */


    calcDots() {
      let solutions = this.interpolate();
      let {
        left,
        top
      } = this.state;
      let arr = solutions[0][2];
      this.state.points = [];
      this.state.dots = [];

      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        this.state.points.push([item.x, item.y]);
        this.state.dots.push([item.x - left, item.y - top]);
      }

      return this.state.dots;
    }
    /**
     * 在起点和终点之间插值。
     *
     * @returns
     */


    interpolate() {
      let len = this.state.points.length;
      let startX = this.state.points[0][0];
      let startY = this.state.points[0][1];
      let endX = this.state.points[len - 1][0];
      let endY = this.state.points[len - 1][1];
      let startPoint = new GeoPoint(startX, startY);
      let endPoint = new GeoPoint(endX, endY);
      let potentialExits = [];
      let startExitPoint = null;
      let endExitPoint = null;
      let solutions = [];
      let startBounding = new ICEBoundingBox();
      let endBounding = new ICEBoundingBox(); //find start exit point

      const startComponent = this.links.start.component;

      if (startComponent) {
        startBounding = startComponent.getMinBoundingBox();
        potentialExits[0] = new GeoPoint(startPoint.x, startBounding.tl[1] - this.state.escapeDistance); //north

        potentialExits[1] = new GeoPoint(startBounding.tr[0] + this.state.escapeDistance, startPoint.y); //east

        potentialExits[2] = new GeoPoint(startPoint.x, startBounding.br[1] + this.state.escapeDistance); //south

        potentialExits[3] = new GeoPoint(startBounding.tl[0] - this.state.escapeDistance, startPoint.y); //west
        //pick closest exit point

        startExitPoint = potentialExits[0];

        for (let i = 1; i < potentialExits.length; i++) {
          if (this.distance(startPoint, potentialExits[i]) < this.distance(startPoint, startExitPoint)) {
            startExitPoint = potentialExits[i];
          }
        }
      } //find end exit point


      const endComponent = this.links.end.component;

      if (endComponent) {
        endBounding = endComponent.getMinBoundingBox();
        potentialExits[0] = new GeoPoint(endPoint.x, endBounding.tl[1] - this.state.escapeDistance); //north

        potentialExits[1] = new GeoPoint(endBounding.tr[0] + this.state.escapeDistance, endPoint.y); //east

        potentialExits[2] = new GeoPoint(endPoint.x, endBounding.br[1] + this.state.escapeDistance); //south

        potentialExits[3] = new GeoPoint(endBounding.tl[0] - this.state.escapeDistance, endPoint.y); //west
        //pick closest exit point

        endExitPoint = potentialExits[0];

        for (let i = 1; i < potentialExits.length; i++) {
          if (this.distance(endPoint, potentialExits[i]) < this.distance(endPoint, endExitPoint)) {
            endExitPoint = potentialExits[i];
          }
        }
      } //the index of the gap (where do we need to insert new points) DO NOT CHANGE IT


      let gapIndex = 0; //Basic solution

      let s = [startPoint];

      if (startExitPoint) {
        s.push(startExitPoint);
        gapIndex = 1;
      }

      endExitPoint && s.push(endExitPoint);
      s.push(endPoint); //SO - no additional points

      let s0 = GeoPoint.cloneArray(s);
      solutions.push(['s0', 's0', s0]); //S1

      let s1 = GeoPoint.cloneArray(s); //first variant

      let s1_1 = GeoPoint.cloneArray(s1);
      s1_1.splice(gapIndex + 1, 0, new GeoPoint(s1_1[gapIndex].x, s1_1[gapIndex + 1].y));
      solutions.push(['s1', 's1_1', s1_1]); //second variant

      let s1_2 = GeoPoint.cloneArray(s1);
      s1_2.splice(gapIndex + 1, 0, new GeoPoint(s1_2[gapIndex + 1].x, s1_2[gapIndex].y));
      solutions.push(['s1', 's1_2', s1_2]); //S2
      //Variant I

      let s2_1 = GeoPoint.cloneArray(s1);
      let s2_1_1 = new GeoPoint((s2_1[gapIndex].x + s2_1[gapIndex + 1].x) / 2, s2_1[gapIndex].y);
      let s2_1_2 = new GeoPoint((s2_1[gapIndex].x + s2_1[gapIndex + 1].x) / 2, s2_1[gapIndex + 1].y);
      s2_1.splice(gapIndex + 1, 0, s2_1_1, s2_1_2);
      solutions.push(['s2', 's2_1', s2_1]); //Variant II

      let s2_2 = GeoPoint.cloneArray(s1);
      let s2_2_1 = new GeoPoint(s2_2[gapIndex].x, (s2_2[gapIndex].y + s2_2[gapIndex + 1].y) / 2);
      let s2_2_2 = new GeoPoint(s2_2[gapIndex + 1].x, (s2_2[gapIndex].y + s2_2[gapIndex + 1].y) / 2);
      s2_2.splice(gapIndex + 1, 0, s2_2_1, s2_2_2);
      solutions.push(['s2', 's2_2', s2_2]); //Variant III

      let s2_3 = GeoPoint.cloneArray(s1); //find the amount (stored in delta) of pixels we need to move right so no intersection with a figure will be present
      //add points X coordinates to be able to generate Variant III even in the absence of figures :p

      let eastExits = [s2_3[gapIndex].x + 20, s2_3[gapIndex + 1].x + 20];

      if (startBounding) {
        eastExits.push(startBounding.br[0] + 20);
      }

      if (endBounding) {
        eastExits.push(endBounding.br[0] + 20);
      }

      let eastExit = this.max(eastExits);
      let s2_3_1 = new GeoPoint(eastExit, s2_3[gapIndex].y);
      let s2_3_2 = new GeoPoint(eastExit, s2_3[gapIndex + 1].y);
      s2_3.splice(gapIndex + 1, 0, s2_3_1, s2_3_2);
      solutions.push(['s2', 's2_3', s2_3]); //Variant IV

      let s2_4 = GeoPoint.cloneArray(s1); //find the amount (stored in delta) of pixels we need to move up so no intersection with a figure will be present
      //add points y coordinates to be able to generate Variant III even in the absence of figures :p

      let northExits = [s2_4[gapIndex].y - 20, s2_4[gapIndex + 1].y - 20];

      if (startBounding) {
        northExits.push(startBounding.tl[1] - 20);
      }

      if (endBounding) {
        northExits.push(endBounding.tl[1] - 20);
      }

      let northExit = this.min(northExits);
      let s2_4_1 = new GeoPoint(s2_4[gapIndex].x, northExit);
      let s2_4_2 = new GeoPoint(s2_4[gapIndex + 1].x, northExit);
      s2_4.splice(gapIndex + 1, 0, s2_4_1, s2_4_2);
      solutions.push(['s2', 's2_4', s2_4]); //Variant V

      let s2_5 = GeoPoint.cloneArray(s1); //find the amount (stored in delta) of pixels we need to move left so no intersection with a figure will be present
      //add points x coordinates to be able to generate Variant III even in the absence of figures :p

      let westExits = [s2_5[gapIndex].x - 20, s2_5[gapIndex + 1].x - 20];

      if (startBounding) {
        westExits.push(startBounding.tl[0] - 20);
      }

      if (endBounding) {
        westExits.push(endBounding.tl[0] - 20);
      }

      let westExit = this.min(westExits);
      let s2_5_1 = new GeoPoint(westExit, s2_5[gapIndex].y);
      let s2_5_2 = new GeoPoint(westExit, s2_5[gapIndex + 1].y);
      s2_5.splice(gapIndex + 1, 0, s2_5_1, s2_5_2);
      solutions.push(['s2', 's2_5', s2_5]); //Variant VI

      let s2_6 = GeoPoint.cloneArray(s1); //find the amount (stored in delta) of pixels we need to move down so no intersection with a figure will be present
      //add points y coordinates to be able to generate Variant III even in the absence of figures :p

      let southExits = [s2_6[gapIndex].y + 20, s2_6[gapIndex + 1].y + 20];

      if (startBounding) {
        southExits.push(startBounding.tl[1] + startBounding.height + 20);
      }

      if (endBounding) {
        southExits.push(endBounding.tl[1] + endBounding.height + 20);
      }

      let southExit = this.max(southExits);
      let s2_6_1 = new GeoPoint(s2_6[gapIndex].x, southExit);
      let s2_6_2 = new GeoPoint(s2_6[gapIndex + 1].x, southExit);
      s2_6.splice(gapIndex + 1, 0, s2_6_1, s2_6_2);
      solutions.push(['s2', 's2_6', s2_6]); //FILTER solutions

      /*
       * Algorithm
       * 0. solutions are ordered from minimmun nr of points to maximum >:)
       * 1. remove all solutions that are not orthogonal (mainly s0 solution)
       * 2. remove all solutions that go backward (we will not need them ever)
       * 3. remove all solutions with intersections
       * 4. pick first class of solutions with same nr of points (ex: 2)
       * 5. pick the first solution with 90 degree angles (less turnarounds)
       * (not interesteted) sort by length :p
       */
      //1. filter non ortogonal solutions

      let orthogonalSolution = [];

      for (let i = 0; i < solutions.length; i++) {
        let solution = solutions[i][2];

        if (this.orthogonalPath(solution)) {
          orthogonalSolution.push(solutions[i]);
        }
      }

      solutions = orthogonalSolution; //2. filter backward solutions, do not allow start and end points to coincide - ignore them

      if (!startPoint.equals(endPoint)) {
        let forwardSolutions = [];

        for (let i = 0; i < solutions.length; i++) {
          let solution = solutions[i][2];

          if (this.forwardPath(solution)) {
            forwardSolutions.push(solutions[i]);
          }
        }

        solutions = forwardSolutions;

        if (solutions.length == 0) ;
      } //3. Filter non intersecting solutions


      let nonIntersectionSolutions = [];

      for (let i = 0; i < solutions.length; i++) {
        let solution = solutions[i][2];
        let intersect = false;
        let innerLines = solution.slice(); //just a shallow copy

        /*
         * If any bounds just trim the solution. So we avoid the strange case when a connection
         * startes from a point on a figure and ends inside of the same figure, but not on a connection point.
         */

        if (endBounding || startBounding) {
          //i0nnerLines = innerLines.slice(0, innerLines.length - 1);
          innerLines = innerLines.slice(1, innerLines.length - 1);
        } //now test for intersection


        if (startBounding) {
          intersect = intersect || this.polylineIntersectsRectangle(innerLines, startBounding);
        }

        if (endBounding) {
          intersect = intersect || this.polylineIntersectsRectangle(innerLines, endBounding);
        }

        if (!intersect) {
          nonIntersectionSolutions.push(solutions[i]);
        }
      } //If all solutions intersect than this is destiny  :) and just ignore the intersection filter


      if (nonIntersectionSolutions.length != 0) {
        //reasign to solutions
        solutions = nonIntersectionSolutions;
      } //4. get first class of solutions with same nr of points


      if (solutions.length == 0) ;

      let firstSolution = solutions[0][2]; //pick first solution

      let nrOfPoints = firstSolution.length;
      let sameNrPointsSolution = [];

      for (let i = 0; i < solutions.length; i++) {
        let solution = solutions[i][2];

        if (solution.length == nrOfPoints) {
          sameNrPointsSolution.push(solutions[i]);
        }
      }

      solutions = sameNrPointsSolution;
      /*
       * 5.Pick the first solution with 90 degree angles (less turnarounds)
       * in case we have more than one solution in our class.
       */

      let solIndex = 0;

      for (let i = 0; i < solutions.length; i++) {
        if (this.scorePath(solutions[solIndex][2]) < this.scorePath(solutions[i][2])) {
          solIndex = i;
        }
      }

      solutions = [solutions[solIndex]];
      return solutions;
    }
    /**
     * Tests if a vector of points is an orthogonal path (moving in multiples of 90 degrees).
     *
     *
     * 正交判定。Visio 连接线上的每一段要么平行于 X 轴，要么平行于 Y 轴。
     * @param {Array} v - an {Array} of {Point}s
     * @return {Boolean} - true if path is valid, false otherwise
     */


    orthogonalPath(v) {
      if (v.length <= 1) {
        return true;
      }

      for (let i = 0; i < v.length - 1; i++) {
        if (v[i].x != v[i + 1].x && v[i].y != v[i + 1].y) {
          return false;
        }
      }

      return true;
    }
    /**
     * FIXME: 用更好的数学方法进行计算。
     * Test to see if 2 {Line}s intersects. They are considered finite segments
     * and not the infinite lines from geometry
     * @param {Line} l1 - fist line/segment
     * @param {Line} l2 - last line/segment
     * @return {Boolean} true - if the lines intersect or false if not
     */


    lineIntersectsLine(l1, l2) {
      // check for two vertical lines
      if (l1.startPoint.x == l1.endPoint.x && l2.startPoint.x == l2.endPoint.x) {
        return l1.startPoint.x == l2.startPoint.x // if 'infinite 'lines do coincide,
        ? // then check segment bounds for overlapping
        l1.contains(l2.startPoint.x, l2.startPoint.y) || l1.contains(l2.endPoint.x, l2.endPoint.y) : // lines are paralel
        false;
      } // if one line is vertical, and another line is not vertical
      else if (l1.startPoint.x == l1.endPoint.x || l2.startPoint.x == l2.endPoint.x) {
        // let assume l2 is vertical, otherwise exchange them
        if (l1.startPoint.x == l1.endPoint.x) {
          let l = l1;
          l1 = l2;
          l2 = l;
        } // finding intersection of 'infinite' lines
        // equation of the first line is y = ax + b, second: x = c


        let a = (l1.endPoint.y - l1.startPoint.y) / (l1.endPoint.x - l1.startPoint.x);
        let b = l1.startPoint.y - a * l1.startPoint.x;
        let x0 = l2.startPoint.x;
        let y0 = a * x0 + b;
        return l1.contains(x0, y0) && l2.contains(x0, y0);
      } // check normal case - both lines are not vertical
      else {
        //line equation is : y = a*x + b, b = y - a * x
        let a1 = (l1.endPoint.y - l1.startPoint.y) / (l1.endPoint.x - l1.startPoint.x);
        let b1 = l1.startPoint.y - a1 * l1.startPoint.x;
        let a2 = (l2.endPoint.y - l2.startPoint.y) / (l2.endPoint.x - l2.startPoint.x);
        let b2 = l2.startPoint.y - a2 * l2.startPoint.x;

        if (a1 == a2) {
          //paralel lines
          return b1 == b2 ? // for coincide lines, check for segment bounds overlapping
          l1.contains(l2.startPoint.x, l2.startPoint.y) || l1.contains(l2.endPoint.x, l2.endPoint.y) : // not coincide paralel lines have no chance to intersect
          false;
        } else {
          //usual case - non paralel, the 'infinite' lines intersects...we only need to know if inside the segment

          /*
           * if one of the lines are vertical, then x0 is equal to their x,
           * otherwise:
           * y1 = a1 * x + b1
           * y2 = a2 * x + b2
           * => x0 = (b2 - b1) / (a1 - a2)
           * => y0 = a1 * x0 + b1
           */
          let x0 = (b2 - b1) / (a1 - a2);
          let y0 = a1 * x0 + b1;
          return l1.contains(x0, y0) && l2.contains(x0, y0);
        }
      }
    }
    /**
     * Tests if a a polyline defined by a set of points intersects a rectangle
     * @param {Array} points - and {Array} of {Point}s
     * @param {Array} boundingRect - the boundingRect
     * @param {Boolean} closedPolyline - incase polyline is closed figure then true, else false
     * @return true - if line intersects the rectangle, false - if not
     */


    polylineIntersectsRectangle(points, boundingRect) {
      let closedPolyline = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
      //get the 4 lines/segments represented by the boundingRect
      let lines = [];
      lines.push(new GeoLine(new GeoPoint(boundingRect.x1, boundingRect.y1), new GeoPoint(boundingRect.x2, boundingRect.y1)));
      lines.push(new GeoLine(new GeoPoint(boundingRect.x2, boundingRect.y1), new GeoPoint(boundingRect.x2, boundingRect.y2)));
      lines.push(new GeoLine(new GeoPoint(boundingRect.x2, boundingRect.y2), new GeoPoint(boundingRect.x1, boundingRect.y2)));
      lines.push(new GeoLine(new GeoPoint(boundingRect.x1, boundingRect.y2), new GeoPoint(boundingRect.x1, boundingRect.y1)));

      for (let k = 0; k < points.length - 1; k++) {
        //create a line out of each 2 consecutive points
        let tempLine = new GeoLine(points[k], points[k + 1]); //see if that line intersect any of the line on boundingRect border

        for (let i = 0; i < lines.length; i++) {
          if (this.lineIntersectsLine(tempLine, lines[i])) {
            return true;
          }
        }
      } //check the closed figure - that is last point connected to the first


      if (closedPolyline) {
        //create a line out of each 2 consecutive points
        let tempLine1 = new GeoLine(points[points.length - 1], points[0]); //see if that line intersect any of the line on boundingRect border

        for (let j = 0; j < lines.length; j++) {
          if (this.lineIntersectsLine(tempLine1, lines[j])) {
            return true;
          }
        }
      }

      return false;
    }
    /**
     * Score a ortogonal path made out of Points
     * Iterates over a set of points (minimum 3)
     * For each 3 points (i, i+1, i+2) :
     *  - if the 3rd one is after the 2nd on the same line we add +1
     *  - if the 3rd is up or down related to the 2nd we do not do anything +0
     *  - if the 3rd goes back we imediatelly return -1
     * @param {Array} v - an array of {Point}s
     * @return {Number} - -1 if the path is wrong (goes back) or something >= 0 if is fine.The bigger the number the smooth the path is.
     */


    scorePath(v) {
      if (v.length <= 2) {
        return -1;
      }

      let score = 0;

      for (let i = 1; i < v.length - 1; i++) {
        if (v[i - 1].x == v[i].x && v[i].x == v[i + 1].x) {
          //on the same vertical
          if (this.signum(v[i + 1].y - v[i].y) == this.signum(v[i].y - v[i - 1].y)) {
            //same direction
            score++;
          } else {
            //going back - no good
            return -1;
          }
        } else if (v[i - 1].y == v[i].y && v[i].y == v[i + 1].y) {
          //on the same horizontal
          if (this.signum(v[i + 1].x - v[i].x) == this.signum(v[i].x - v[i - 1].x)) {
            //same direction
            score++;
          } else {
            //going back - no good
            return -1;
          }
        } else {
          //not on same vertical nor horizontal
          score--;
        }
      }

      return score;
    }
    /**
     * Returns the sign of a number
     * @param {Number} x - the number
     * @returns {Number}
     * @see <a href="http://en.wikipedia.org/wiki/Sign_function">http://en.wikipedia.org/wiki/Sign_function</a>
     */


    signum(x) {
      if (x > 0) return 1;else if (x < 0) return -1;else return 0;
    }
    /**
     * Tests if a vector of points is a valid path (not going back)
     * There are a few problems here. If you have p1, p2, p3 and p4 and p2 = p3 you need to ignore that
     * @param {Array} v - an {Array} of {Point}s
     * @return {Boolean} - true if path is valid, false otherwise
     */


    forwardPath(v) {
      if (v.length <= 2) {
        return true;
      }

      for (let i = 0; i < v.length - 2; i++) {
        if (v[i].x == v[i + 1].x && v[i + 1].x == v[i + 2].x) {
          //on the same vertical
          if (this.signum(v[i + 1].y - v[i].y) != 0) {
            //test only we have a progressing path
            if (this.signum(v[i + 1].y - v[i].y) == -1 * this.signum(v[i + 2].y - v[i + 1].y)) {
              //going back (ignore zero)
              return false;
            }
          }
        } else if (v[i].y == v[i + 1].y && v[i + 1].y == v[i + 2].y) {
          //on the same horizontal
          if (this.signum(v[i + 1].x - v[i].x) != 0) {
            //test only we have a progressing path
            if (this.signum(v[i + 1].x - v[i].x) == -1 * this.signum(v[i + 2].x - v[i + 1].x)) {
              //going back (ignore zero)
              return false;
            }
          }
        }
      }

      return true;
    }
    /**
     * @method distance
     * Calculate the distance between two points.
     *
     *
     * 计算两点之间的距离。
     * @param {Point} p1 - first {Point}
     * @param {Point} p2 - second {Point}
     * @return {Number} - the distance between those 2 points. It is always positive.
     */


    distance(p1, p2) {
      return Math.hypot(p2.x - p1.x, p2.y - p1.y);
    }
    /**
     * Returns the max of a vector
     * @param {Array} v - vector of {Number}s
     * @return {Number} - the maximum number from the vector or NaN if vector is empty
     */


    max(v) {
      if (v.lenght == 0) {
        return NaN;
      } else {
        var m = v[0];

        for (var i = 0; i < v.length; i++) {
          if (m < v[i]) {
            m = v[i];
          }
        }

        return m;
      }
    }
    /**
     * Returns the min of a vector
     * @param {Array} v - vector of {Number}s
     * @return {Number} - the minimum number from the vector or NaN if vector is empty
     * @author alex@scriptoid.com
     */


    min(v) {
      if (v.lenght == 0) {
        return NaN;
      } else {
        var m = v[0];

        for (var i = 0; i < v.length; i++) {
          if (m > v[i]) {
            m = v[i];
          }
        }

        return m;
      }
    }
    /**
     * ICEVisioLink 中的点都是自动计算出来的，手动添加点没有意义。
     * @overwrite
     * @param point
     * @param index
     */


    addDot(point, index) {
      throw new Error('Can NOT add dot to ICEVisioLink mannually.');
    }
    /**
     * ICEVisioLink 中的点都是自动计算出来的，手动删除点没有意义。
     * @overwrite
     * @param index
     */


    rmDot(index) {
      throw new Error('Can NOT remove dot from ICEVisioLink mannually.');
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICERect 矩形
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICERect extends ICEPath {
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        width: 10,
        height: 10,
        ...props
      });
    }

    createPathObject() {
      this.path2D = new Path2D();
      this.path2D.rect(0 - this.state.localOrigin[0], 0 - this.state.localOrigin[1], this.state.width, this.state.height);
      return this.path2D;
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * TODO:draw text along Path2D
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEText extends ICEComponent {
    /**
     * @cfg
     * {
     *   text:'文本内容',
     *   left:0,
     *   top:0,
     *   style:{
     *       fontSize:48,
     *       fontFamily:'Arial',
     *       fontWeight:24,
     *   }
     * }
     * @param props
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      const param = merge_1({
        text: '',
        left: 0,
        top: 0,
        width: 10,
        height: 10,
        style: {
          fontWeight: 'bold',
          fontSize: 32,
          fontFamily: 'Arial',
          lineWidth: 1
        }
      }, props);
      param.style = { ...param.style,
        font: `${param.style.fontWeight} ${param.style.fontSize}px ${param.style.fontFamily}`,
        //CanvasRenderingContext2D 只支持 font 属性，这里手动拼接
        textBaseline: 'bottom' //@see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/textBaseline

      };
      super(param);
    }

    initEvents() {
      this.on(ICE_EVENT_NAME_CONSTS.AFTER_ADD, this.measureText, this);
    }
    /**
     * @method measureText
     *
     * - Canvas 中没有提供原生的计算文本高度的有效方法，文本宽高的计算需要使用特殊的方法，这里使用的方法来自 https://longviewcoder.com/2021/02/11/html5-canvas-text-line-height-measurement/
     * - 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
     * - 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     *
     * FIXME:某些运行时环境可能不支持动态插入 HTML 标签，以上测量文本宽高的方法可能存在兼容性问题。
     * FIXME:对文本位置的控制需要更精细的计算方法。
     */


    measureText(evt) {
      let div;

      try {
        div = this.root.document.createElement('div');
        const styleObj = {
          padding: '0',
          margin: '0',
          border: 'none',
          position: 'absolute',
          top: '0',
          left: '0',
          fontFamily: this.state.style.fontFamily,
          fontWeight: this.state.style.fontWeight,
          fontSize: this.state.style.fontSize + 'px'
        };

        for (const key in styleObj) {
          div.style[key] = styleObj[key];
        }

        div.contenteditable = false;
        div.innerHTML = this.state.text;
        this.root.document.body.appendChild(div);
        let cssSize = {
          width: div.offsetWidth,
          height: div.offsetHeight
        }; //这里需要同时修改一下 props 中的 width/height ，因为构造时无法计算文本的宽高

        this.props.width = cssSize.width;
        this.props.height = cssSize.height;
        this.state.width = cssSize.width;
        this.state.height = cssSize.height;
      } finally {
        this.root.document.body.removeChild(div);
      }
    }
    /**
     * @method doRender
     * @override
     * 文本是基于 baseline 绘制的，文本是从 y 坐标向屏幕上方绘制的，48 是文本高度，这里需要补偿文本高度。
     * 同时把移动坐标轴原点的偏移量计算进去。
     */


    doRender() {
      if (this.state.stroke) {
        this.ctx.strokeText(this.state.text, 0 - this.state.localOrigin[0], 0 - this.state.localOrigin[1] + this.state.height, this.state.width);
      }

      if (this.state.fill) {
        this.ctx.fillText(this.state.text, 0 - this.state.localOrigin[0], 0 - this.state.localOrigin[1] + this.state.height, this.state.width);
      }

      super.doRender();
    }

  }

  var baseGetTag = _baseGetTag,
      isArray = isArray_1,
      isObjectLike = isObjectLike_1;

  /** `Object#toString` result references. */
  var stringTag = '[object String]';

  /**
   * Checks if `value` is classified as a `String` primitive or object.
   *
   * @static
   * @since 0.1.0
   * @memberOf _
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a string, else `false`.
   * @example
   *
   * _.isString('abc');
   * // => true
   *
   * _.isString(1);
   * // => false
   */
  function isString(value) {
    return typeof value == 'string' ||
      (!isArray(value) && isObjectLike(value) && baseGetTag(value) == stringTag);
  }

  var isString_1 = isString;

  /**
   * Checks if `value` is `undefined`.
   *
   * @static
   * @since 0.1.0
   * @memberOf _
   * @category Lang
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is `undefined`, else `false`.
   * @example
   *
   * _.isUndefined(void 0);
   * // => true
   *
   * _.isUndefined(null);
   * // => false
   */

  function isUndefined(value) {
    return value === undefined;
  }

  var isUndefined_1 = isUndefined;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * 来源：https://github.com/AndrewRayCode/easing-utils/blob/master/src/easing.js
   * 一组缓动工具函数
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  const Easing = {
    /**
     * 线性变化
     * @param from 起始值
     * @param to  终止值
     * @param duration 持续时间，ms
     * @param startTime 动画开始时间
     */
    linear: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      return from + deltaValue / duration * deltaT;
    },
    easeInQuad: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      return from + deltaValue / duration * (deltaT / duration) * deltaT;
    },
    easeOutQuad: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      return -deltaValue * (deltaT /= duration) * (deltaT - 2) + from;
    },
    easeInOutQuad: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      if ((deltaT /= duration / 2) < 1) return deltaValue / 2 * deltaT * deltaT + from;
      return -deltaValue / 2 * (--deltaT * (deltaT - 2) - 1) + from;
    },
    easeInQuart: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      return deltaValue * (deltaT /= duration) * deltaT * deltaT * deltaT + from;
    },
    easeOutQuart: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      return -deltaValue * ((deltaT = deltaT / duration - 1) * deltaT * deltaT * deltaT - 1) + from;
    },
    easeInOutQuart: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      if ((deltaT /= duration / 2) < 1) return deltaValue / 2 * deltaT * deltaT * deltaT * deltaT + from;
      return -deltaValue / 2 * ((deltaT -= 2) * deltaT * deltaT * deltaT - 2) + from;
    },
    easeInCubic: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      return deltaValue * (deltaT /= duration) * deltaT * deltaT + from;
    },
    easeOutCubic: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      return deltaValue * ((deltaT = deltaT / duration - 1) * deltaT * deltaT + 1) + from;
    },
    easeInOutCubic: function (from, to, duration, startTime) {
      let deltaT = Date.now() - startTime;
      let deltaValue = to - from;
      if ((deltaT /= duration / 2) < 1) return deltaValue / 2 * deltaT * deltaT * deltaT + from;
      return deltaValue / 2 * ((deltaT -= 2) * deltaT * deltaT + 2) + from;
    } //TODO:增加更多缓动算法

  };

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class AnimationManager
   *
   * 动画管理器
   *
   * - 全局单例，一个 ICE 实例上只能有一个 AnimationManager 的实例。
   *
   * @singleton
   * @see ICE
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class AnimationManager {
    //所有需要执行动画的元素都会被自动存入此列表中
    constructor(ice) {
      this.animationMap = new Map();
      this.ice = void 0;
      this.ice = ice;
    }

    start() {
      this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEventHandler, this);
      return this;
    }

    stop() {
      this.ice.evtBus.off(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEventHandler, this);
      return this;
    }

    frameEventHandler(evt) {
      let arr = [...this.animationMap.values()];

      for (let i = 0; i < arr.length; i++) {
        let el = arr[i]; //在动画过程中，对象不响应所有交互事件，防止影响属性值的计算。

        el.state.interactive = false;
        this.tween(el);
        el.state.interactive = true;
      }
    } //TODO:处理无限循环播放的情况，处理播放次数的情况
    //TODO:每一个属性变化的持续时间不同，需要做同步处理，所有动画都执行完毕之后，需要把对象从动画列表中删除


    tween(el) {
      let newState = {};
      let animations = el.props.animations;
      let finishCounter = 1;

      for (let key in animations) {
        let animation = animations[key];

        if (animation.finished) {
          finishCounter++; //元素上的所有动画效果都已经执行完毕，从动画列表中删除， FIXME: 处理无限循环动画的问题

          if (finishCounter === Object.keys(animations).length) {
            this.remove(el);
            break;
          }

          continue;
        }

        let from = animation.from;
        let to = animation.to;
        let duration = animation.duration;

        if (isUndefined_1(animation.startTime)) {
          animation.startTime = Date.now();
        }

        if (isUndefined_1(animation.easing)) {
          animation.easing = 'linear';
        }

        let newValue = Easing[animation.easing](from, to, duration, animation.startTime);

        if (newValue > to) {
          newValue = to;
          animation.finished = true;
        }

        newState[key] = Math.floor(newValue); //使用整数个像素点
      }

      el.setState({ ...newState
      });
      return el;
    }

    add(component) {
      this.animationMap.set(component.props.id, component);
    }

    remove(el) {
      if (isString_1(el)) {
        this.animationMap.delete(el);
      } else {
        this.animationMap.delete(el.props.id);
      }
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * @class DDManager
   *
   *  拖拽管理器
   *
   * - ICE Render 中所有组件的拖动都由 DDManager 管理。
   * - 拖拽管理器是纯逻辑组件，没有外观。
   * - DDManager 只负责拖拽和移动位置，不进行其它操作。
   * - 全局单例，一个 ICE 实例上只能有一个 DDManager 实例。
   *
   * @see ICE
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class DDManager {
    //当前正在拖动的组件，FIXME:同时拖动多个组件？
    constructor(ice) {
      this.ice = void 0;
      this.currentObj = void 0;
      this.ice = ice;
    }

    start() {
      this.ice.evtBus.on('mousedown', this.mouseDownHandler, this);
      return this;
    }

    stop() {
      this.ice.evtBus.off('mousedown', this.mouseDownHandler, this);
      this.ice.evtBus.off('mousemove', this.mouseMoveHandler, this);
      this.ice.evtBus.off('mouseup', this.mouseUpHandler, this);
      return this;
    }

    mouseDownHandler(evt) {
      let component = evt.target;

      if (!(component instanceof ICEComponent)) {
        console.warn('DDManager: 点击在 canvas 画布上，没有点击任何图形。');
        return;
      }

      if (!component.state.interactive || !component.state.draggable) {
        return;
      }

      this.currentObj = component;
      this.ice.evtBus.on('mousemove', this.mouseMoveHandler, this);
      this.ice.evtBus.on('mouseup', this.mouseUpHandler, this);
    }

    mouseMoveHandler(evt) {
      // console.log('window.devicePixelRatio>', window.devicePixelRatio);
      // let tx = evt.movementX / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
      // let ty = evt.movementY / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去
      let tx = evt.movementX;
      let ty = evt.movementY;
      this.currentObj.moveGlobalPosition(tx, ty, evt);
      return true;
    }

    mouseUpHandler(evt) {
      this.ice.evtBus.off('mousemove', this.mouseMoveHandler, this);
      this.ice.evtBus.off('mouseup', this.mouseUpHandler, this);
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICEGroup
   *
   * 容器型组件
   *
   * ICEGroup 可以包含自身，利用此组件可以构造出树形的对象结构。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEGroup extends ICERect {
    constructor(props) {
      super(props);
      this.parentNode = null;
      this.childNodes = [];
    }
    /**
     * !注意：在调用 ICEGroup.addChild() 方法时， ICEGroup 自身可能还没有被添加到 ICE 实例中去。所以此时 child.root, child.ctx, child.evtBus 都可能为空。
     * @param child
     */


    addChild(child) {
      child.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD);
      child.parentNode = this;
      this.childNodes.push(child);
      child.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD);
    }

    addChildren(arr) {
      for (let i = 0; i < arr.length; i++) {
        const child = arr[i];
        this.addChild(child);
      }
    }

    removeChild(child) {
      child.destory();
      this.childNodes.splice(this.childNodes.indexOf(child), 1);
    }

    removeChildren(arr) {
      for (let i = 0; i < arr.length; i++) {
        const child = arr[i];
        this.removeChild(child);
      }
    }
    /**
     * @override
     * @method destory
     * 销毁组件
     * - FIXME:立即停止组件上的所有动画效果
     * - 需要清理绑定的事件
     * - 带有子节点的组件需要先销毁子节点，然后再销毁自身。
     */


    destory() {
      this.removeChildren(this.childNodes);
      super.destory();
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * @class ICEControlPanel
   *
   * 控制面板
   *
   * FIXME:所有 ControlPanel 类型的组件都需要处理组件的 REMOVE 事件，当组件被删除时，清理关联关系。
   *
   * - ICEControlPanel 本身总是直接画在 canvas 上，不是任何组件的孩子。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class ICEControlPanel extends ICEGroup {
    constructor(props) {
      super({ ...props,
        linkable: false
      });
      this._targetComponent = void 0;
    }

    doRender() {
      super.doRender();
      this.setControlPositions();
    }

    moveGlobalPosition(tx, ty, evt) {
      super.moveGlobalPosition(tx, ty, evt);

      if (this._targetComponent) {
        this._targetComponent.moveGlobalPosition(tx, ty, evt);
      }
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * zIndex 最大值，这里使用一千万是安全的，在一张画布上渲染一千万个图形的可能性很小
   * zIndex 用来控制组件在画布中的堆叠次序
   * @see ICEComponent.state.zIndex
   */
  const bigZIndexNum = 10000000;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICEEllipse
   *
   * 椭圆形。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEEllipse extends ICEPath {
    //@see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/ellipse
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      let param = {
        radiusX: 20,
        radiusY: 10,
        rotation: 0,
        startAngle: 0,
        endAngle: 2 * Math.PI,
        counterclockwise: true,
        ...props
      };
      param.width = param.radiusX * 2;
      param.height = param.radiusY * 2;
      super(param);
    }
    /**
     * 所有坐标点的坐标都是相对于父层组件，而不是全局坐标。
     * @returns
     */


    createPathObject() {
      this.path2D = new Path2D();
      this.path2D.ellipse(this.state.radiusX - this.state.localOrigin[0], this.state.radiusY - this.state.localOrigin[1], this.state.radiusX, this.state.radiusY, this.state.rotation, this.state.startAngle, this.state.endAngle, this.state.counterclockwise);
      this.path2D.closePath();
      return this.path2D;
    }
    /**
     * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
     *
     * Ellipse 有自己特殊的处理方法：
     *
     * - 如果 setState 时指定了 radiusX 参数，则 width 会被重新计算，如果指定了 radiusY 参数则 height 会被重新计算。
     * - 如果 setState 时仅仅指定 width 参数，则 radiusX 会被重新计算，如果仅仅指定了 height 参数，则 radiusY 会被重新计算。
     * @overwrite
     * @param newState
     */


    setState(newState) {
      if (!isNil_1(newState.radiusX)) {
        newState.width = 2 * newState.radiusX;
      } else if (!isNil_1(newState.width)) {
        newState.radiusX = newState.width / 2;
      }

      if (!isNil_1(newState.radiusY)) {
        newState.height = 2 * newState.radiusY;
      } else if (!isNil_1(newState.height)) {
        newState.radiusY = newState.height / 2;
      }

      super.setState(newState);
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICECircle
   *
   * 正圆形，采用椭圆绘制方法，正圆形作为椭圆的特殊情况。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICECircle extends ICEEllipse {
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      let param = {
        radius: 10,
        ...props
      };
      param.radiusX = param.radius;
      param.radiusY = param.radius;
      super(param);
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICELinkHook
   *
   * 连接钩子
   *
   * - ICELinkHook 与 ICELinkSlot 是一对组件，用来把两个组件连接起来
   * - ICELinkHook 不能独立存在，它的实例放在 @see LineControlPanel 上
   * - ICELinkHook 自身不进行任何 transform 。
   *
   * @see ICELinkSlot
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICELinkHook extends ICECircle {
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        linkable: false,
        ...props
      });
    }

    initEvents() {
      super.initEvents();
      this.on('mousedown', this.mosueDownHandler, this);
      this.on('mousemove', this.mosueMoveHandler, this);
      this.on('mouseup', this.mosueUpHandler, this);
      this.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.resizeEvtHandler, this);
    }
    /**
     *
     * 在 mousedown 事件处理器里面可以直接访问 this.evtBus ，因为能接收到 mousedown 事件说明组件已经渲染出来了。
     * 在 this.evtBus 上触发事件，相当于全局广播，所有监听了 ICE_EVENT_NAME_CONSTS.HOOK_MOUSEDOWN 事件的组件都会收到消息。
     *
     * @param evt
     */


    mosueDownHandler(evt) {
      this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEDOWN, new ICEEvent({
        target: this
      }));
    }
    /**
     *
     * 在 mousemove 事件处理器里面可以直接访问 this.evtBus ，因为能接收到 mousemove 事件说明组件已经渲染出来了。
     * 在 this.evtBus 上触发事件，相当于全局广播，所有监听了 ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE 事件的组件都会收到消息。
     *
     * @param evt
     */


    mosueMoveHandler(evt) {
      this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, new ICEEvent({
        target: this
      }));
    }
    /**
     *
     * 在 mouseup 事件处理器里面可以直接访问 this.evtBus ，因为能接收到 mouseup 事件说明组件已经渲染出来了。
     * 在 this.evtBus 上触发事件，相当于全局广播，所有监听了 ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP 事件的组件都会收到消息。
     *
     * @param evt
     */


    mosueUpHandler(evt) {
      this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP, new ICEEvent({
        target: this
      }));
    }

    resizeEvtHandler(evt) {
      if (!this.parentNode) {
        return;
      }

      let position = this.props.position;
      this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_RESIZE, new ICEEvent(evt, {
        position
      }));
      this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE, new ICEEvent(evt, {
        position
      }));
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   *
   * @class LineControlPanel
   *
   * 线条变换控制面板
   *
   * LineControlPanel 只作为空的逻辑容器存在，控制面板内部的操作手柄需要全屏幕自由移动位置，手柄位置不固定，对 LineControlPanel 本身的参数完全没有影响。
   *
   * LineControlPanel 功能：
   *
   * - 移动线条的位置
   * - 调整线条起点和终点的位置
   * - 将线条连接到其它组件上
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class LineControlPanel extends ICEControlPanel {
    //TODO:改成可配置参数
    constructor(props) {
      super({ ...props,
        zIndex: bigZIndexNum + 10,
        linkable: false,
        showMinBoundingBox: false,
        showMaxBoundingBox: false
      });
      this.controlSize = 16;
      this.startControl = void 0;
      this.endControl = void 0;
      this.initControls();
    }

    initControls() {
      let width = this.state.width;
      let height = this.state.height;
      let halfControlSize = this.controlSize / 2;
      this.startControl = new ICELinkHook({
        zIndex: bigZIndexNum + 11,
        display: false,
        left: -halfControlSize,
        top: -halfControlSize,
        width: this.controlSize,
        height: this.controlSize,
        //TODO: style 放到 props 中去变成可配置的参数
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        },
        position: 'start'
      });
      this.addChild(this.startControl);
      this.endControl = new ICELinkHook({
        zIndex: bigZIndexNum + 12,
        display: false,
        left: width - halfControlSize,
        top: height - halfControlSize,
        width: this.controlSize,
        height: this.controlSize,
        //TODO: style 放到 props 中去变成可配置的参数
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        },
        position: 'end'
      });
      this.addChild(this.endControl);
    }

    initEvents() {
      this.on(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE, this.resizeEvtHandler, this);
    }

    enable() {
      this.setState({
        display: true
      });
      this.resume(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE);
      this.showHooks();
    }

    disable() {
      this.setState({
        display: false
      });
      this.suspend(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE);
      this.hideHooks();
    }
    /**
     * 设置所有手柄在父组件中的位置，相对于父组件的本地坐标系。
     * LineControlPanel 不强制操作手柄的位置，操作手柄可以自由移动。
     */


    setControlPositions() {}

    resizeEvtHandler(evt) {
      if (!this.targetComponent) {
        return;
      }

      let position = evt.position;
      let movementX = evt.movementX;
      let movementY = evt.movementY;
      let targetState = this.targetComponent.state;
      let len = targetState.points.length;
      let newStartX = targetState.points[0][0];
      let newStartY = targetState.points[0][1];
      let newEndX = targetState.points[len - 1][0];
      let newEndY = targetState.points[len - 1][1]; //用逆矩阵补偿组件 transform 导致的坐标变换。
      //组件自身的 absoluteLinearMatrix 已经包含了所有层级上的 transform 。

      let matrix = invert([], targetState.absoluteLinearMatrix);
      let point = transformMat2d([], [movementX, movementY], matrix);
      movementX = point[0];
      movementY = point[1];

      switch (position) {
        case 'start':
          newStartX += movementX;
          newStartY += movementY;
          break;

        case 'end':
          newEndX += movementX;
          newEndY += movementY;
          break;
      }

      this.targetComponent.setState({
        startPoint: [newStartX, newStartY],
        endPoint: [newEndX, newEndY]
      });
    }

    updatePosition() {
      if (!this.targetComponent) {
        return;
      } //ICEPolyLine 的处理方式与其它组件不同，这里 LineControPanel 本身的外观不重要，只要变换手柄能自由移动就可以
      //设置 LineControlPanel 自身的位置


      this.setState({
        left: 0,
        top: -5,
        width: 3,
        height: 3,
        transform: {
          translate: [0, 0],
          scale: [1, 1],
          skew: [0, 0],
          rotate: 0 //degree

        }
      }); //设置 LineControlPanel 内部手柄的位置

      let halfControlSize = this.controlSize / 2;
      let len = this.targetComponent.state.points.length;
      let start = this.targetComponent.state.points[0];
      let end = this.targetComponent.state.points[len - 1];
      let startPoint = [start[0], start[1]];
      let endPoint = [end[0], end[1]];
      this.startControl.setState({
        left: startPoint[0] - halfControlSize,
        top: startPoint[1] - halfControlSize
      });
      this.endControl.setState({
        left: endPoint[0] - halfControlSize,
        top: endPoint[1] - halfControlSize
      });
    }

    set targetComponent(component) {
      this._targetComponent && this._targetComponent.off(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.updatePosition, this);
      this._targetComponent = component;
      this._targetComponent && this._targetComponent.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.updatePosition, this);
      this._targetComponent && this._targetComponent.once(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, () => {
        this.targetComponent = null;
        this.disable();
      }, this);
      this.updatePosition();
    }

    get targetComponent() {
      return this._targetComponent;
    }

    showHooks() {
      this.startControl.setState({
        display: true
      });
      this.endControl.setState({
        display: true
      });
    }

    hideHooks() {
      this.startControl.setState({
        display: false
      });
      this.endControl.setState({
        display: false
      });
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ResizeControl 调整尺寸的操作手柄
   *
   * - 调整尺寸的操作手柄不能独立存在，只能依附在某个宿主对象上。
   * - 此手柄只能调整尺寸，不能实现翻转
   *
   * TODO: 补全 props 配置项
   * {
   *   direction: 改变的方向，共有3个可选的值： x/y/both
   *   position: 手柄在变换矩形4个边上的位置，共有8个：lt/t/rt/r/rb/b/lb/l
   * }
   */

  class ResizeControl extends ICERect {
    constructor(props) {
      super({
        position: 'l',
        direction: 'x',
        quadrant: 1,
        ...props,
        linkable: false
      });
    }

    initEvents() {
      super.initEvents();
      this.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.resizeEvtHandler, this);
    }
    /**
     * 围绕几何中心点调整宽高。
     * @param evt
     */


    resizeEvtHandler(evt) {
      if (!this.parentNode) {
        //parentNode 是 TransformPanel
        return;
      }

      let {
        quadrant
      } = evt;
      let movementX = evt.movementX;
      let movementY = evt.movementY;
      let parentState = this.parentNode.state;
      let newLeft = parentState.left;
      let newTop = parentState.top;
      let newWidth = parentState.width;
      let newHeight = parentState.height; //用 parentNode 的逆矩阵把全局坐标系中的移动量转换为组件本地的移动量。
      //组件自身的 absoluteLinearMatrix 已经包含了所有层级上的 transform 。

      let matrix = invert([], parentState.absoluteLinearMatrix);
      let point = transformMat2d([], [movementX, movementY], matrix);
      movementX = point[0];
      movementY = point[1];

      switch (quadrant) {
        case 1:
          newLeft -= movementX;
          newTop += movementY;
          newWidth += 2 * movementX;
          newHeight -= 2 * movementY;
          break;

        case 2:
          newLeft += movementX;
          newTop += movementY;
          newWidth -= 2 * movementX;
          newHeight -= 2 * movementY;
          break;

        case 3:
          newLeft += movementX;
          newTop -= movementY;
          newWidth -= 2 * movementX;
          newHeight += 2 * movementY;
          break;

        case 4:
          newLeft -= movementX;
          newTop -= movementY;
          newWidth += 2 * movementX;
          newHeight += 2 * movementY;
          break;

        case 5:
          newTop += movementY;
          newHeight -= 2 * movementY;
          break;

        case 6:
          newTop -= movementY;
          newHeight += 2 * movementY;
          break;

        case 7:
          newLeft += movementX;
          newWidth -= 2 * movementX;
          break;

        case 8:
          newLeft -= movementX;
          newWidth += 2 * movementX;
          break;
      }

      const param = {
        top: newTop,
        left: newLeft,
        width: Math.abs(newWidth),
        height: Math.abs(newHeight)
      };
      this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_RESIZE, new ICEEvent(evt, {
        quadrant
      }));
      this.parentNode.setState(param);
      this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE, new ICEEvent(evt, {
        quadrant
      }));
    }
    /**
     * @overwrite
     * ResizeControl 不能自由移动自己的位置，自能在X轴、Y轴，以及矩形的2条对角线上移动位置。
     *
     * 在全局空间(canvas)中移动指定的位移。
     * 注意：此方法用于直接设置组件在全局空间中的位移，而不是相对于其它坐标系。
     *
     * @param tx
     * @param ty
     * @param evt
     */


    moveGlobalPosition(tx, ty) {
      let evt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new ICEEvent();
      let signX = tx > 0 ? 1 : -1; //signX 大于 0 表示鼠标正在向 X 轴正向移动

      let signY = ty > 0 ? 1 : -1; //signY 大于 0 表示鼠标正在向 Y 轴正向移动

      let parentState = this.parentNode.state;
      let parentLocalOrigin = parentState.localOrigin;
      let parentWidth = parentState.width;
      let parentHeight = parentState.height;
      let matrix = invert([], parentState.absoluteLinearMatrix);
      let point = transformMat2d([], [tx, ty], matrix);
      tx = point[0];
      ty = point[1];
      let {
        left,
        top,
        quadrant
      } = this.state;
      let halfandleSize = this.state.width / 2;
      let newQuadrant = 0;

      if (this.state.direction === 'x') {
        left += tx; //用 0.5 像素的偏移量，防止 left 与原点重叠

        if (round_1(left) === 0) {
          left = signX * 0.5;
        } //手柄发生移动之后，重新计算当前位于哪个象限或者坐标轴上


        if (left + halfandleSize - parentLocalOrigin[0] > 0) {
          newQuadrant = 8;
        } else {
          newQuadrant = 7;
        }
      } else if (this.state.direction === 'y') {
        top += ty; //用 0.5 像素的偏移量，防止 top 与原点重叠

        if (round_1(top) === 0) {
          top = signY * 0.5;
        } //手柄发生移动之后，重新计算当前位于哪个象限或者坐标轴上


        if (top + halfandleSize - parentLocalOrigin[1] > 0) {
          newQuadrant = 6;
        } else {
          newQuadrant = 5;
        }
      } else if (this.state.direction === 'xy') {
        //限制4个顶点位置的手柄只能沿着对角线移动，第1象限和第3象限可以交换位置，第2象限和第4象限可以交换位置。
        //矩形两条对角线过原点，直线解析式 y=kx 。
        //Canvas 中 Y 轴正向向下，与数学坐标反向，斜向右上角的对角线 k 值小于0，斜向右下角对角线 k 值大于 0 。
        let x1 = -parentWidth / 2;

        if (round_1(x1) === 0) {
          x1 = signX * 0.5;
        }

        let y1 = -parentHeight / 2;
        let k1 = y1 / x1;
        let x2 = parentWidth / 2;

        if (round_1(x2) === 0) {
          x2 = signX * 0.5;
        }

        let y2 = -parentHeight / 2;
        let k2 = y2 / x2; //子组件的 left/top 是相对于父组件的左上角位置的数值，而不是父组件移动原点之后的数值，换基到本地原点，然后基于斜率计算。
        //k=(top+halfandleSize-parentLocalOrigin[1]+ty)/(left+halfandleSize-parentLocalOrigin[0]+tx)
        //ty=k(left+halfandleSize-parentLocalOrigin[0]+tx)-(top+halfandleSize-parentLocalOrigin[1])

        if (quadrant === 2 || quadrant == 4) {
          ty = k1 * (left + halfandleSize - parentLocalOrigin[0] + tx) - (top + halfandleSize - parentLocalOrigin[1]);
        } else {
          ty = k2 * (left + halfandleSize - parentLocalOrigin[0] + tx) - (top + halfandleSize - parentLocalOrigin[1]);
        }

        left += tx;
        top += ty; //手柄发生移动之后，重新计算当前位于哪个象限或者坐标轴上

        if (left + halfandleSize - parentLocalOrigin[0] > 0) {
          if (top + halfandleSize - parentLocalOrigin[1] > 0) {
            newQuadrant = 4;
          } else {
            newQuadrant = 1;
          }
        } else {
          if (top + halfandleSize - parentLocalOrigin[1] > 0) {
            newQuadrant = 3;
          } else {
            newQuadrant = 2;
          }
        }
      } //可能需要和对面的手柄交换象限


      let quadrantSwitched = quadrant === newQuadrant ? false : true;

      if (quadrantSwitched) {
        this.parentNode.toggleControlQuadrant(this, newQuadrant);
      }

      this.setPosition(left, top, new ICEEvent(evt, {
        left,
        top,
        tx,
        ty,
        quadrant: newQuadrant
      }));
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class RotateControl 旋转操作手柄
   *
   * - 旋转手柄不能独立存在，只能依附在某个宿主对象上。
   * - 此手柄仅用来修改组件的旋转角度。
   *
   * TODO: 补全 props 配置项
   * {
   * }
   */

  class RotateControl extends ICECircle {
    constructor(props) {
      super({ ...props,
        linkable: false
      });
    }

    initEvents() {
      super.initEvents();
      this.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.rotateEvtHandler, this);
    }

    rotateEvtHandler(evt) {
      if (!this.parentNode) {
        //parentNode 是 TransformPanel
        return;
      } //计算手柄旋转角


      let parentOrigin = this.parentNode.state.absoluteOrigin;
      let rotateAngle = GeoUtil.calcRotateAngle(evt.offsetX, evt.offsetY, parentOrigin[0], parentOrigin[1]); //parentNode 旋转角与手柄旋转角同步

      const param = {
        transform: {
          rotate: rotateAngle + 90 //旋转手柄默认处于逆时针 90 度位置，这里加 90 度进行补偿。

        }
      };
      this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ROTATE, new ICEEvent(param));
      this.parentNode.setState(param);
      this.parentNode.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE, new ICEEvent(param));
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class TransformControlPanel
   *
   * 变换控制面板
   *
   * - TransformControlPanel 本身总是直接画在 canvas 上，不是任何组件的孩子。
   * - TransformControlPanel 是全局单例，在任意时刻，不可能同时出现多个 TransformControlPanel 的实例，因为在图形化的用户交互模式下，用户无法同时操控多个控制面板。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class TransformControlPanel extends ICEControlPanel {
    //TODO:改成可配置参数
    //TODO:改成可配置参数
    //TODO:改成可配置参数
    constructor(props) {
      super({ ...props,
        zIndex: bigZIndexNum + 1,
        linkable: false,
        showMinBoundingBox: false,
        showMaxBoundingBox: false
      });
      this.rotateControlInstance = void 0;
      this.rotateControlSize = 8;
      this.rotateControlffsetY = 60;
      this.resizeControlInstanceCache = [];
      this.resizeControlSize = 16;
      this.initControls();
    }
    /**
     * 添加尺寸和旋转变换手柄，初始化时添加在内部的[0,0]位置，此方法只创建对象实例，不执行渲染操作。
     * TODO:添加斜切手柄？
     */


    initControls() {
      // 创建 8 个 ResizeControl
      // 计算手柄位于父组件的哪一个象限中，有以下取值：
      // - 1: 第1象限；
      // - 2: 第2象限；
      // - 3: 第3象限；
      // - 4: 第4象限；
      // - 5: 位于X轴上方，y值为负，不属于任何象限；
      // - 6: 位于X轴下方，y值为正，不属于任何象限；
      // - 7: 位于Y轴左侧，x值为负，不属于任何象限；
      // - 8: 位于Y轴右侧，x值为正，不属于任何象限；
      //
      // 默认创建顺序，从左上角开始顺时针：tl:2/t:5/tr:1/r:8/rb:4/b:6/lb:3/l:7
      // 第1和第3象限可以交换位置
      // 第2和第4象限可以交换位置
      // X 轴正负可以交换位置
      // Y 轴正负可以交换位置
      let width = this.state.width;
      let height = this.state.height;
      let halfWidth = width / 2;
      let halfHeight = height / 2;
      let halfControlSize = this.resizeControlSize / 2;
      let resizeControlConfig = [{
        direction: 'xy',
        //可以移动的坐标轴
        quadrant: 2,
        //在组件本地坐标轴中的象限 @see ResizeControl
        position: [-halfControlSize, -halfControlSize]
      }, {
        direction: 'y',
        quadrant: 5,
        position: [halfWidth - halfControlSize, -halfControlSize]
      }, {
        direction: 'xy',
        quadrant: 1,
        position: [width - halfControlSize, -halfControlSize]
      }, {
        direction: 'x',
        quadrant: 8,
        position: [width - halfControlSize, halfHeight - halfControlSize]
      }, {
        direction: 'xy',
        quadrant: 4,
        position: [width - halfControlSize, height - halfControlSize]
      }, {
        direction: 'y',
        quadrant: 6,
        position: [halfWidth - halfControlSize, height - halfControlSize]
      }, {
        direction: 'xy',
        quadrant: 3,
        position: [-halfControlSize, height - halfControlSize]
      }, {
        direction: 'x',
        quadrant: 7,
        position: [-halfControlSize, halfHeight - halfControlSize]
      }];
      this.resizeControlInstanceCache = [];

      for (let i = 0; i < resizeControlConfig.length; i++) {
        const controlConfig = resizeControlConfig[i];
        const handleInstance = new ResizeControl({
          zIndex: bigZIndexNum + 2,
          display: false,
          left: controlConfig.position[0],
          top: controlConfig.position[1],
          width: this.resizeControlSize,
          height: this.resizeControlSize,
          //TODO: style 放到 props 中去变成可配置的参数
          style: {
            strokeStyle: '#8b0000',
            fillStyle: '#CC3300',
            lineWidth: 1
          },
          direction: controlConfig.direction,
          quadrant: controlConfig.quadrant
        });
        this.addChild(handleInstance);
        this.resizeControlInstanceCache.push(handleInstance);
      } // 创建 1 个 RotateControl


      let left = this.state.width / 2 - this.rotateControlSize;
      let top = -this.rotateControlffsetY;
      this.rotateControlInstance = new RotateControl({
        zIndex: bigZIndexNum + 3,
        display: false,
        left: left,
        top: top,
        radius: this.rotateControlSize,
        //TODO: style 放到 props 中去变成可配置的参数
        style: {
          strokeStyle: '#8b0000',
          fillStyle: '#CC3300',
          lineWidth: 1
        }
      });
      this.addChild(this.rotateControlInstance);
    }

    initEvents() {
      super.initEvents();
      this.on(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE, this.resizeEvtHandler, this);
      this.on(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE, this.rotateEvtHandler, this);
    }

    enable() {
      this.rotateControlInstance.setState({
        display: true
      });

      for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
        const item = this.resizeControlInstanceCache[i];
        item.setState({
          display: true
        });
      }

      this.setState({
        display: true
      });
      this.resume(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE);
      this.resume(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE);
    }

    disable() {
      this.rotateControlInstance.setState({
        display: false
      });

      for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
        const item = this.resizeControlInstanceCache[i];
        item.setState({
          display: false
        });
      }

      this.setState({
        display: false
      });
      this.suspend(ICE_EVENT_NAME_CONSTS.AFTER_RESIZE);
      this.suspend(ICE_EVENT_NAME_CONSTS.AFTER_ROTATE);
    }

    setControlPositions() {
      //重新计算所有 ResizeControl 的位置，共8个
      let width = this.state.width;
      let height = this.state.height;
      let halfWidth = width / 2;
      let halfHeight = height / 2;
      let halfControlSize = this.resizeControlSize / 2;

      for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
        const resizeControl = this.resizeControlInstanceCache[i];
        let quadrant = resizeControl.state.quadrant;
        let point = [0, 0];

        switch (quadrant) {
          case 1:
            point = [width - halfControlSize, -halfControlSize];
            break;

          case 2:
            point = [-halfControlSize, -halfControlSize];
            break;

          case 3:
            point = [-halfControlSize, height - halfControlSize];
            break;

          case 4:
            point = [width - halfControlSize, height - halfControlSize];
            break;

          case 5:
            point = [halfWidth - halfControlSize, -halfControlSize];
            break;

          case 6:
            point = [halfWidth - halfControlSize, height - halfControlSize];
            break;

          case 7:
            point = [-halfControlSize, halfHeight - halfControlSize];
            break;

          case 8:
            point = [width - halfControlSize, halfHeight - halfControlSize];
            break;
        }

        resizeControl.setState({
          left: point[0],
          top: point[1]
        });
      } //重新计算 RotateControl 的位置


      let left = this.state.width / 2 - this.rotateControlSize;
      let top = -this.rotateControlffsetY;
      this.rotateControlInstance.setState({
        left,
        top
      });
    }

    rotateEvtHandler(evt) {
      if (!this.targetComponent) {
        return;
      }

      let {
        rotate
      } = this.state.transform;
      this.targetComponent.setGlobalRotate(rotate);
    }

    resizeEvtHandler(evt) {
      if (!this.targetComponent) {
        return;
      }

      let {
        quadrant
      } = evt;
      let movementX = evt.movementX;
      let movementY = evt.movementY;
      let targetState = this.targetComponent.state;
      let newLeft = targetState.left;
      let newTop = targetState.top;
      let newWidth = targetState.width;
      let newHeight = targetState.height;
      let matrix = invert([], targetState.absoluteLinearMatrix);
      let point = transformMat2d([], [movementX, movementY], matrix);
      movementX = point[0];
      movementY = point[1];

      switch (quadrant) {
        case 1:
          newLeft -= movementX;
          newTop += movementY;
          newWidth += 2 * movementX;
          newHeight -= 2 * movementY;
          break;

        case 2:
          newLeft += movementX;
          newTop += movementY;
          newWidth -= 2 * movementX;
          newHeight -= 2 * movementY;
          break;

        case 3:
          newLeft += movementX;
          newTop -= movementY;
          newWidth -= 2 * movementX;
          newHeight += 2 * movementY;
          break;

        case 4:
          newLeft -= movementX;
          newTop -= movementY;
          newWidth += 2 * movementX;
          newHeight += 2 * movementY;
          break;

        case 5:
          newTop += movementY;
          newHeight -= 2 * movementY;
          break;

        case 6:
          newTop -= movementY;
          newHeight += 2 * movementY;
          break;

        case 7:
          newLeft += movementX;
          newWidth -= 2 * movementX;
          break;

        case 8:
          newLeft -= movementX;
          newWidth += 2 * movementX;
          break;
      }

      this.targetComponent.setState({
        left: newLeft,
        top: newTop,
        width: Math.abs(newWidth),
        height: Math.abs(newHeight)
      });
    }

    updatePanel() {
      if (!this.targetComponent) {
        return;
      }

      let angle = this.targetComponent.getRotateAngle();
      let {
        left,
        top,
        width,
        height
      } = this.targetComponent.getLocalLeftTop();
      this.setState({
        left,
        top,
        width,
        height,
        transform: {
          rotate: angle
        }
      });
    }

    set targetComponent(component) {
      this._targetComponent && this._targetComponent.off(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.updatePanel, this);
      this._targetComponent = component;
      this._targetComponent && this._targetComponent.on(ICE_EVENT_NAME_CONSTS.AFTER_MOVE, this.updatePanel, this);
      this._targetComponent && this._targetComponent.once(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, () => {
        this.targetComponent = null;
        this.disable();
      }, this);
      this.updatePanel();
    }

    get targetComponent() {
      return this._targetComponent;
    }
    /**
     * 交换两个 Control 的象限
     * @param control
     * @param quadrant
     */


    toggleControlQuadrant(control, quadrant) {
      //1-3可以交换，2-4可以交换，5-6可以交换，7-8可以交换
      for (let i = 0; i < this.resizeControlInstanceCache.length; i++) {
        const item = this.resizeControlInstanceCache[i];

        if (item.state.quadrant === quadrant) {
          let tempQuadrant = 0;

          switch (quadrant) {
            case 1:
              tempQuadrant = 3;
              break;

            case 2:
              tempQuadrant = 4;
              break;

            case 3:
              tempQuadrant = 1;
              break;

            case 4:
              tempQuadrant = 2;
              break;

            case 5:
              tempQuadrant = 6;
              break;

            case 6:
              tempQuadrant = 5;
              break;

            case 7:
              tempQuadrant = 8;
              break;

            case 8:
              tempQuadrant = 7;
              break;
          }

          item.setState({
            quadrant: tempQuadrant
          });
        }
      }

      control.setState({
        quadrant: quadrant
      });
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICEControlPanelManager
   *
   * 控制面板管理器
   *
   * - ICEControlPanelManager 负责管理所有类型的控制面板（ControlPanel）。
   * - ICEControlPanelManager 是全局单例的，一个 ICE 实例上只能有一个实例。
   * - ICEControlPanelManager 只需要设置 targetComponent 即可，拖拽移位操作由  DDManager 完成。
   * - ICEControlPanelManager 是纯逻辑组件，没有外观。
   *
   * @see ICE
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEControlPanelManager {
    //FIXME:这里需要重构，不同类型的组件需要展现不同的操作工具，操作工具可能会有 N 种，需要进一步抽象操作工具相关的逻辑。
    constructor(ice) {
      this.ice = void 0;
      this.transformControlPanel = void 0;
      this.lineControlPanel = void 0;
      this.ice = ice;
      this.transformControlPanel = new TransformControlPanel({
        left: 500,
        top: 100,
        width: 100,
        height: 100,
        style: {
          strokeStyle: '#8b0000',
          fillStyle: 'rgba(255, 255, 49, 0.2)',
          lineWidth: 1
        },
        transform: {
          rotate: 45
        }
      });
      this.ice.addTool(this.transformControlPanel);
      this.transformControlPanel.disable(); //默认处于禁用状态

      this.lineControlPanel = new LineControlPanel({
        left: 700,
        top: 50,
        width: 100,
        height: 100,
        style: {
          strokeStyle: 'rgba(255, 255, 49, 0)',
          fillStyle: 'rgba(255, 255, 49, 0)',
          lineWidth: 1
        }
      });
      this.ice.addTool(this.lineControlPanel);
      this.lineControlPanel.disable(); //默认处于禁用状态
    }

    start() {
      this.ice.evtBus.on('mousedown', this.mouseDownHandler, this);
      return this;
    }

    stop() {
      this.ice.evtBus.off('mousedown', this.mouseDownHandler, this);
      return this;
    }

    mouseDownHandler(evt) {
      let component = evt.target;

      if (!(component instanceof ICEComponent) || !component.state.interactive || !component.state.transformable) {
        this.lineControlPanel.disable();
        this.transformControlPanel.disable();
        return;
      } //只有 ICEControlPanel 和它内部的变换手柄才具备跟随鼠标移动的功能，其它组件都需要由 ICEControlPanel 驱动进行移动和变换。


      const isControlPanel = component && (component instanceof ICEControlPanel || component.parentNode instanceof ICEControlPanel);

      if (isControlPanel) {
        return;
      }

      this.ice.selectionList = [component];
      this.lineControlPanel.disable();
      this.transformControlPanel.disable(); //线条型的组件变换工具与其它组件不同

      if (component instanceof ICEPolyLine) {
        this.lineControlPanel.targetComponent = component;
        this.lineControlPanel.enable();
      } else {
        this.transformControlPanel.targetComponent = component;
        this.transformControlPanel.enable();
      }
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * 原生 DOM 事件与 ICE 内部转发事件之间的对应关系
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  const mouseEvents = [['mousedown', 'ICE_MOUSEDOWN'], ['mouseup', 'ICE_MOUSEUP'], ['mousemove', 'ICE_MOUSEMOVE'], ['click', 'ICE_CLICK'], ['dbclick', 'ICE_DBCLICK'], ['contextmenu', 'ICE_CONTEXTMENU']];

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * @class DOMEventBridge
   *
   * 事件桥接器，把原生 DOM 事件转发给 canvas 内部的组件。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class DOMEventBridge {
    constructor(ice) {
      this.selectionCandidates = [];
      this.ice = void 0;
      this._stopped = false;
      this.ice = ice;
    }

    start() {
      let componentCache = null; //缓存上次被点击的组件

      for (let i = 0; i < mouseEvents.length; i++) {
        const evtMapping = mouseEvents[i];
        const iceEvtName = evtMapping[1];
        const originEvtName = evtMapping[0];
        this.ice.evtBus.on(iceEvtName, evt => {
          if (this._stopped) {
            return;
          } //! mousemove 事件的触发频率非常高，对于 mousemove 事件不执行 findTargetComponent() 操作


          if (iceEvtName !== 'ICE_MOUSEMOVE') {
            componentCache = this.findTargetComponent(evt);
          }

          if (componentCache) {
            evt.target = componentCache;
            componentCache.trigger(originEvtName, evt);
          }

          this.ice.evtBus.trigger(originEvtName, evt); //this.ice.evtBus 本身一定会触发一次事件。
        });
      }

      return this;
    }

    set stopped(flag) {
      this._stopped = flag;
    }

    get stopped() {
      return this._stopped;
    }
    /**
     * @method findTargetComponent
     *
     * 找到被点击的对象，用代码触发 click 事件。
     * 在点击状态下，每次只能点击一个对象，当前不支持 DOM 冒泡特性。
     *
     * @returns
     */


    findTargetComponent(evt) {
      if (this._stopped) return null;
      let {
        offsetX,
        offsetY
      } = evt;
      let x = offsetX;
      let y = offsetY;
      let arr1 = flattenTree([], this.ice.toolNodes);
      let arr2 = flattenTree([], this.ice.childNodes);
      let arr = [...arr1, ...arr2];
      arr.sort((a, b) => {
        return a.state.zIndex - b.state.zIndex;
      });

      for (let i = 0; i < arr.length; i++) {
        let component = arr[i];
        let {
          interactive,
          display
        } = component.state;
        let flag = component.containsPoint(x, y);

        if (flag && interactive && display) {
          this.selectionCandidates.push(component);
        }
      }

      let component = this.selectionCandidates.pop();
      this.selectionCandidates = [];
      return component;
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class EventBus
   * @singleton
   *
   * EventBus 事件总线。
   *
   * - canvas 标签内部没有事件机制，ICE 借助于 EventBus 把原生 DOM 事件转发到 canvas 内部(mouse/keyboard/touch)，在转发过程中可能会把原生 DOM 事件转换成 ICEEvent 。
   * - EventBus 是 ICEEventTarget 的实现类。
   * - EventBus 是全局单例，同一个 ICE 实例上只能有一个事件总线的实例。
   * - ICE 内部几乎所有机制都依赖事件总线来实现。
   * - requestAnimationFrame 会利用事件总线触发 FRAME 事件。
   *
   * @see ICEEventTaregt
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class EventBus extends ICEEventTarget {
    constructor() {
      super();
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class MouseEventInterceptor
   * DOM 事件拦截器，拦截所有原生的 DOM 鼠标事件。
   * 拦截到的事件全部转发到全局事件总线上去，EventBridge 会监听事件总线，把事件派发到 canvas 内部的组件上去。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  const MouseEventInterceptor = {
    //在同一个 window 中可能存在多个 ICE 实例，每一个 ICE 实例上都有一条事件总线，这里把多个事件总线实例隔开。
    evtBuses: [],
    start: function () {
      if (root$2 && root$2 && root$2.addEventListener) {
        //所有原生 DOM 事件全部通过 EventBus 转发到 canvas 内部的对象上去
        //TODO:不同浏览器版本，以及 NodeJS 环境兼容性测试
        for (let i = 0; i < MouseEventInterceptor.evtBuses.length; i++) {
          const evtBus = MouseEventInterceptor.evtBuses[i];

          for (let j = 0; j < mouseEvents.length; j++) {
            const item = mouseEvents[j];
            root$2.addEventListener(item[0], domEvt => {
              evtBus.trigger(item[1], domEvt);
            });
          }
        }
      }
    },
    regitserEvtBus: function (evtBus) {
      if (MouseEventInterceptor.evtBuses.includes(evtBus)) {
        return;
      }

      MouseEventInterceptor.evtBuses.push(evtBus);
    },
    delEvtBus: function (evtBus) {
      if (!MouseEventInterceptor.evtBuses.includes(evtBus)) {
        return;
      }

      MouseEventInterceptor.evtBuses.splice(MouseEventInterceptor.evtBuses.indexOf(evtBus), 1);
    }
  };

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class FrameManager
   *
   * 帧频控制器，全局单例，请勿创建多个实例。
   * 在同一个 window/global 中，只有一个 FrameManager ，也就是说 FrameManager 是跨 ICE 实例共享的。
   * FrameManager 只负责把 window/global 上的 requestAnimationFrame 回调函数转换成 ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT 事件，然后在所有事件总线上进行触发。
   * FrameManager 只触发事件，不进行渲染，渲染操作由对应的 Render 完成。
   *
   * @singleton
   * @see ICE
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  const FrameManager = {
    evtBuses: [],
    stopped: false,
    frameCallback: function () {
      for (let i = 0; i < FrameManager.evtBuses.length; i++) {
        if (FrameManager.stopped) return;
        const evtBus = FrameManager.evtBuses[i];
        evtBus.trigger(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT);
      }

      if (!FrameManager.stopped) {
        root$2.requestFrame(FrameManager.frameCallback);
      }
    },
    start: function () {
      FrameManager.stopped = false;
      root$2.requestFrame(FrameManager.frameCallback);
    },
    stop: function () {
      FrameManager.stopped = true;
    },
    pause: function () {},
    resume: function () {},
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
    }
  };

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * @class ICELinkSlot
   *
   * 连接插槽
   *
   * - ICELinkSlot 与 ICELinkHook 是一对组件，用来把两个组件连接起来。
   * - 一个插槽上面可以连多个钩子，ICELinkSlot 与 ICELinkHook 之间是一对多的关系。
   * - ICELinkSlot 不能独立存在，它必须附属在某个宿主组件上。逻辑附属，非真实的外观附属。
   * - ICELinkSlot 总是绘制在全局 canvas 中，它不是任何组件的子节点。
   * - ICELinkSlot 自身不进行任何 transform 。
   * - ICELinkSlot 的实例是由 ICELinkSlotManager 统一动态创建的，如果组件的 linkable 状态为 tue ，ICELinkSlotManager 会动态在组件上创建连接插槽。
   *
   * @see ICELinkHook
   * @see ICELinkSlotManager
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class ICELinkSlot extends ICECircle {
    //宿主组件。

    /**
     * position 有4个取值，分别位于宿主边界盒子的4个边的几何中点上：
     * - T: 顶部
     * - R: 右侧
     * - B: 底部
     * - L: 左侧
     *
     * 连接插槽自身不可拖拽、不可连接。
     * @param props
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        linkable: false,
        draggable: false,
        position: 'T',
        ...props
      });
      this._hostComponent = void 0;
    }

    initEvents() {
      super.initEvents(); //由于 ICELinkSlot 默认不可见，实例的 display 为 false ，所以不会触发 AFTER_RENDER 事件，这里只能监听 BEFORE_RENDER
      //不能在 initEvents() 方法中访问 this.evtBus ，在 initEvents() 被调用时 this.evtBus 为空，因为对象在进入到渲染阶段时才会被设置 evtBus 实例。 @see ICE.evtBus

      this.once(ICE_EVENT_NAME_CONSTS.BEFORE_RENDER, this.beforeRenderHandler, this);
      this.once(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, this.beforeRemoveHandler, this);
    }

    beforeRenderHandler(evt) {
      this.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEDOWN, this.hookMouseDownHandler, this);
      this.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
      this.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP, this.hookMouseUpHandler, this);
      this.evtBus.on('mouseup', this.globalMouseUpHandler, this);
    }

    beforeRemoveHandler(evt) {
      this.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEDOWN, this.hookMouseDownHandler, this);
      this.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
      this.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEUP, this.hookMouseUpHandler, this);
      this.evtBus.off('mouseup', this.globalMouseUpHandler, this);
      this._hostComponent = null;
    }
    /**
     * 只要鼠标弹起，连接插槽总是变成不可见状态。
     */


    globalMouseUpHandler() {
      this.setState({
        display: false
      });
    }
    /**
     * 监听 EventBus 上连接钩子鼠标按下事件
     * @param evt
     */


    hookMouseDownHandler(evt) {
      console.log('linkslot, hook mousedown event...');

      if (!this._hostComponent) {
        return;
      }

      this.setState({
        display: true
      });
    }
    /**
     * 监听 EventBus 上连接钩子鼠标移动事件，判断钩子是否与插槽发生了碰撞。
     * FIXME:这里需要更好的碰撞检测算法，与所有插槽进行比对的方式效率太低。
     * @param evt
     */


    hookMouseMoveHandler(evt) {
      let linkHook = evt.target;

      if (this.isIntersectWithHook(linkHook)) {
        //FIXME:鼠标划过时的样式移动到配置项里面去
        this.setState({
          style: {
            fillStyle: '#fffb00'
          }
        });
        linkHook._currentAboveSlot = this;
        linkHook.setState({
          style: {
            fillStyle: '#fffb00'
          }
        });
      } else {
        this.setState({
          style: {
            fillStyle: '#3ce92c'
          }
        });

        if (linkHook._currentAboveSlot === this) {
          linkHook.setState({
            style: {
              fillStyle: '#3ce92c'
            }
          });
        }
      }
    }
    /**
     * 处理 EventBus 上连接钩子鼠标弹起事件
     * @param evt
     */


    hookMouseUpHandler(evt) {
      if (!this._hostComponent) {
        return;
      }

      let linkHook = evt.target;
      let linkLine = linkHook.parentNode.targetComponent;
      let position = linkHook.state.position;

      if (this.isIntersectWithHook(linkHook)) {
        linkLine && linkLine.setLink(position, this._hostComponent, this.props.position);
      } else {
        linkLine && linkLine.removeLink(position, this._hostComponent, this.props.position);
      }

      this.setState({
        display: false,
        style: {
          fillStyle: '#3ce92c'
        }
      });
      linkHook.setState({
        style: {
          fillStyle: '#3ce92c'
        }
      });
    }

    isIntersectWithHook(linkHook) {
      let slotBounding = this.getMaxBoundingBox();
      let hookBounding = linkHook.getMaxBoundingBox();

      if (slotBounding.isIntersect(hookBounding)) {
        return true;
      }

      return false;
    } //FIXME:这里位置计算有问题
    //FIXME:这里需要采用 TransformControlPanel 中的算法来计算插槽位置。


    updatePosition() {
      console.log('link slot update position ...');

      let box = this._hostComponent.getMinBoundingBox();

      let left = 0;
      let top = 0;

      switch (this.state.position) {
        case 'T':
          left = box.center[0] - this.state.radius;
          top = box.tl[1] - this.state.radius;
          break;

        case 'R':
          left = box.tr[0] - this.state.radius;
          top = box.center[1] - this.state.radius;
          break;

        case 'B':
          left = box.center[0] - this.state.radius;
          top = box.br[1] - this.state.radius;
          break;

        case 'L':
          left = box.bl[0] - this.state.radius;
          top = box.center[1] - this.state.radius;
          break;
      }

      this.setState({
        left,
        top
      });
    }

    set hostComponent(component) {
      this._hostComponent && this._hostComponent.off(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.updatePosition, this);
      this._hostComponent = component;
      this._hostComponent && this._hostComponent.on(ICE_EVENT_NAME_CONSTS.AFTER_RENDER, this.updatePosition, this);
      this._hostComponent && this._hostComponent.once(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, () => {
        this._hostComponent = null;
        this.setState({
          display: false
        });
      }, this);
      this._hostComponent && this.setState({
        display: true
      });
    }

    get hostComponent() {
      return this._hostComponent;
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICELinkSlotManager
   *
   * - ICELinkSlotManager 连接插槽管理器，用于管理连接插槽，共4个，所有可连接的组件都复用这4个插槽的实例。
   * - ICELinkSlotManager 的实例是在 ICE 初始化时创建的。
   * - ICELinkSlotManager 是全局单例，同一个 ICE 实例上只能有一个 ICELinkSlotManager 实例。
   *
   * @see ICE
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICELinkSlotManager {
    constructor(ice) {
      this.slotRadius = 10;
      this.ice = void 0;
      this.ice = ice;
    }

    start() {
      this.createLinkSlots();
      this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
      return this;
    }

    stop() {
      this.ice.evtBus.off(ICE_EVENT_NAME_CONSTS.HOOK_MOUSEMOVE, this.hookMouseMoveHandler, this);
      return this;
    }

    hookMouseMoveHandler(evt) {
      let linkHook = evt.target;
      let hookBounding = linkHook.getMaxBoundingBox();
      const childNodes = [...this.ice.childNodes];

      for (let i = 0; i < childNodes.length; i++) {
        const component = childNodes[i];

        if (!component || !component.state.linkable) {
          continue;
        }

        let slotBounding = component.getMaxBoundingBox();

        if (slotBounding.isIntersect(hookBounding)) {
          for (let i = 0; i < this.ice._linkSlots.length; i++) {
            this.ice._linkSlots[i].hostComponent = component;
          }

          return;
        }
      }
    }
    /**
     * 创建连接插槽，插槽默认分布在组件最小边界盒子的4条边几何中点位置。
     * 有顺序，按照 TRBL 上右下左 创建，插槽的 ID 会被序列化。
     */


    createLinkSlots() {
      if (this.ice._linkSlots && this.ice._linkSlots.length) {
        return;
      }

      let slot_1 = new ICELinkSlot({
        zIndex: bigZIndexNum,
        display: false,
        transformable: false,
        draggable: false,
        radius: this.slotRadius,
        position: 'T',
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        }
      });
      this.ice.addTool(slot_1);
      let slot_2 = new ICELinkSlot({
        zIndex: bigZIndexNum,
        display: false,
        transformable: false,
        draggable: false,
        radius: this.slotRadius,
        position: 'R',
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        }
      });
      this.ice.addTool(slot_2);
      let slot_3 = new ICELinkSlot({
        zIndex: bigZIndexNum,
        display: false,
        transformable: false,
        draggable: false,
        radius: this.slotRadius,
        position: 'B',
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        }
      });
      this.ice.addTool(slot_3);
      let slot_4 = new ICELinkSlot({
        zIndex: bigZIndexNum,
        display: false,
        transformable: false,
        draggable: false,
        radius: this.slotRadius,
        position: 'L',
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        }
      });
      this.ice.addTool(slot_4);
      this.ice._linkSlots = [slot_1, slot_2, slot_3, slot_4];
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   *
   * FIXME: 需要默认把正多边形的其中一个顶点或者边固定在屏幕上方90度位置。
   *
   * @class ICEIsogon
   *
   * 正多边形
   *
   * 用宽高描述法描述正多边形，方便传参。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEIsogon extends ICEDotPath {
    //外接圆的半径
    //边数 N ，正整数

    /**
     * radius, edges 会暴露给 AnimationManager ，可能会动态变化。
     * @param props
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      let param = {
        radius: 10,
        edges: 3,
        ...props
      };
      param.width = param.radius * 2;
      param.height = param.radius * 2;
      super(param);
      this.radius = 10;
      this.edges = 3;
      this.radius = this.props.radius; //FIXME:delete?

      this.edges = this.props.edges; //FIXME:delete?
    }
    /**
     * 计算路径上的关键点:
     * - 默认的坐标原点是 (0,0) 位置。
     * - 这些点没有经过 transform 矩阵变换。
     * @returns
     */


    calcDots() {
      //求正 N 边形的顶点坐标，极坐标法。
      this.state.dots = [];
      let avgAngle = 2 * Math.PI / this.state.edges; //FIXME: 需要默认把正多边形的其中一个顶点或者边固定在屏幕上方90度位置。
      //FIXME:这里需要重新设置起始角度
      //FIXME:当边数为奇数时，把一个顶点放在正上方90度位置，当边数为偶数时，把一条边与 X 轴平行

      for (let i = 0; i < this.state.edges; i++) {
        let currentAngel = avgAngle * i;
        let radius = this.state.radius;
        let x = Math.floor(radius * Math.cos(currentAngel) + radius);
        let y = Math.floor(radius * Math.sin(currentAngel) + radius);
        this.state.dots.push([x, y]);
      }

      return this.state.dots;
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICEStar 五角星
   * TODO:实现正 N 角星
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEStar extends ICEIsogon {
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        radius: 10,
        edges: 5,
        ...props
      });
    }

    doCreatePath() {
      this.path2D = new Path2D();
      let counter = 0;
      let i = 0;

      while (counter < this.state.edges) {
        let j = (i + 2) % this.state.edges;
        let v1 = this.state.dots[i];
        let v2 = this.state.dots[j];

        if (counter == 0) {
          this.path2D.moveTo(v1[0], v1[1]);
          this.path2D.lineTo(v2[0], v2[1]);
        } else {
          this.path2D.lineTo(v2[0], v2[1]);
        }

        i = j;
        counter++;
      }

      this.path2D.closePath();
      return this.path2D;
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * 组件名称和构造函数引用之间的映射关系，把序列化之后的 JSON 字符串重新解析成图形时需要用到此映射关系。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   *
   * //FIXME:需要扩展一个注册方法，让外部使用方把自己扩展的组件注册进来，否则无法序列化和反解析。
   */

  const componentTypeMap = Object.fromEntries(new Map([['ICERect', ICERect], ['ICECircle', ICECircle], ['ICEEllipse', ICEEllipse], ['ICEStar', ICEStar], ['ICEIsogon', ICEIsogon], ['ICEText', ICEText], ['ICEImage', ICEImage], ['ICEGroup', ICEGroup], ['ICEVisioLink', ICEVisioLink], ['ICEPolyLine', ICEPolyLine]]));

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * @class Deserializer
   *
   * 把 JSON 字符串反解析成图形。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class Deserializer {
    constructor(ice) {
      this.ice = void 0;
      this.ice = ice;
    }

    fromJSON(jsonStr) {
      const jsonObj = JSON.parse(jsonStr);
      const childNodes = jsonObj.childNodes;

      for (let i = 0; i < childNodes.length; i++) {
        this.decodeRecursively(this.ice, childNodes[i]);
      }
    } //递归


    decodeRecursively(parentNode, nodeData) {
      const Clazz = componentTypeMap[nodeData.type];
      const state = nodeData.state;
      const instance = new Clazz(state);
      parentNode.addChild(instance);
      let childNodes = nodeData.childNodes;

      if (childNodes && childNodes.length) {
        for (let i = 0; i < childNodes.length; i++) {
          this.decodeRecursively(instance, childNodes[i]);
        }
      }
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * @class Serializer
   *
   * 把图形序列化成 JSON 字符串。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class Serializer {
    constructor(ice) {
      this.ice = void 0;
      this.ice = ice;
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = {
        createTime: new Date().toLocaleString(),
        lastModifyTime: new Date().toLocaleString(),
        childNodes: []
      };

      for (let i = 0; i < this.ice.childNodes.length; i++) {
        const child = this.ice.childNodes[i];
        this.encodeRecursively(child, result);
      }

      console.log(result);
      return JSON.stringify(result);
    } //递归序列化


    encodeRecursively(component, parentData) {
      let currentData = {
        state: component.state,
        type: component.constructor.name,
        childNodes: []
      };
      parentData.childNodes.push(currentData);

      if (component.childNodes && component.childNodes.length) {
        for (let i = 0; i < component.childNodes.length; i++) {
          this.encodeRecursively(component.childNodes[i], currentData);
        }
      }
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class CanvasRenderer
   *
   * Canvas 渲染器
   *
   * - 一个 ICE 实例上，只能有一个渲染器实例。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class CanvasRenderer extends ICEEventTarget {
    //等待渲染的组件队列，FIFO
    //等待渲染的工具组件队列，FIFO
    constructor(ice) {
      super();
      this.ice = void 0;
      this.stopped = false;
      this.componentQueue = [];
      this.toolsQueue = [];
      this.ice = ice;
    }

    start() {
      this.stopped = false;
      this.ice.evtBus.on(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
      return this;
    }

    stop() {
      this.stopped = true;
      this.ice.evtBus.off(ICE_EVENT_NAME_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
      return this;
    }

    frameEvtHandler(evt) {
      if (this.ice.dirty) {
        this.doRender();
      } else {
        console.log('没有需要渲染的组件...');
      }
    }

    refreshQueue() {
      this.componentQueue = flattenTree([], this.ice.childNodes);
      this.componentQueue.sort((firstEl, secondEl) => {
        return firstEl.state.zIndex - secondEl.state.zIndex;
      });
      console.log(`Component Queue length> ${this.componentQueue.length}`);
      this.toolsQueue = flattenTree([], this.ice.toolNodes);
      console.log(`Tool Queue length> ${this.ice.toolNodes.length}`);
    }

    doRender() {
      const startTime = Date.now();
      this.refreshQueue(); //渲染组件

      this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);

      for (let i = 0; i < this.componentQueue.length; i++) {
        const component = this.componentQueue[i];
        component.root = this.ice.root;
        component.ctx = this.ice.ctx;
        component.evtBus = this.ice.evtBus;
        component.ice = this.ice;
        component.render();
      } //渲染工具节点


      for (let i = 0; i < this.toolsQueue.length; i++) {
        const tool = this.toolsQueue[i];
        tool.root = this.ice.root;
        tool.ctx = this.ice.ctx;
        tool.evtBus = this.ice.evtBus;
        tool.ice = this.ice;
        tool.render();
      } //完成一轮渲染时，在总线上触发一个 ROUND_FINISH 事件。


      console.log(`Render time ${Date.now() - startTime} ms.`);
      this.ice.dirty = false;
      this.ice.evtBus.trigger(ICE_EVENT_NAME_CONSTS.ROUND_FINISH);
    }

  }

  /**
   * @class ImageCache
   * 图片缓存类
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class ImageCache {
    constructor(ice) {
      this.ice = void 0;
      this.imageCache = new Map();
      this.ice = ice;
    }

    setImage(url) {
      let image = this.imageCache.get(url);

      if (!image) {
        image = new Image();

        image.onload = () => {
          this.ice.dirty = true;
        };

        image.onerror = () => {
          console.error('ImageCache: 图片加载失败：', url);
        };

        image.src = url;

        if (this.imageCache.size > ImageCache.CACHE_SIZE) {
          this.imageCache.delete(this.imageCache.keys().next().value);
        }

        this.imageCache.set(url, image);
      }

      return {
        loaded: this.loaded(image),
        image
      };
    }

    loaded(image) {
      return image.complete && image.naturalWidth > 0;
    }

  }
  ImageCache.CACHE_SIZE = 100;

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  /**
   * @class ICE
   *
   * ICE: Interactive Canvas Engine ， 交互式 canvas 渲染引擎。
   *
   * - ICE 是整个引擎的主入口类。
   * - 同一个 &lt;canvas&gt; 标签上只能初始化一个 ICE 实例。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICE {
    //根节点
    //工具组件，如变换工具，这些组件不会被序列化，并且在整个生命周期中不会被删除。
    //事件总线，每一个 ICE 实例上只能有一个 evtBus 实例
    //在浏览器里面是 window 对象，在 NodeJS 环境里面是 global 对象
    // canvas 标签元素
    //CanvasRenderingContext2D, @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
    //当前选中的组件列表，支持 Ctrl 键同时选中多个组件。
    //如果此标志位为 true ，所有组件都会全部被重新绘制
    constructor() {
      this.childNodes = [];
      this.toolNodes = [];
      this.evtBus = void 0;
      this.root = void 0;
      this.canvasEl = void 0;
      this.ctx = void 0;
      this.canvasWidth = 0;
      this.canvasHeight = 0;
      this.canvasBoundingClientRect = void 0;
      this.selectionList = [];
      this.renderer = void 0;
      this.animationManager = void 0;
      this.eventBridge = void 0;
      this.ddManager = void 0;
      this.controlPanelManager = void 0;
      this.linkSlotManager = void 0;
      this.serializer = void 0;
      this.deserializer = void 0;
      this.imageCache = void 0;
      this.__dirty = true;
      this._lastUpdateTime = Date.now();
    }
    /**
     * @param ctx DOM id or CanvasContext
     */


    init(ctx) {
      if (!ctx) {
        throw new Error('ICE.init() failed...');
      }

      if (this.ctx === ctx) {
        //FIXME:
        throw new Error('同一个 canvas 实例只能 init 一次...');
      }

      this.root = root$2; //FIXME:防止 init 方法被调用多次

      if (isString_1(ctx)) {
        this.canvasEl = this.root.document.getElementById(ctx); //禁用 canvas 元素上的原生右键菜单

        this.canvasEl.oncontextmenu = function (e) {
          e.preventDefault();
          e.stopPropagation();
        };

        this.canvasWidth = this.canvasEl.width;
        this.canvasHeight = this.canvasEl.height;
        this.canvasBoundingClientRect = this.canvasEl.getBoundingClientRect();
        this.ctx = this.canvasEl.getContext('2d');
      } else {
        this.ctx = ctx;
      } //启动当前 ICE 实例上的所有 Manager


      this.evtBus = new EventBus(); //后续所有 Manager 都依赖事件总线，所以 this.evtBus 需要最先初始化。

      FrameManager.regitserEvtBus(this.evtBus);
      FrameManager.start();
      MouseEventInterceptor.regitserEvtBus(this.evtBus);
      MouseEventInterceptor.start();
      this.eventBridge = new DOMEventBridge(this).start();
      this.animationManager = new AnimationManager(this).start();
      this.ddManager = new DDManager(this).start();
      this.controlPanelManager = new ICEControlPanelManager(this).start();
      this.renderer = new CanvasRenderer(this).start();
      this.linkSlotManager = new ICELinkSlotManager(this).start(); //linkSlotManager 内部会监听 renderer 上的事件，所以 linkSlotManager 需要在 renderer 后面实例化。

      this.serializer = new Serializer(this);
      this.deserializer = new Deserializer(this);
      this.imageCache = new ImageCache(this);
      return this;
    }
    /**
     * @method addChild
     * 添加交互工具组件。
     * 工具组件不触发事件，不产生动画效果。
     * @param {ICEComponent} tool
     */


    addTool(tool) {
      if (this.childNodes.indexOf(tool) !== -1) return;
      this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD, null, {
        component: tool
      });
      tool.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD);
      tool.ice = this;
      tool.root = this.root;
      tool.ctx = this.ctx;
      tool.evtBus = this.evtBus;
      this.toolNodes.push(tool);
      this.dirty = true;
      this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD, null, {
        component: tool
      });
      tool.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD);
    }
    /**
     * @methos removeTool
     * 删除交互工具组件。
     * 工具组件不触发事件，不产生动画效果。
     * @param tool
     */


    removeTool(tool) {
      this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, null, {
        component: tool
      });
      tool.destory();
      this.toolNodes.splice(this.toolNodes.indexOf(tool), 1);
      this.dirty = true;
    }
    /**
     *
     * 调用 ICE.addChild() 方法，会直接把对象画在 canvas 上。
     * 如果需要在容器中画组件，参见 @see ICEGroup.addChild() 方法
     *
     * @param component
     */


    addChild(component) {
      let markDirty = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
      if (this.childNodes.indexOf(component) !== -1) return;
      this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD, null, {
        component: component
      });
      component.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_ADD);
      component.ice = this;
      component.root = this.root;
      component.ctx = this.ctx;
      component.evtBus = this.evtBus;
      component.parentNode = null;
      this.childNodes.push(component);

      if (Object.keys(component.props.animations).length) {
        this.animationManager.add(component);
      }

      this.dirty = markDirty;
      this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD, null, {
        component: component
      });
      component.trigger(ICE_EVENT_NAME_CONSTS.AFTER_ADD);
    }

    addChildren(arr) {
      for (let i = 0; i < arr.length; i++) {
        this.addChild(arr[i], false);
      }

      this.dirty = true;
    }

    removeChild(component) {
      let markDirty = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : true;
      this.evtBus.trigger(ICE_EVENT_NAME_CONSTS.BEFORE_REMOVE, null, {
        component: component
      });
      component.destory();
      this.childNodes.splice(this.childNodes.indexOf(component), 1);
      this.dirty = markDirty;
    }

    removeChildren(arr) {
      for (let i = 0; i < arr.length; i++) {
        this.removeChild(arr[i], false);
      }

      this.dirty = true;
    }

    clearAll() {
      this.removeChildren([...this.childNodes]);
    }

    findComponent(id) {
      return this.childNodes.filter(item => item.props.id === id)[0];
    }

    set dirty(flag) {
      this.__dirty = flag;
    }

    get dirty() {
      return this.__dirty;
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      return this.serializer.toJSON();
    } //FIXME:从 JSON 数据反序列化需要的处理时间可能会比较长，需要防止 fromJSON() 方法被高频调用导致的问题。


    fromJSON(jsonStr) {
      let startTime = Date.now(); //先停止关键的管理器

      FrameManager.stop();
      this.renderer.stop();
      this.eventBridge.stopped = true;
      this.animationManager.stop();
      this.ddManager.stop();
      this.controlPanelManager.stop();
      this.linkSlotManager.stop();
      this.clearAll(); //反序列化，创建组件实例

      this.deserializer.fromJSON(jsonStr); //重新启动关键管理器

      FrameManager.start();
      this.renderer.start();
      this.animationManager.start();
      this.ddManager.start();
      this.controlPanelManager.start();
      this.linkSlotManager.start();
      setTimeout(() => {
        this.eventBridge.stopped = false;
      }, 300);
      let endTime = Date.now();
      console.log(`fromJSON> ${endTime - startTime} ms`);
    }

  }

  // import ICEGroup from '../src/graphic/container/ICEGroup';

  let ice = new ICE().init('canvas-1');

  document.querySelector('#btn-1').addEventListener('click', (evt) => {
    const jsonStr = ice.toJSON();
    window.localStorage.setItem('json-data', jsonStr);
  });
  document.querySelector('#btn-2').addEventListener('click', (evt) => {
    const jsonStr = window.localStorage.getItem('json-data');
    ice.fromJSON(jsonStr);
  });
  document.querySelector('#btn-3').addEventListener('click', (evt) => {
    console.log('ice.clearAll()');
    ice.clearAll();
  });

  for (let i = 0; i < 1000; i++) {
    let img = new ICEImage({
      left: 1024 * Math.random(),
      top: 768 * Math.random(),
      src: './ice-render.png',
    });
    ice.addChild(img);
  }

  // let heart = new ICEHeart();
  // ice.addChild(heart);
  // let rose = new ICERose({
  //   left: 10,
  //   top: 10,
  //   width: 100,
  //   height: 100,
  //   style: {
  //     strokeStyle: '#0c09d4',
  //     fillStyle: '#f5d106',
  //     lineWidth: 5,
  //   },
  // });
  // ice.addChild(rose);

  let baseRect1 = new ICERect({
    left: 100,
    top: 100,
    width: 100,
    height: 100,
    style: {
      strokeStyle: '#0c09d4',
      fillStyle: '#f5d106',
      lineWidth: 5,
    },
    // animations: {
    //   left: { from: 0, to: 500, duration: 1000, easing: 'easeInQuad' },
    //   top: { from: 0, to: 200, duration: 3000 },
    //   width: { from: 100, to: 200, duration: 5000 },
    //   height: { from: 100, to: 200, duration: 5000 },
    // },
    transform: {
      // translate: [10, 10],
      // rotate: 30,
      skew: [10, 0],
      // scale: [1, 1],
    },
  });
  baseRect1.on('click', (evt) => {
    console.log('baseRect1');
  });
  ice.addChild(baseRect1);

  let rect1 = new ICERect({
    left: 500,
    top: 100,
    width: 100,
    height: 100,
    style: {
      strokeStyle: '#0c09d4',
      fillStyle: '#f5d106',
      lineWidth: 1,
    },
    transform: {
      rotate: 45,
      scale: [1, 1],
    },
    // animations: {
    //   left: { from: 0, to: 100, duration: 2000, easing: 'easeOutQuart' },
    //   // top: { from: 0, to: 200, duration: 3000 },
    //   width: { from: 100, to: 200, duration: 5000 },
    //   height: { from: 100, to: 200, duration: 5000 },
    // },
  });
  ice.addChild(rect1);

  let visioLink = new ICEVisioLink({
    left: 0,
    top: 0,
    startPoint: [500, 500],
    endPoint: [600, 600],
    style: {
      strokeStyle: '#08ee00',
      fillStyle: '#008000',
      lineWidth: 5,
    },
  });
  ice.addChild(visioLink);

  let visioLink2 = new ICEVisioLink({
    left: 0,
    top: 0,
    startPoint: [300, 300],
    endPoint: [400, 400],
    style: {
      strokeStyle: '#08ee00',
      fillStyle: '#008000',
      lineWidth: 5,
    },
  });
  ice.addChild(visioLink2);

  for (let i = 0; i < 1; i++) {
    let rect = new ICERect({
      left: Math.random() * 1024,
      top: Math.random() * 768,
      width: 50,
      height: 50,
      // fill: false,
      // stroke: false,
      style: {
        strokeStyle: '#0c09d4',
        fillStyle: '#f5d106',
        lineWidth: 1,
      },
      transform: {
        rotate: Math.random() * 360,
      },
    });
    ice.addChild(rect);
  }

  // let polyLine = new ICEPolyLine({
  //   left: 0,
  //   top: 0,
  //   points: [
  //     [300, 300],
  //     [100, 100],
  //   ],
  //   style: {
  //     strokeStyle: '#7803e6',
  //     fillStyle: '#008000',
  //     lineWidth: 10,
  //   },
  //   transform: {
  //     // translate: [10, -10],
  //     // scale: [1, 1],
  //     // rotate: 20,
  //   },
  // });
  // ice.addChild(polyLine);

  // let polyLine2 = new ICEPolyLine({
  //   left: 0,
  //   top: 0,
  //   points: [
  //     [500, 600],
  //     [750, 400],
  //     [250, 100],
  //   ],
  //   style: {
  //     strokeStyle: '#7803e6',
  //     fillStyle: '#008000',
  //     lineWidth: 10,
  //   },
  // });
  // ice.addChild(polyLine2);

  // let linkCircle3 = new ICECircle({
  //   left: 100,
  //   top: 500,
  //   radius: 50,
  // });
  // ice.addChild(linkCircle3);

  // // // //正三角形
  // let isogon3 = new ICEIsogon({
  //   left: 600,
  //   top: 300,
  //   radius: 50,
  //   edges: 3,
  //   transform: {
  //     // translate: [10, -10],
  //     // scale: [1.5, 1.5],
  //     // skew: [50, 0],
  //     // rotate: 45,
  //   },
  // });
  // ice.addChild(isogon3);

  // // //正五边形
  // let isogon5 = new ICEIsogon({
  //   left: 500,
  //   top: 400,
  //   radius: 50,
  //   edges: 5,
  // });
  // ice.addChild(isogon5);

  // // //正6边形
  // let isogon6 = new ICEIsogon({
  //   left: 650,
  //   top: 400,
  //   radius: 50,
  //   edges: 6,
  // });
  // ice.addChild(isogon6);

  // // 正十五边形
  // let isogon15 = new ICEIsogon({
  //   left: 20,
  //   top: 20,
  //   radius: 50,
  //   edges: 15,
  //   style: {
  //     strokeStyle: '#8a2be2',
  //     fillStyle: '#008000',
  //     lineWidth: 10,
  //   },
  // });
  // ice.addChild(isogon15);

  // //正N边形
  // let star1 = new ICEStar({
  //   left: 10,
  //   top: 10,
  //   radius: 50,
  //   edges: 5,
  //   // transform: {
  //   //   translate: [10, -10],
  //   //   scale: [0.3, 0.5],
  //   //   skew: [0.2, 0],
  //   //   rotate: 30,
  //   // },
  // });
  // star1.on('click', (evt) => {});
  // ice.addChild(star1);

  let text = new ICEText({
    left: 0,
    top: 400,
    text: 'Test long long long text...',
    style: {
      strokeStyle: '#ff3300',
      fillStyle: '#00ff00',
      fontSize: 64,
      // lineWidth: 5,
    },
    // stroke: false,
    // fill: false,
  });
  ice.addChild(text);

  // let g = new ICEGroup({
  //   left: 100,
  //   top: 100,
  //   width: 300,
  //   height: 200,
  //   style: {
  //     strokeStyle: '#fa0404',
  //     fillStyle: '#beffff',
  //     lineWidth: 1,
  //   },
  //   transform: {
  //     // translate: [10, -10],
  //     scale: [1.5, 1.5],
  //     // skew: [50, 0],
  //     rotate: 45,
  //   },
  // });
  // ice.addChild(g);
  // g.setState({
  //   transform: {
  //     scale: [1.3, 1.3],
  //   },
  // });

  // let group1 = new ICEGroup({
  //   left: 10,
  //   top: 10,
  //   width: 200,
  //   height: 100,
  //   style: {
  //     strokeStyle: '#fa0404',
  //     fillStyle: '#37dd0d',
  //     lineWidth: 1,
  //   },
  //   transform: {
  //     // translate: [10, -10],
  //     // scale: [1, 1],
  //     rotate: 0,
  //   },
  // });
  // g.addChild(group1);

  // let group2 = new ICEGroup({
  //   left: 10,
  //   top: 10,
  //   width: 100,
  //   height: 50,
  //   style: {
  //     strokeStyle: '#fa0404',
  //     fillStyle: '#08b2dd',
  //     lineWidth: 1,
  //   },
  //   transform: {
  //     // translate: [10, -10],
  //     // scale: [1, 1],
  //     rotate: 10,
  //   },
  // });
  // group1.addChild(group2);

  // group2.addChild(
  //   new ICECircle({
  //     left: 20,
  //     top: 10,
  //     radius: 10,
  //     transform: {
  //       rotate: 45,
  //     },
  //   })
  // );

  // group2.addChild(
  //   new ICERect({
  //     left: 60,
  //     top: 10,
  //     width: 30,
  //     height: 20,
  //     transform: {
  //       rotate: 0,
  //     },
  //   })
  // );

  // let ellipse = new ICEEllipse({
  //   left: 100,
  //   top: 600,
  //   radiusX: 50,
  //   radiusY: 30,
  // });
  // ice.addChild(ellipse);

}));
