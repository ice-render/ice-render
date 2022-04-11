(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
})((function () { 'use strict';

  function ownKeys(object, enumerableOnly) {
    var keys = Object.keys(object);

    if (Object.getOwnPropertySymbols) {
      var symbols = Object.getOwnPropertySymbols(object);
      enumerableOnly && (symbols = symbols.filter(function (sym) {
        return Object.getOwnPropertyDescriptor(object, sym).enumerable;
      })), keys.push.apply(keys, symbols);
    }

    return keys;
  }

  function _objectSpread2(target) {
    for (var i = 1; i < arguments.length; i++) {
      var source = null != arguments[i] ? arguments[i] : {};
      i % 2 ? ownKeys(Object(source), !0).forEach(function (key) {
        _defineProperty$1(target, key, source[key]);
      }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)) : ownKeys(Object(source)).forEach(function (key) {
        Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key));
      });
    }

    return target;
  }

  function _classCallCheck(instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  }

  function _defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  function _createClass(Constructor, protoProps, staticProps) {
    if (protoProps) _defineProperties(Constructor.prototype, protoProps);
    if (staticProps) _defineProperties(Constructor, staticProps);
    Object.defineProperty(Constructor, "prototype", {
      writable: false
    });
    return Constructor;
  }

  function _defineProperty$1(obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
  }

  function _inherits(subClass, superClass) {
    if (typeof superClass !== "function" && superClass !== null) {
      throw new TypeError("Super expression must either be null or a function");
    }

    subClass.prototype = Object.create(superClass && superClass.prototype, {
      constructor: {
        value: subClass,
        writable: true,
        configurable: true
      }
    });
    Object.defineProperty(subClass, "prototype", {
      writable: false
    });
    if (superClass) _setPrototypeOf(subClass, superClass);
  }

  function _getPrototypeOf(o) {
    _getPrototypeOf = Object.setPrototypeOf ? Object.getPrototypeOf : function _getPrototypeOf(o) {
      return o.__proto__ || Object.getPrototypeOf(o);
    };
    return _getPrototypeOf(o);
  }

  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };

    return _setPrototypeOf(o, p);
  }

  function _isNativeReflectConstruct() {
    if (typeof Reflect === "undefined" || !Reflect.construct) return false;
    if (Reflect.construct.sham) return false;
    if (typeof Proxy === "function") return true;

    try {
      Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], function () {}));
      return true;
    } catch (e) {
      return false;
    }
  }

  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return self;
  }

  function _possibleConstructorReturn(self, call) {
    if (call && (typeof call === "object" || typeof call === "function")) {
      return call;
    } else if (call !== void 0) {
      throw new TypeError("Derived constructors may only return object or undefined");
    }

    return _assertThisInitialized(self);
  }

  function _createSuper(Derived) {
    var hasNativeReflectConstruct = _isNativeReflectConstruct();

    return function _createSuperInternal() {
      var Super = _getPrototypeOf(Derived),
          result;

      if (hasNativeReflectConstruct) {
        var NewTarget = _getPrototypeOf(this).constructor;

        result = Reflect.construct(Super, arguments, NewTarget);
      } else {
        result = Super.apply(this, arguments);
      }

      return _possibleConstructorReturn(this, result);
    };
  }

  function _superPropBase(object, property) {
    while (!Object.prototype.hasOwnProperty.call(object, property)) {
      object = _getPrototypeOf(object);
      if (object === null) break;
    }

    return object;
  }

  function _get() {
    if (typeof Reflect !== "undefined" && Reflect.get) {
      _get = Reflect.get;
    } else {
      _get = function _get(target, property, receiver) {
        var base = _superPropBase(target, property);

        if (!base) return;
        var desc = Object.getOwnPropertyDescriptor(base, property);

        if (desc.get) {
          return desc.get.call(arguments.length < 3 ? target : receiver);
        }

        return desc.value;
      };
    }

    return _get.apply(this, arguments);
  }

  function _slicedToArray(arr, i) {
    return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest();
  }

  function _toConsumableArray(arr) {
    return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _unsupportedIterableToArray(arr) || _nonIterableSpread();
  }

  function _arrayWithoutHoles(arr) {
    if (Array.isArray(arr)) return _arrayLikeToArray(arr);
  }

  function _arrayWithHoles(arr) {
    if (Array.isArray(arr)) return arr;
  }

  function _iterableToArray(iter) {
    if (typeof Symbol !== "undefined" && iter[Symbol.iterator] != null || iter["@@iterator"] != null) return Array.from(iter);
  }

  function _iterableToArrayLimit(arr, i) {
    var _i = arr == null ? null : typeof Symbol !== "undefined" && arr[Symbol.iterator] || arr["@@iterator"];

    if (_i == null) return;
    var _arr = [];
    var _n = true;
    var _d = false;

    var _s, _e;

    try {
      for (_i = _i.call(arr); !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"] != null) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  function _unsupportedIterableToArray(o, minLen) {
    if (!o) return;
    if (typeof o === "string") return _arrayLikeToArray(o, minLen);
    var n = Object.prototype.toString.call(o).slice(8, -1);
    if (n === "Object" && o.constructor) n = o.constructor.name;
    if (n === "Map" || n === "Set") return Array.from(o);
    if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen);
  }

  function _arrayLikeToArray(arr, len) {
    if (len == null || len > arr.length) len = arr.length;

    for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i];

    return arr2;
  }

  function _nonIterableSpread() {
    throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

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

  var isArray$6 = Array.isArray;

  var isArray_1 = isArray$6;

  /** Detect free variable `global` from Node.js. */

  var freeGlobal$1 = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

  var _freeGlobal = freeGlobal$1;

  var freeGlobal = _freeGlobal;

  /** Detect free variable `self`. */
  var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

  /** Used as a reference to the global object. */
  var root$7 = freeGlobal || freeSelf || Function('return this')();

  var _root = root$7;

  var root$6 = _root;

  /** Built-in value references. */
  var Symbol$4 = root$6.Symbol;

  var _Symbol = Symbol$4;

  var Symbol$3 = _Symbol;

  /** Used for built-in method references. */
  var objectProto$a = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$8 = objectProto$a.hasOwnProperty;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var nativeObjectToString$1 = objectProto$a.toString;

  /** Built-in value references. */
  var symToStringTag$1 = Symbol$3 ? Symbol$3.toStringTag : undefined;

  /**
   * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the raw `toStringTag`.
   */
  function getRawTag$1(value) {
    var isOwn = hasOwnProperty$8.call(value, symToStringTag$1),
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

  var objectProto$9 = Object.prototype;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var nativeObjectToString = objectProto$9.toString;

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

  var Symbol$2 = _Symbol,
      getRawTag = _getRawTag,
      objectToString = _objectToString;

  /** `Object#toString` result references. */
  var nullTag = '[object Null]',
      undefinedTag = '[object Undefined]';

  /** Built-in value references. */
  var symToStringTag = Symbol$2 ? Symbol$2.toStringTag : undefined;

  /**
   * The base implementation of `getTag` without fallbacks for buggy environments.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the `toStringTag`.
   */
  function baseGetTag$6(value) {
    if (value == null) {
      return value === undefined ? undefinedTag : nullTag;
    }
    return (symToStringTag && symToStringTag in Object(value))
      ? getRawTag(value)
      : objectToString(value);
  }

  var _baseGetTag = baseGetTag$6;

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
  function isSymbol$4(value) {
    return typeof value == 'symbol' ||
      (isObjectLike$6(value) && baseGetTag$5(value) == symbolTag);
  }

  var isSymbol_1 = isSymbol$4;

  var isArray$5 = isArray_1,
      isSymbol$3 = isSymbol_1;

  /** Used to match property names within property paths. */
  var reIsDeepProp = /\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,
      reIsPlainProp = /^\w*$/;

  /**
   * Checks if `value` is a property name and not a property path.
   *
   * @private
   * @param {*} value The value to check.
   * @param {Object} [object] The object to query keys on.
   * @returns {boolean} Returns `true` if `value` is a property name, else `false`.
   */
  function isKey$1(value, object) {
    if (isArray$5(value)) {
      return false;
    }
    var type = typeof value;
    if (type == 'number' || type == 'symbol' || type == 'boolean' ||
        value == null || isSymbol$3(value)) {
      return true;
    }
    return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
      (object != null && value in Object(object));
  }

  var _isKey = isKey$1;

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

  var baseGetTag$4 = _baseGetTag,
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
    var tag = baseGetTag$4(value);
    return tag == funcTag$1 || tag == genTag || tag == asyncTag || tag == proxyTag;
  }

  var isFunction_1 = isFunction$3;

  var root$5 = _root;

  /** Used to detect overreaching core-js shims. */
  var coreJsData$1 = root$5['__core-js_shared__'];

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
  function toSource$1(func) {
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

  var _toSource = toSource$1;

  var isFunction$2 = isFunction_1,
      isMasked = _isMasked,
      isObject$6 = isObject_1,
      toSource = _toSource;

  /**
   * Used to match `RegExp`
   * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
   */
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

  /** Used to detect host constructors (Safari). */
  var reIsHostCtor = /^\[object .+?Constructor\]$/;

  /** Used for built-in method references. */
  var funcProto$1 = Function.prototype,
      objectProto$8 = Object.prototype;

  /** Used to resolve the decompiled source of functions. */
  var funcToString$1 = funcProto$1.toString;

  /** Used to check objects for own properties. */
  var hasOwnProperty$7 = objectProto$8.hasOwnProperty;

  /** Used to detect if a method is native. */
  var reIsNative = RegExp('^' +
    funcToString$1.call(hasOwnProperty$7).replace(reRegExpChar, '\\$&')
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
    return pattern.test(toSource(value));
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
  function getNative$3(object, key) {
    var value = getValue(object, key);
    return baseIsNative(value) ? value : undefined;
  }

  var _getNative = getNative$3;

  var getNative$2 = _getNative;

  /* Built-in method references that are verified to be native. */
  var nativeCreate$4 = getNative$2(Object, 'create');

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
  var objectProto$7 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$6 = objectProto$7.hasOwnProperty;

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
    return hasOwnProperty$6.call(data, key) ? data[key] : undefined;
  }

  var _hashGet = hashGet$1;

  var nativeCreate$1 = _nativeCreate;

  /** Used for built-in method references. */
  var objectProto$6 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$5 = objectProto$6.hasOwnProperty;

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
    return nativeCreate$1 ? (data[key] !== undefined) : hasOwnProperty$5.call(data, key);
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

  var getNative$1 = _getNative,
      root$4 = _root;

  /* Built-in method references that are verified to be native. */
  var Map$3 = getNative$1(root$4, 'Map');

  var _Map = Map$3;

  var Hash = _Hash,
      ListCache$3 = _ListCache,
      Map$2 = _Map;

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
      'map': new (Map$2 || ListCache$3),
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
  function MapCache$2(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  // Add methods to `MapCache`.
  MapCache$2.prototype.clear = mapCacheClear;
  MapCache$2.prototype['delete'] = mapCacheDelete;
  MapCache$2.prototype.get = mapCacheGet;
  MapCache$2.prototype.has = mapCacheHas;
  MapCache$2.prototype.set = mapCacheSet;

  var _MapCache = MapCache$2;

  var MapCache$1 = _MapCache;

  /** Error message constants. */
  var FUNC_ERROR_TEXT = 'Expected a function';

  /**
   * Creates a function that memoizes the result of `func`. If `resolver` is
   * provided, it determines the cache key for storing the result based on the
   * arguments provided to the memoized function. By default, the first argument
   * provided to the memoized function is used as the map cache key. The `func`
   * is invoked with the `this` binding of the memoized function.
   *
   * **Note:** The cache is exposed as the `cache` property on the memoized
   * function. Its creation may be customized by replacing the `_.memoize.Cache`
   * constructor with one whose instances implement the
   * [`Map`](http://ecma-international.org/ecma-262/7.0/#sec-properties-of-the-map-prototype-object)
   * method interface of `clear`, `delete`, `get`, `has`, and `set`.
   *
   * @static
   * @memberOf _
   * @since 0.1.0
   * @category Function
   * @param {Function} func The function to have its output memoized.
   * @param {Function} [resolver] The function to resolve the cache key.
   * @returns {Function} Returns the new memoized function.
   * @example
   *
   * var object = { 'a': 1, 'b': 2 };
   * var other = { 'c': 3, 'd': 4 };
   *
   * var values = _.memoize(_.values);
   * values(object);
   * // => [1, 2]
   *
   * values(other);
   * // => [3, 4]
   *
   * object.a = 2;
   * values(object);
   * // => [1, 2]
   *
   * // Modify the result cache.
   * values.cache.set(object, ['a', 'b']);
   * values(object);
   * // => ['a', 'b']
   *
   * // Replace `_.memoize.Cache`.
   * _.memoize.Cache = WeakMap;
   */
  function memoize$1(func, resolver) {
    if (typeof func != 'function' || (resolver != null && typeof resolver != 'function')) {
      throw new TypeError(FUNC_ERROR_TEXT);
    }
    var memoized = function() {
      var args = arguments,
          key = resolver ? resolver.apply(this, args) : args[0],
          cache = memoized.cache;

      if (cache.has(key)) {
        return cache.get(key);
      }
      var result = func.apply(this, args);
      memoized.cache = cache.set(key, result) || cache;
      return result;
    };
    memoized.cache = new (memoize$1.Cache || MapCache$1);
    return memoized;
  }

  // Expose `MapCache`.
  memoize$1.Cache = MapCache$1;

  var memoize_1 = memoize$1;

  var memoize = memoize_1;

  /** Used as the maximum memoize cache size. */
  var MAX_MEMOIZE_SIZE = 500;

  /**
   * A specialized version of `_.memoize` which clears the memoized function's
   * cache when it exceeds `MAX_MEMOIZE_SIZE`.
   *
   * @private
   * @param {Function} func The function to have its output memoized.
   * @returns {Function} Returns the new memoized function.
   */
  function memoizeCapped$1(func) {
    var result = memoize(func, function(key) {
      if (cache.size === MAX_MEMOIZE_SIZE) {
        cache.clear();
      }
      return key;
    });

    var cache = result.cache;
    return result;
  }

  var _memoizeCapped = memoizeCapped$1;

  var memoizeCapped = _memoizeCapped;

  /** Used to match property names within property paths. */
  var rePropName = /[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g;

  /** Used to match backslashes in property paths. */
  var reEscapeChar = /\\(\\)?/g;

  /**
   * Converts `string` to a property path array.
   *
   * @private
   * @param {string} string The string to convert.
   * @returns {Array} Returns the property path array.
   */
  var stringToPath$1 = memoizeCapped(function(string) {
    var result = [];
    if (string.charCodeAt(0) === 46 /* . */) {
      result.push('');
    }
    string.replace(rePropName, function(match, number, quote, subString) {
      result.push(quote ? subString.replace(reEscapeChar, '$1') : (number || match));
    });
    return result;
  });

  var _stringToPath = stringToPath$1;

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

  var Symbol$1 = _Symbol,
      arrayMap = _arrayMap,
      isArray$4 = isArray_1,
      isSymbol$2 = isSymbol_1;

  /** Used as references for various `Number` constants. */
  var INFINITY$2 = 1 / 0;

  /** Used to convert symbols to primitives and strings. */
  var symbolProto = Symbol$1 ? Symbol$1.prototype : undefined,
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
    if (isArray$4(value)) {
      // Recursively convert values (susceptible to call stack limits).
      return arrayMap(value, baseToString$1) + '';
    }
    if (isSymbol$2(value)) {
      return symbolToString ? symbolToString.call(value) : '';
    }
    var result = (value + '');
    return (result == '0' && (1 / value) == -INFINITY$2) ? '-0' : result;
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
  function toString$2(value) {
    return value == null ? '' : baseToString(value);
  }

  var toString_1 = toString$2;

  var isArray$3 = isArray_1,
      isKey = _isKey,
      stringToPath = _stringToPath,
      toString$1 = toString_1;

  /**
   * Casts `value` to a path array if it's not one.
   *
   * @private
   * @param {*} value The value to inspect.
   * @param {Object} [object] The object to query keys on.
   * @returns {Array} Returns the cast property path array.
   */
  function castPath$1(value, object) {
    if (isArray$3(value)) {
      return value;
    }
    return isKey(value, object) ? [value] : stringToPath(toString$1(value));
  }

  var _castPath = castPath$1;

  var isSymbol$1 = isSymbol_1;

  /** Used as references for various `Number` constants. */
  var INFINITY$1 = 1 / 0;

  /**
   * Converts `value` to a string key if it's not a string or symbol.
   *
   * @private
   * @param {*} value The value to inspect.
   * @returns {string|symbol} Returns the key.
   */
  function toKey$1(value) {
    if (typeof value == 'string' || isSymbol$1(value)) {
      return value;
    }
    var result = (value + '');
    return (result == '0' && (1 / value) == -INFINITY$1) ? '-0' : result;
  }

  var _toKey = toKey$1;

  var castPath = _castPath,
      toKey = _toKey;

  /**
   * The base implementation of `_.get` without support for default values.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {Array|string} path The path of the property to get.
   * @returns {*} Returns the resolved value.
   */
  function baseGet$1(object, path) {
    path = castPath(path, object);

    var index = 0,
        length = path.length;

    while (object != null && index < length) {
      object = object[toKey(path[index++])];
    }
    return (index && index == length) ? object : undefined;
  }

  var _baseGet = baseGet$1;

  var baseGet = _baseGet;

  /**
   * Gets the value at `path` of `object`. If the resolved value is
   * `undefined`, the `defaultValue` is returned in its place.
   *
   * @static
   * @memberOf _
   * @since 3.7.0
   * @category Object
   * @param {Object} object The object to query.
   * @param {Array|string} path The path of the property to get.
   * @param {*} [defaultValue] The value returned for `undefined` resolved values.
   * @returns {*} Returns the resolved value.
   * @example
   *
   * var object = { 'a': [{ 'b': { 'c': 3 } }] };
   *
   * _.get(object, 'a[0].b.c');
   * // => 3
   *
   * _.get(object, ['a', '0', 'b', 'c']);
   * // => 3
   *
   * _.get(object, 'a.b.c', 'default');
   * // => 'default'
   */
  function get(object, path, defaultValue) {
    var result = object == null ? undefined : baseGet(object, path);
    return result === undefined ? defaultValue : result;
  }

  var get_1 = get;

  var ListCache$2 = _ListCache;

  /**
   * Removes all key-value entries from the stack.
   *
   * @private
   * @name clear
   * @memberOf Stack
   */
  function stackClear$1() {
    this.__data__ = new ListCache$2;
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

  var ListCache$1 = _ListCache,
      Map$1 = _Map,
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
      if (!Map$1 || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
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

  var getNative = _getNative;

  var defineProperty$2 = (function() {
    try {
      var func = getNative(Object, 'defineProperty');
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

  var root$3 = _root;

  /** Built-in value references. */
  var Uint8Array$1 = root$3.Uint8Array;

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

  function overArg$1(func, transform) {
    return function(arg) {
      return func(transform(arg));
    };
  }

  var _overArg = overArg$1;

  var overArg = _overArg;

  /** Built-in value references. */
  var getPrototype$2 = overArg(Object.getPrototypeOf, Object);

  var _getPrototype = getPrototype$2;

  /** Used for built-in method references. */

  var objectProto$5 = Object.prototype;

  /**
   * Checks if `value` is likely a prototype object.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
   */
  function isPrototype$2(value) {
    var Ctor = value && value.constructor,
        proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto$5;

    return value === proto;
  }

  var _isPrototype = isPrototype$2;

  var baseCreate = _baseCreate,
      getPrototype$1 = _getPrototype,
      isPrototype$1 = _isPrototype;

  /**
   * Initializes an object clone.
   *
   * @private
   * @param {Object} object The object to clone.
   * @returns {Object} Returns the initialized clone.
   */
  function initCloneObject$1(object) {
    return (typeof object.constructor == 'function' && !isPrototype$1(object))
      ? baseCreate(getPrototype$1(object))
      : {};
  }

  var _initCloneObject = initCloneObject$1;

  var baseGetTag$3 = _baseGetTag,
      isObjectLike$5 = isObjectLike_1;

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
    return isObjectLike$5(value) && baseGetTag$3(value) == argsTag$1;
  }

  var _baseIsArguments = baseIsArguments$1;

  var baseIsArguments = _baseIsArguments,
      isObjectLike$4 = isObjectLike_1;

  /** Used for built-in method references. */
  var objectProto$4 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$4 = objectProto$4.hasOwnProperty;

  /** Built-in value references. */
  var propertyIsEnumerable = objectProto$4.propertyIsEnumerable;

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
  var isArguments$2 = baseIsArguments(function() { return arguments; }()) ? baseIsArguments : function(value) {
    return isObjectLike$4(value) && hasOwnProperty$4.call(value, 'callee') &&
      !propertyIsEnumerable.call(value, 'callee');
  };

  var isArguments_1 = isArguments$2;

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
  function isArrayLike$3(value) {
    return value != null && isLength$1(value.length) && !isFunction$1(value);
  }

  var isArrayLike_1 = isArrayLike$3;

  var isArrayLike$2 = isArrayLike_1,
      isObjectLike$3 = isObjectLike_1;

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
    return isObjectLike$3(value) && isArrayLike$2(value);
  }

  var isArrayLikeObject_1 = isArrayLikeObject$1;

  var isBuffer$2 = {exports: {}};

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
  }(isBuffer$2, isBuffer$2.exports));

  var baseGetTag$2 = _baseGetTag,
      getPrototype = _getPrototype,
      isObjectLike$2 = isObjectLike_1;

  /** `Object#toString` result references. */
  var objectTag$1 = '[object Object]';

  /** Used for built-in method references. */
  var funcProto = Function.prototype,
      objectProto$3 = Object.prototype;

  /** Used to resolve the decompiled source of functions. */
  var funcToString = funcProto.toString;

  /** Used to check objects for own properties. */
  var hasOwnProperty$3 = objectProto$3.hasOwnProperty;

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
    if (!isObjectLike$2(value) || baseGetTag$2(value) != objectTag$1) {
      return false;
    }
    var proto = getPrototype(value);
    if (proto === null) {
      return true;
    }
    var Ctor = hasOwnProperty$3.call(proto, 'constructor') && proto.constructor;
    return typeof Ctor == 'function' && Ctor instanceof Ctor &&
      funcToString.call(Ctor) == objectCtorString;
  }

  var isPlainObject_1 = isPlainObject$1;

  var baseGetTag$1 = _baseGetTag,
      isLength = isLength_1,
      isObjectLike$1 = isObjectLike_1;

  /** `Object#toString` result references. */
  var argsTag = '[object Arguments]',
      arrayTag = '[object Array]',
      boolTag = '[object Boolean]',
      dateTag = '[object Date]',
      errorTag = '[object Error]',
      funcTag = '[object Function]',
      mapTag = '[object Map]',
      numberTag = '[object Number]',
      objectTag = '[object Object]',
      regexpTag = '[object RegExp]',
      setTag = '[object Set]',
      stringTag$1 = '[object String]',
      weakMapTag = '[object WeakMap]';

  var arrayBufferTag = '[object ArrayBuffer]',
      dataViewTag = '[object DataView]',
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
  typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
  typedArrayTags[errorTag] = typedArrayTags[funcTag] =
  typedArrayTags[mapTag] = typedArrayTags[numberTag] =
  typedArrayTags[objectTag] = typedArrayTags[regexpTag] =
  typedArrayTags[setTag] = typedArrayTags[stringTag$1] =
  typedArrayTags[weakMapTag] = false;

  /**
   * The base implementation of `_.isTypedArray` without Node.js optimizations.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
   */
  function baseIsTypedArray$1(value) {
    return isObjectLike$1(value) &&
      isLength(value.length) && !!typedArrayTags[baseGetTag$1(value)];
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
  var isTypedArray$2 = nodeIsTypedArray ? baseUnary(nodeIsTypedArray) : baseIsTypedArray;

  var isTypedArray_1 = isTypedArray$2;

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
  var objectProto$2 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$2 = objectProto$2.hasOwnProperty;

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
    if (!(hasOwnProperty$2.call(object, key) && eq$1(objValue, value)) ||
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
      isArguments$1 = isArguments_1,
      isArray$2 = isArray_1,
      isBuffer$1 = isBuffer$2.exports,
      isIndex$1 = _isIndex,
      isTypedArray$1 = isTypedArray_1;

  /** Used for built-in method references. */
  var objectProto$1 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$1 = objectProto$1.hasOwnProperty;

  /**
   * Creates an array of the enumerable property names of the array-like `value`.
   *
   * @private
   * @param {*} value The value to query.
   * @param {boolean} inherited Specify returning inherited property names.
   * @returns {Array} Returns the array of property names.
   */
  function arrayLikeKeys$1(value, inherited) {
    var isArr = isArray$2(value),
        isArg = !isArr && isArguments$1(value),
        isBuff = !isArr && !isArg && isBuffer$1(value),
        isType = !isArr && !isArg && !isBuff && isTypedArray$1(value),
        skipIndexes = isArr || isArg || isBuff || isType,
        result = skipIndexes ? baseTimes(value.length, String) : [],
        length = result.length;

    for (var key in value) {
      if ((inherited || hasOwnProperty$1.call(value, key)) &&
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
      isPrototype = _isPrototype,
      nativeKeysIn = _nativeKeysIn;

  /** Used for built-in method references. */
  var objectProto = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty = objectProto.hasOwnProperty;

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
    var isProto = isPrototype(object),
        result = [];

    for (var key in object) {
      if (!(key == 'constructor' && (isProto || !hasOwnProperty.call(object, key)))) {
        result.push(key);
      }
    }
    return result;
  }

  var _baseKeysIn = baseKeysIn$1;

  var arrayLikeKeys = _arrayLikeKeys,
      baseKeysIn = _baseKeysIn,
      isArrayLike$1 = isArrayLike_1;

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
    return isArrayLike$1(object) ? arrayLikeKeys(object, true) : baseKeysIn(object);
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
      isArguments = isArguments_1,
      isArray$1 = isArray_1,
      isArrayLikeObject = isArrayLikeObject_1,
      isBuffer = isBuffer$2.exports,
      isFunction = isFunction_1,
      isObject$3 = isObject_1,
      isPlainObject = isPlainObject_1,
      isTypedArray = isTypedArray_1,
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
      var isArr = isArray$1(srcValue),
          isBuff = !isArr && isBuffer(srcValue),
          isTyped = !isArr && !isBuff && isTypedArray(srcValue);

      newValue = srcValue;
      if (isArr || isBuff || isTyped) {
        if (isArray$1(objValue)) {
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
      else if (isPlainObject(srcValue) || isArguments(srcValue)) {
        newValue = objValue;
        if (isArguments(objValue)) {
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
      isArrayLike = isArrayLike_1,
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
          ? (isArrayLike(object) && isIndex(index, object.length))
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

  /**
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  var root$1 = null;

  (function () {
    root$1 = window || global || {};
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
   * @class ICEEvent
   * 在 ICE 中，所有事件都会被转化成 ICEEvent 进行处理。
   * ICEEvent 用来模拟 W3C 定义的 Event 接口，ICE 自定义的事件也使用此实现，事件对象上能获取到的属性不同。
   * 从原始 DOM 事件转发出来的 ICEEvent 实例包含 Event 接口上所定义的所有属性，ICE 内部代码创建的 ICEEvent 实例上只包含很少的自定义属性。
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Event
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  var ICEEvent = /*#__PURE__*/_createClass(function ICEEvent() {
    var evt = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    var data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    _classCallCheck(this, ICEEvent);

    _defineProperty$1(this, "originalEvent", void 0);

    _defineProperty$1(this, "target", void 0);

    //FIXME:事件对象的属性拷贝需要更加细致的控制
    for (var p in evt) {
      this[p] = evt[p];
    }

    for (var _p in data) {
      this[_p] = data[_p];
    }
  });

  /**
   * Canvas 内部的对象默认没有事件机制，模仿 W3C 定义的 EventTaregt 接口，为 Canvas 内部的组件添加事件机制。
   * 部分 API 名称模仿 jQuery ，方便使用者调用。
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
   * @see https://developer.mozilla.org/en-US/docs/Web/API/EventTarget
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var EventTarget = /*#__PURE__*/function () {
    function EventTarget() {
      _classCallCheck(this, EventTarget);

      _defineProperty$1(this, "listeners", {});

      _defineProperty$1(this, "suspendedEventNames", []);
    }

    _createClass(EventTarget, [{
      key: "on",
      value: function on(eventName, fn) {
        var scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : root$2;

        if (!this.listeners[eventName]) {
          this.listeners[eventName] = [];
        }

        this.off(eventName, fn, scope);
        this.listeners[eventName].push({
          callback: fn,
          scope: scope
        });
      }
    }, {
      key: "off",
      value: function off(eventName, fn) {
        var scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : root$2;
        var arr = this.listeners[eventName];
        if (!arr) return;

        for (var i = 0; i < arr.length; i++) {
          var item = arr[i];

          if (item.callback === fn && item.scope === scope) {
            this.listeners[eventName].splice(i, 1);
            return;
          }
        }
      }
      /**
       * FIXME:有 bug ，需要重新实现
       * 一次性回调，调用一次就自动删除。
       * @param eventName
       * @param fn
       */

    }, {
      key: "once",
      value: function once(eventName, fn) {
        var scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : root$2;

        function callback(evt) {
          this.off(eventName, callback, scope);
          fn.call(scope, evt);
        }

        this.on(eventName, callback, scope);
      }
    }, {
      key: "trigger",
      value: function trigger(eventName) {
        var originalEvent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
        if (!this.listeners[eventName]) return false;
        if (this.suspendedEventNames.includes(eventName)) return false; //DOM 事件和代码触发的事件都会被转换成 ICEEvent
        //FIXME:这里需要判断传递了 originalEvent 且类型为 ICEEvent 的情况。

        var iceEvent;

        if (originalEvent) {
          iceEvent = new ICEEvent(originalEvent);
          iceEvent.originalEvent = originalEvent;
        } else {
          iceEvent = new ICEEvent({
            type: eventName,
            timeStamp: new Date().getTime()
          });
        }

        this.listeners[eventName].forEach(function (item) {
          var fn = item.callback;
          var scope = item.scope;
          fn.call(scope, iceEvent);
        });
        return true;
      } //FIXME:加上 scope 控制

    }, {
      key: "suspend",
      value: function suspend(eventName, fn) {
        if (eventName && !this.suspendedEventNames.includes(eventName)) {
          this.suspendedEventNames.push(eventName);
        }

        if (fn) {
          fn.prototype.suspended = true;
        }
      } //FIXME:加上 scope 控制

    }, {
      key: "resume",
      value: function resume(eventName, fn) {
        if (eventName && this.suspendedEventNames.includes(eventName)) {
          this.suspendedEventNames.splice(this.suspendedEventNames.findIndex(eventName), 1);
        }

        if (fn) {
          fn.prototype.suspended = false;
        }
      }
    }, {
      key: "purgeEvents",
      value: function purgeEvents() {
        this.listeners = {};
        this.suspendedEventNames = [];
      }
    }]);

    return EventTarget;
  }(); //增加别名，模拟 W3C 的 EventTarget 接口


  EventTarget.prototype.addEventListener = EventTarget.prototype.on;
  EventTarget.prototype.removeEventListener = EventTarget.prototype.off;
  EventTarget.prototype.dispatchEvent = EventTarget.prototype.trigger;

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

  var baseTrim = _baseTrim,
      isObject = isObject_1,
      isSymbol = isSymbol_1;

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
    if (isSymbol(value)) {
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
  var INFINITY = 1 / 0,
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
    if (value === INFINITY || value === -INFINITY) {
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

  var GeoUtil = /*#__PURE__*/function () {
    function GeoUtil() {
      _classCallCheck(this, GeoUtil);

      throw new Error('GeoUtil is a static util class.');
    }
    /**
     * 判断一个坐标点是否包含在图元内部。
     * @param component
     * @param point
     * @returns
     */


    _createClass(GeoUtil, null, [{
      key: "containsPoint",
      value: function containsPoint(component, point) {
        return false;
      }
      /**
       * 判断两个图元是否相交。
       * @param a 第一个图元
       * @param b 第二个图元
       * @returns
       */

    }, {
      key: "isIntersect",
      value: function isIntersect(a, b) {
        return false;
      }
      /**
       * 已知两点坐标，求线段长度。
       * @param x1
       * @param y1
       * @param x2
       * @param y2
       */

    }, {
      key: "getLength",
      value: function getLength(x1, y1, x2, y2) {
        return Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
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

    }, {
      key: "calcRotateAngle",
      value: function calcRotateAngle(x, y, originX, originY) {
        var offsetX = x - originX;
        var offsetY = y - originY;
        var cos = offsetX / Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        var sin = offsetY / Math.sqrt(offsetX * offsetX + offsetY * offsetY); //Math.acos 的返回值处于 [0,PI] 之间，根据 sin 的正负号进行判断之后， rotateAngle 处于 [-180,180] 度之间
        //先加 360 度，保证 rotateAngle 为正值，再对 360 取模，最终让 rotateAngle 的返回值始终处于 [0,360] 度之间

        var sign = sin < 0 ? -1 : 1;
        var rotateAngle = sign * Math.acos(cos) * 180 / Math.PI + 360;
        rotateAngle = rotateAngle % 360;
        return rotateAngle;
      }
      /**
       * 2D 向量叉乘。
       *
       * 两个点需要处于同一个坐标系中。
       *
       * @param x1
       * @param y1
       * @param x2
       * @param y2
       * @returns
       */

    }, {
      key: "crossProduct",
      value: function crossProduct(x1, y1, x2, y2) {
        //FIXME:需要确认计算公式是否正确
        var result = x1 * y2 - x2 * y1;
        return round_1(result, 2);
      }
      /**
       * 2D 向量点乘。
       *
       * 两个点需要处于同一个坐标系中。
       *
       * @param x1
       * @param y1
       * @param x2
       * @param y2
       * @returns
       */

    }, {
      key: "dotProduct",
      value: function dotProduct(x1, y1, x2, y2) {
        var result = x1 * x2 + y1 * y2;
        return round_1(result, 2);
      }
    }]);

    return GeoUtil;
  }();

  /**
   * @class ICEBoundingBox 用4点法描述的边界盒子。
   *
   * - 边界盒子一定是矩形。
   * - 边界盒子总是绘制在全局坐标系中。
   * - 边界盒子总是通过自身的坐标点进行变换，而不是变换 canvas.ctx 。
   * - 边界盒子总是通过组件的参数计算出来的，直接修改边界盒子不影响组件本身的参数。
   *
   * TODO: Wrap up the original DOMPoint and DOMMatrix interfaces, add some util functions.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMPoint
   * @see https://developer.mozilla.org/en-US/docs/Web/API/DOMMatrix/DOMMatrix
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var ICEBoundingBox = /*#__PURE__*/function () {
    //top-left
    //top-right
    //bottom-left
    //bottom-right
    //center-point
    //FIXME:不使用 tl/tr/bl/br 固定4个顶点，顶点不定位
    function ICEBoundingBox() {
      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      _classCallCheck(this, ICEBoundingBox);

      _defineProperty$1(this, "tl", new DOMPoint());

      _defineProperty$1(this, "tr", new DOMPoint());

      _defineProperty$1(this, "bl", new DOMPoint());

      _defineProperty$1(this, "br", new DOMPoint());

      _defineProperty$1(this, "center", new DOMPoint());

      this.tl = new DOMPoint(props[0], props[1]);
      this.tr = new DOMPoint(props[2], props[3]);
      this.bl = new DOMPoint(props[4], props[5]);
      this.br = new DOMPoint(props[6], props[7]);
      this.center = new DOMPoint(props[8], props[9]);
    }
    /**
     * 从指定的 top/left/width/height 构建 ICEBoundingBox。
     * @param left
     * @param top
     * @param width
     * @param height
     * @returns
     */


    _createClass(ICEBoundingBox, [{
      key: "clone",
      value: function clone() {
        var tl = DOMPoint.fromPoint(this.tl);
        var tr = DOMPoint.fromPoint(this.tr);
        var bl = DOMPoint.fromPoint(this.bl);
        var br = DOMPoint.fromPoint(this.br);
        var center = DOMPoint.fromPoint(this.center);
        return new ICEBoundingBox([tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y, center.x, center.y]);
      }
      /**
       * 判断指定的坐标点是否位于边界矩形内部，向右水平射线法。
       * 这里参考了 fabricjs 的实现方式。
       * @see http://fabricjs.com/
       * @param point
       * @returns
       */

    }, {
      key: "containsPoint",
      value: function containsPoint(point) {
        //只考虑凸包的情况：[x,y]有一个值位于最大最小值之外，则不可能包含在边界盒子内部。
        var _this$getMinAndMaxPoi = this.getMinAndMaxPoint(),
            minX = _this$getMinAndMaxPoi.minX,
            minY = _this$getMinAndMaxPoi.minY,
            maxX = _this$getMinAndMaxPoi.maxX,
            maxY = _this$getMinAndMaxPoi.maxY;

        if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
          return false;
        }

        var xcount = 0; //交叉点个数

        var xi; //交点的 x 坐标

        var boudingLines = this.getBoundingLines();

        for (var i = 0; i < boudingLines.length; i++) {
          var line = boudingLines[i]; //特例1：点位于线段下方，水平射线不可能与线段交叉

          if (point.y > line.o.y && point.y > line.d.y) {
            continue;
          } //特例2：点位于线段上方，水平射线不可能与线段交叉


          if (point.y < line.o.y && point.y < line.d.y) {
            continue;
          }

          if (line.o.x === line.d.x && line.o.x >= point.x) {
            //特例3：处理垂直于 x 轴（平行于 y 轴）的特殊情况
            xi = line.o.x;
          } else {
            //斜率法求向右的射线与线段的交点 x 坐标
            var k = (line.d.y - line.o.y) / (line.d.x - line.o.x); //斜率

            xi = line.o.x + (point.y - line.o.y) / k;
          }

          if (xi > point.x) {
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

    }, {
      key: "getBoundingLines",
      value: function getBoundingLines() {
        var line_1 = {
          o: DOMPoint.fromPoint(this.tl),
          d: DOMPoint.fromPoint(this.tr)
        }; //o:origin, d:destination

        var line_2 = {
          o: DOMPoint.fromPoint(this.tr),
          d: DOMPoint.fromPoint(this.br)
        };
        var line_3 = {
          o: DOMPoint.fromPoint(this.br),
          d: DOMPoint.fromPoint(this.bl)
        };
        var line_4 = {
          o: DOMPoint.fromPoint(this.bl),
          d: DOMPoint.fromPoint(this.tl)
        };
        return [line_1, line_2, line_3, line_4];
      }
      /**
       * 获取边界盒子 x,y 的最大和最小值
       * @returns
       */

    }, {
      key: "getMinAndMaxPoint",
      value: function getMinAndMaxPoint() {
        //取任意一个顶点坐标作为初始值，然后与其它3个顶点的坐标进行比较
        var minX = this.tl.x;
        var minY = this.tl.y;
        var maxX = this.tl.x;
        var maxY = this.tl.y;
        var arr = [this.tr, this.bl, this.br];
        arr.forEach(function (p) {
          if (p.x < minX) {
            minX = p.x;
          }

          if (p.x > maxX) {
            maxX = p.x;
          }

          if (p.y < minY) {
            minY = p.y;
          }

          if (p.y > maxY) {
            maxY = p.y;
          }
        });
        return {
          minX: minX,
          minY: minY,
          maxX: maxX,
          maxY: maxY
        };
      }
      /**
       * FIXME:需要实现
       * 另一个边界盒子是否完全位于当前盒子内部。
       * @param box
       * @returns
       */

    }, {
      key: "containsBox",
      value: function containsBox(box) {
        return false;
      }
      /**
       * 是否与另一个盒子存在相交的部分。
       * @param box
       * @returns
       */

    }, {
      key: "isIntersect",
      value: function isIntersect(box) {
        var left1 = this.tl.x;
        var right1 = this.br.x;
        var top1 = this.tl.y;
        var bottom1 = this.br.y;
        var left2 = box.tl.x;
        var right2 = box.br.x;
        var top2 = box.tl.y;
        var bottom2 = box.br.y;
        var isIntersect = !(left1 > right2 || top1 > bottom2 || right1 < left2 || bottom1 < top2);
        return isIntersect;
      }
      /**
       * @param matrix
       * @returns A new ICEBoundingBox instance.
       */

    }, {
      key: "transform",
      value: function transform(matrix) {
        var tl = DOMPoint.fromPoint(this.tl).matrixTransform(matrix);
        var tr = DOMPoint.fromPoint(this.tr).matrixTransform(matrix);
        var bl = DOMPoint.fromPoint(this.bl).matrixTransform(matrix);
        var br = DOMPoint.fromPoint(this.br).matrixTransform(matrix);
        var center = DOMPoint.fromPoint(this.center).matrixTransform(matrix);
        return new ICEBoundingBox([tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y, center.x, center.y]);
      }
      /**
       * @param box
       * @returns A new ICEBoundingBox instance.
       */

    }, {
      key: "union",
      value: function union(box) {
        return null;
      }
    }, {
      key: "width",
      get: function get() {
        return GeoUtil.getLength(this.br.x, this.br.y, this.bl.x, this.bl.y);
      }
    }, {
      key: "height",
      get: function get() {
        return GeoUtil.getLength(this.br.x, this.br.y, this.tr.x, this.tr.y);
      }
    }, {
      key: "left",
      get: function get() {
        return this.tl.x;
      } //不允许设置 left 参数
      ,
      set: function set(num) {
        throw new Error('Can not set left to ICEBoundingBox directly.');
      }
    }, {
      key: "top",
      get: function get() {
        return this.tl.y;
      } //不允许设置 top 参数
      ,
      set: function set(num) {
        throw new Error('Can not set top to ICEBoundingBox directly.');
      }
    }, {
      key: "centerX",
      get: function get() {
        return this.center.x;
      }
    }, {
      key: "centerY",
      get: function get() {
        return this.center.y;
      }
    }, {
      key: "centerPoint",
      get: function get() {
        return this.center;
      }
    }], [{
      key: "fromDimension",
      value: function fromDimension(left, top, width, height) {
        var tl = [left, top];
        var tr = [left + width, top];
        var bl = [left, top + height];
        var br = [left + width, top + height];
        var center = [left + width / 2, top + height / 2];
        var paramArr = [].concat(tl, tr, bl, br, center);
        return new ICEBoundingBox(paramArr);
      }
    }]);

    return ICEBoundingBox;
  }();

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  //FIXME:包装 DOMMatrix，进行兼容处理。
  //https://developer.mozilla.org/en-US/docs/Web/API/DOMMatrix
  //DOMMatrix 类的浏览器兼容性：https://caniuse.com/?search=dommatrix
  var ICEMatrix = /*#__PURE__*/function () {
    function ICEMatrix() {
      _classCallCheck(this, ICEMatrix);
    }
    /**
     * 从变换矩阵计算旋转角度。
     * @param matrix
     * @returns 角度
     */


    _createClass(ICEMatrix, null, [{
      key: "calcRotateAngleFromMatrix",
      value: function calcRotateAngleFromMatrix(matrix) {
        var radians = 0;
        var a = matrix.a,
            b = matrix.b;
        var sin = b / Math.sqrt(a * a + b * b);
        var cos = a / Math.sqrt(a * a + b * b);
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

    }, {
      key: "calcScaleFromMatrix",
      value: function calcScaleFromMatrix(matrix) {
        var scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b) / matrix.a;
        var scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d) / matrix.d;
        return [scaleX, scaleY];
      }
    }]);

    return ICEMatrix;
  }();

  /**
   * @class ICEBaseComponent
   *
   * 最顶级的抽象类，Canvas 内部所有可见的组件都是它的子类。
   *
   * @abstract
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  var ICEBaseComponent = /*#__PURE__*/function (_EventTarget) {
    _inherits(ICEBaseComponent, _EventTarget);

    var _super = _createSuper(ICEBaseComponent);

    //当对象被添加到 canvas 中时，ICE 会自动设置 root 的值，没有被添加到 canvas 中的对象 root 为 null 。
    //FIXME:@Inject()
    //当对象被添加到 canvas 中时，ICE 会自动设置 ctx 的值，没有被添加到 canvas 中的对象 ctx 为 null 。
    //FIXME:@Inject()
    //事件总线， evtBus 在 render() 方法被调用时才会被设置
    //FIXME:@Inject()
    //FIXME:@Inject()
    //FIXME:如果引用了 ICE 实例，以上属性是否可以删掉？？？直接从 ICE 实例上获取？？？
    //组件当前归属的 ICE 实例，在处理一些内部逻辑时需要引用当前所在的 ICE 实例。只有当组件被 addChild() 方法加入到显示列表中之后， ice 属性才会有值。
    //所有组件都有父组件，但不一定都有子组件，只有容器型的组件才有子组件。如果父组件为 null ，说明直接添加在 canvas 中。
    //静态属性，实例计数器

    /**
     * @cfg
     * {
     *   id: 'ICE_' + Math.floor(Math.random() * 10000000000),   //全局唯一，跨机器，跨时间
     *   left: 0,                                                //x 坐标相对于父组件的偏移量
     *   top: 0,                                                 //y 坐标相对于父组件的偏移量
     *   width: 0,                                               //原始宽度，没有经过变换
     *   height: 0,                                              //原始高度，没有经过变换
     *   style: { fillStyle: 'red', strokeStyle: 'blue', lineWidth: 1 },
     *   animations: {},
     *   transform: {                                            //组件自身的变换参数，不包含父组件
     *     translate: [0, 0],
     *     scale: [1, 1],
     *     skew: [0, 0],
     *     rotate: 0,     //角度
     *   },
     *   translationMatrix: new DOMMatrix(),          //平移变换矩阵
     *   linearMatrix: new DOMMatrix(),               //线性变换矩阵，不含平移
     *   composedMatrix: new DOMMatrix(),             //复合变换矩阵，包含所有祖先节点的平移、原点移动、线性变换计算，composedMatrix 不会实时更新，如果需要获取当前最新的变换矩阵，需要调用 composeMatrix() 方法。
     *   origin:'localCenter',
     *   localOrigin: new DOMPoint(0, 0),             //相对于组件本地坐标系（组件内部的左上角为 [0,0] 点）计算的原点坐标
     *   absoluteOrigin: new DOMPoint(0, 0),          //相对于全局坐标系（canvas 的左上角 [0,0] 点）计算的原点坐标
     *   zIndex: ICEBaseComponent.instanceCounter++,  //类似于 CSS 中的 zIndex
     *   isRendering:false,                           //标志位， Renderer 在渲染过程中会检查此标志位
     *   display:true,                                //如果 display 为 false ， Renderer 不会调用其 render 方法，对象在内存中存在，但是不会被渲染出来。如果 display 为 false ，所有子组件也不会被渲染出来。
     *   draggable:true,                              //是否可以拖动
     *   transformable:true,                          //是否可以进行变换：scale/rotate/skew ，以及 resize ，但是不控制拖动
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
    function ICEBaseComponent() {
      var _this;

      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, ICEBaseComponent);

      _this = _super.call(this);

      _defineProperty$1(_assertThisInitialized(_this), "root", void 0);

      _defineProperty$1(_assertThisInitialized(_this), "ctx", void 0);

      _defineProperty$1(_assertThisInitialized(_this), "evtBus", void 0);

      _defineProperty$1(_assertThisInitialized(_this), "ice", void 0);

      _defineProperty$1(_assertThisInitialized(_this), "parentNode", void 0);

      _defineProperty$1(_assertThisInitialized(_this), "props", {
        id: 'ICE_' + Math.floor(Math.random() * 10000000000),
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        style: {
          fillStyle: 'red',
          strokeStyle: 'blue',
          lineWidth: 1
        },
        animations: {},
        transform: {
          translate: [0, 0],
          scale: [1, 1],
          skew: [0, 0],
          rotate: 0 //degree

        },
        translationMatrix: new DOMMatrix(),
        linearMatrix: new DOMMatrix(),
        composedMatrix: new DOMMatrix(),
        origin: 'localCenter',
        localOrigin: new DOMPoint(0, 0),
        absoluteOrigin: new DOMPoint(0, 0),
        zIndex: ICEBaseComponent.instanceCounter++,
        isRendering: false,
        display: true,
        draggable: true,
        transformable: true,
        interactive: true,
        showMinBoundingBox: true,
        showMaxBoundingBox: true
      });

      _defineProperty$1(_assertThisInitialized(_this), "state", _objectSpread2({}, _this.props));

      _this.props = merge_1(_this.props, props);
      _this.state = JSON.parse(JSON.stringify(_this.props)); //FIXME:生成随机ID有问题???
      // this.props.id = 'ICE_' + sha256(Math.random() * 100000000).toString();
      //sha256(Math.random() * 100000000).toString();

      _this.initEvents();

      return _this;
    }

    _createClass(ICEBaseComponent, [{
      key: "render",
      value:
      /**
       * !Important: 核心方法，FrameManager 会调度此方法进行实际的渲染操作。
       * !Important: 这些方法调用有顺序
       */
      function render() {
        this.state.isRendering = true;
        this.calcOriginalDimension();
        this.applyStyle();
        this.applyTransformToCtx();
        this.doRender();
        this.ctx.setTransform(new DOMMatrix());
        this.state.isRendering = false;
      }
    }, {
      key: "applyStyle",
      value: function applyStyle() {
        Object.assign(this.ctx, _objectSpread2(_objectSpread2({}, this.props.style), this.state.style));
      }
      /**
       * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
       * 此方法不能依赖原点位置和 transform 矩阵。
       * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
       * @returns
       */

    }, {
      key: "calcOriginalDimension",
      value: function calcOriginalDimension() {
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

    }, {
      key: "calcLocalOrigin",
      value: function calcLocalOrigin() {
        var point = new DOMPoint(0, 0);
        var position = this.state.origin;

        if (!position || position === 'localCenter') {
          var halfWidth = this.state.width / 2;
          var halfHeight = this.state.height / 2;
          point.x = halfWidth;
          point.y = halfHeight;
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

    }, {
      key: "calcAbsoluteOrigin",
      value: function calcAbsoluteOrigin() {
        var tx = get_1(this, 'state.transform.translate.0') + this.state.left;
        var ty = get_1(this, 'state.transform.translate.1') + this.state.top;
        var point = DOMPoint.fromPoint(this.calcLocalOrigin());
        point.x += tx;
        point.y += ty;

        if (this.parentNode) {
          var plox = this.parentNode.state.localOrigin.x;
          var ploy = this.parentNode.state.localOrigin.y;
          point = point.matrixTransform(new DOMMatrix([1, 0, 0, 1, -plox, -ploy]));
          var pcm = this.parentNode.state.composedMatrix;
          point = point.matrixTransform(pcm);
        }

        this.state.absoluteOrigin = point;
        return point;
      }
      /**
       * 计算线性变换矩阵，此矩阵不包含平移操作。
       * 线性变换顺序：旋转->错切->缩放
       * 由于矩阵变换有顺序，这里采用符合自然理解的顺序进行。
       * @method calcLinearMatrix
       * @returns DOMMatrix
       */

    }, {
      key: "calcLinearMatrix",
      value: function calcLinearMatrix() {
        var matrix = new DOMMatrix(); //step1: skew
        //DOMMatrix.skeXSelf 方法的参数是角度值，不是百分比。 @see https://drafts.fxtf.org/geometry/#DOMMatrix

        var skewX = get_1(this, 'state.transform.skew.0');
        var skewY = get_1(this, 'state.transform.skew.1');
        matrix.skewXSelf(skewX);
        matrix.skewYSelf(skewY); //step2: rotate

        var angle = get_1(this, 'state.transform.rotate');
        matrix.rotateSelf(angle); //step3: scale

        var scaleX = get_1(this, 'state.transform.scale.0');
        var scaleY = get_1(this, 'state.transform.scale.1');
        matrix.scaleSelf(scaleX, scaleY);
        this.state.linearMatrix = matrix;
        return matrix;
      }
      /**
       * 复合所有祖先节点的线性变换矩阵，获得相对于全局 canvas 对象的变换矩阵。
       * @returns
       */

    }, {
      key: "calcAbsoluteLinearMatrix",
      value: function calcAbsoluteLinearMatrix() {
        var component = this;
        var matrix = DOMMatrix.fromMatrix(component.calcLinearMatrix());

        while (component.parentNode) {
          matrix.multiplySelf(component.parentNode.state.linearMatrix);
          component = component.parentNode;
        }

        this.state.absoluteLinearMatrix = DOMMatrix.fromMatrix(matrix);
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
       * @returns DOMMatrix
       */

    }, {
      key: "composeMatrix",
      value: function composeMatrix() {
        //step-1: 移动到指定原点（全局坐标系）。
        var origin = this.calcAbsoluteOrigin();
        var translationMatrix = new DOMMatrix([1, 0, 0, 1, origin.x, origin.y]); //step-2: 计算线性变换矩阵，包含了所有祖先节点的线性变换。

        var linearMatrix = this.calcAbsoluteLinearMatrix(); //step-3: 计算综合变换矩阵，相当于先在 canvas 默认原点（左上角位置）进行变换，然后在平移到计算出的原点位置。

        var composedMatrix = translationMatrix.multiplySelf(linearMatrix);
        this.state.composedMatrix = DOMMatrix.fromMatrix(composedMatrix);
        return composedMatrix;
      }
      /**
       * 把变换矩阵应用到 this.ctx 上
       */

    }, {
      key: "applyTransformToCtx",
      value: function applyTransformToCtx() {
        this.ctx.setTransform(this.composeMatrix());
      }
      /**
       * 所有子类都应该提供具体的实现。
       * @method doRender
       */

    }, {
      key: "doRender",
      value: function doRender() {
        if (this.state.showMinBoundingBox) {
          var minBox = this.getMinBoundingBox();
          this.ctx.setTransform(new DOMMatrix());
          this.ctx.lineWidth = 1;
          this.ctx.strokeStyle = '#ff0000';
          this.ctx.fillStyle = 'rgba(0,0,0,0)';
          this.ctx.beginPath();
          this.ctx.moveTo(minBox.tl.x, minBox.tl.y);
          this.ctx.lineTo(minBox.tr.x, minBox.tr.y);
          this.ctx.lineTo(minBox.br.x, minBox.br.y);
          this.ctx.lineTo(minBox.bl.x, minBox.bl.y);
          this.ctx.closePath();
          this.ctx.stroke();
          this.ctx.fill();
        }

        if (this.state.showMaxBoundingBox) {
          var maxBox = this.getMaxBoundingBox();
          this.ctx.setTransform(new DOMMatrix());
          this.ctx.lineWidth = 1;
          this.ctx.strokeStyle = '#0000ff';
          this.ctx.fillStyle = 'rgba(0,0,0,0)';
          this.ctx.beginPath();
          this.ctx.moveTo(maxBox.tl.x, maxBox.tl.y);
          this.ctx.lineTo(maxBox.tr.x, maxBox.tr.y);
          this.ctx.lineTo(maxBox.br.x, maxBox.br.y);
          this.ctx.lineTo(maxBox.bl.x, maxBox.bl.y);
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

    }, {
      key: "getMinBoundingBox",
      value: function getMinBoundingBox() {
        //先基于组件本地坐标系进行计算
        var originX = this.state.localOrigin.x;
        var originY = this.state.localOrigin.y;
        var width = this.state.width;
        var height = this.state.height;
        var boundingBox = new ICEBoundingBox([0 - originX, 0 - originY, 0 - originX + width, 0 - originY, 0 - originX, 0 - originY + height, 0 - originX + width, 0 - originY + height, 0, 0]); //再用 composedMatrix 进行变换

        boundingBox = boundingBox.transform(this.composeMatrix());
        return boundingBox;
      }
      /**
       * 获取组件的最大包围盒：
       * - 盒子保持水平和竖直，不旋转、不错切。
       * - 盒子的4边在全局坐标 X/Y 轴上的投影范围与组件完全一致。
       * @returns
       */

    }, {
      key: "getMaxBoundingBox",
      value: function getMaxBoundingBox() {
        var boundingBox = this.getMinBoundingBox();

        var _boundingBox$getMinAn = boundingBox.getMinAndMaxPoint(),
            minX = _boundingBox$getMinAn.minX,
            minY = _boundingBox$getMinAn.minY,
            maxX = _boundingBox$getMinAn.maxX,
            maxY = _boundingBox$getMinAn.maxY;

        var center = boundingBox.centerPoint;
        boundingBox = new ICEBoundingBox([minX, minY, maxX, minY, minX, maxY, maxX, maxY, center.x, center.y]);
        return boundingBox;
      }
      /**
       * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
       * @param newState
       */

    }, {
      key: "setState",
      value: function setState(newState) {
        merge_1(this.state, newState);
      }
      /**
       * 相对于父组件的坐标系和原点。
       * @param left
       * @param top
       * @param evt
       */

    }, {
      key: "setPosition",
      value: function setPosition(left, top) {
        var evt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new ICEEvent();
        this.trigger('before-move', _objectSpread2(_objectSpread2({}, evt), {}, {
          left: left,
          top: top
        }));
        this.setState({
          left: left,
          top: top
        });
        this.trigger('after-move', _objectSpread2(_objectSpread2({}, evt), {}, {
          left: left,
          top: top
        }));
      }
      /**
       * 在全局空间(canvas)中移动指定的位移。
       * 注意：此方法用于直接设置组件在全局空间中的位移，而不是相对于其它坐标系。
       * @param tx
       * @param ty
       * @param evt
       */

    }, {
      key: "moveGlobalPosition",
      value: function moveGlobalPosition(tx, ty) {
        var evt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new ICEEvent();

        //如果组件存在嵌套，需要先用逆矩阵抵消所有祖先节点 transform 导致的坐标偏移。
        if (this.parentNode) {
          var point = new DOMPoint(tx, ty);
          var matrix = this.parentNode.state.absoluteLinearMatrix.inverse();
          point = point.matrixTransform(matrix);
          tx = point.x;
          ty = point.y;
        }

        this.setPosition(this.state.left + tx, this.state.top + ty, _objectSpread2(_objectSpread2({}, evt), {}, {
          tx: tx,
          ty: ty
        }));
      }
      /**
       * 直接设置在全局空间 (canvas) 中的位置。
       * 注意：此方法用于直接设置组件在全局空间中的位置，而不是相对于其它坐标系。
       * @param left
       * @param top
       * @param evt
       */

    }, {
      key: "setGlobalPosition",
      value: function setGlobalPosition(left, top) {
        var evt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new ICEEvent();

        //如果组件存在嵌套，需要先用逆矩阵抵消所有祖先节点 transform 导致的坐标偏移。
        if (this.parentNode) {
          var point = new DOMPoint(left, top);
          var matrix = this.parentNode.state.absoluteLinearMatrix.inverse();
          point = point.matrixTransform(matrix);
          left = point.x;
          top = point.y;
        }

        this.setPosition(left, top, _objectSpread2(_objectSpread2({}, evt), {}, {
          left: left,
          top: top
        }));
      }
      /**
       * 在全局空间(canvas)中旋转指定的角度。
       * 注意：此方法用于直接设置组件在全局空间中的旋转角，而不是相对于其它坐标系。
       * @param rotateAngle
       */

    }, {
      key: "setGlobalRotate",
      value: function setGlobalRotate(rotateAngle) {
        if (this.parentNode) {
          //组件存在嵌套的情况下，减掉所有祖先节点旋转角的总和。
          var matrix = this.parentNode.state.absoluteLinearMatrix;
          var angle = ICEMatrix.calcRotateAngleFromMatrix(matrix);
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

    }, {
      key: "localToGlobal",
      value: function localToGlobal(localX, localY) {
        var point = new DOMPoint(localX, localY);
        var matrix = this.state.composedMatrix;
        point = point.matrixTransform(matrix);
        return point;
      }
      /**
       * 全局空间(canvas)中的点转换成组件局部坐标系中的点，包含移动原点的操作。
       * @param globalX
       * @param globalY
       * @returns
       */

    }, {
      key: "globalToLocal",
      value: function globalToLocal(globalX, globalY) {
        var point = new DOMPoint(globalX, globalY);
        var matrix = this.state.composedMatrix.inverse();
        point = point.matrixTransform(matrix);
        return point;
      }
      /**
       * 根据变换矩阵计算组件在全局空间(canvas)中的旋转角度。
       * @returns
       */

    }, {
      key: "getRotateAngle",
      value: function getRotateAngle() {
        var matrix = this.state.composedMatrix;
        return ICEMatrix.calcRotateAngleFromMatrix(matrix);
      }
    }, {
      key: "getLocalLeftTop",
      value: function getLocalLeftTop() {
        var box = this.getMinBoundingBox();
        var width = box.width;
        var height = box.height;
        var left = box.centerX - box.width / 2;
        var top = box.centerY - box.height / 2;
        return {
          left: left,
          top: top,
          width: width,
          height: height
        };
      }
      /**
       * TODO:改成 abstract?
       * @returns
       */

    }, {
      key: "toJSON",
      value: function toJSON() {
        return '{}';
      }
      /**
       * TODO:改成 abstract
       * @returns
       */

    }, {
      key: "fromJSON",
      value: function fromJSON(jsonStr) {
        return {};
      } //FIXME:

    }, {
      key: "destory",
      value: function destory() {}
    }]);

    return ICEBaseComponent;
  }(EventTarget);

  _defineProperty$1(ICEBaseComponent, "instanceCounter", 0);

  /**
   * @class ICEPath
   *
   * 路径
   *
   * @abstract
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var ICEPath = /*#__PURE__*/function (_ICEBaseComponent) {
    _inherits(ICEPath, _ICEBaseComponent);

    var _super = _createSuper(ICEPath);

    /**
     * @cfg
     * {
     *   dots:Array<DOMPoint>  //可选参数，路径上的点。
     * }
     * @param props
     */
    function ICEPath() {
      var _this;

      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, ICEPath);

      _this = _super.call(this, _objectSpread2({
        closePath: true
      }, props));

      _defineProperty$1(_assertThisInitialized(_this), "path2D", new Path2D());

      return _this;
    }
    /**
     * 空实现。
     *
     * @see ICEBaseComponent.initEvents
     * @overwrite
     */


    _createClass(ICEPath, [{
      key: "initEvents",
      value: function initEvents() {}
      /**
       * @method doRender
       * @overwrite
       */

    }, {
      key: "doRender",
      value: function doRender() {
        //创建 Path2D 对象，doRender() 方法仅创建对象实例，不会立即绘制到画布上，绘制过程由 FrameManager 进行调度。
        //@see FrameManager.ts
        //@see https://developer.mozilla.org/en-US/docs/Web/API/Path2D/Path2D
        this.createPathObject();
        this.ctx.beginPath();

        if (this.state.closePath) {
          this.ctx.fill(this.path2D);
        }

        this.ctx.stroke(this.path2D);

        _get(_getPrototypeOf(ICEPath.prototype), "doRender", this).call(this);
      }
      /**
       * @method createPathObject
       * 创建路径对象，子类需要提供具体实现。
       */

    }]);

    return ICEPath;
  }(ICEBaseComponent);

  /**
   * @class ICEDotPath
   *
   * 基于一系列点进行绘制的路径。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var ICEDotPath = /*#__PURE__*/function (_ICEPath) {
    _inherits(ICEDotPath, _ICEPath);

    var _super = _createSuper(ICEDotPath);

    /**
     * FIXME:编写完整的配置项描述
     * @cfg
     * {
     *
     * }
     *
     * @param props
     */
    function ICEDotPath(props) {
      _classCallCheck(this, ICEDotPath);

      //dots 是内部计算使用的属性
      return _super.call(this, _objectSpread2({
        dots: [],
        closePath: true
      }, props));
    }
    /**
     * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
     * 由于点状路径可能是不规则的形状，所以宽高需要手动计算，特殊形状的子类需要覆盖此方法提供自己的实现。
     * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     * @overwrite
     * @returns
     */


    _createClass(ICEDotPath, [{
      key: "calcOriginalDimension",
      value: function calcOriginalDimension() {
        //DotPath 需要先计算每个点的坐标，然后才能计算 width/height
        this.calcDots();
        var points = this.calc4VertexPoints();
        var width = Math.abs(points[1].x - points[0].x); //maxX-minX

        var height = Math.abs(points[2].y - points[0].y); //maxY-minY

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

    }, {
      key: "calcLocalOrigin",
      value: function calcLocalOrigin() {
        var origin = _get(_getPrototypeOf(ICEDotPath.prototype), "calcLocalOrigin", this).call(this);

        for (var i = 0; i < this.state.dots.length; i++) {
          var dot = this.state.dots[i];
          dot = dot.matrixTransform(new DOMMatrix([1, 0, 0, 1, -origin.x, -origin.y]));
          this.state.dots[i] = dot;
        }

        return origin;
      }
      /**
       * @returns
       */

    }, {
      key: "createPathObject",
      value: function createPathObject() {
        this.path2D = new Path2D();

        for (var i = 0; i < this.state.dots.length; i++) {
          var dot = this.state.dots[i];

          if (i === 0) {
            this.path2D.moveTo(dot.x, dot.y);
          } else {
            this.path2D.lineTo(dot.x, dot.y);
          }
        }

        if (this.state.closePath) {
          this.path2D.closePath();
        }

        return this.path2D;
      }
      /**
       * 计算路径上的关键点:
       * - 默认的坐标原点是 (0,0) 位置。
       * - 这些点没有经过 transform 矩阵变换。
       * this.calcOriginalDimension() 会依赖此方法，在计算尺寸时还没有确定原点坐标，所以 calcDots() 方法内部不能依赖原点坐标，只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
       * @returns
       */

    }, {
      key: "calcDots",
      value: function calcDots() {
        this.state.dots = [];
        return this.state.dots;
      }
      /**
       *
       * 计算4个顶点：
       * - 相对于组件本地的坐标系，原点位于左上角，没有经过矩阵变换。
       * - 返回值用于计算组件的原始 width/height 。
       *
       * @returns Array<DOMPoint>
       */

    }, {
      key: "calc4VertexPoints",
      value: function calc4VertexPoints() {
        var minX = 0;
        var minY = 0;
        var maxX = 0;
        var maxY = 0;

        for (var i = 0; i < this.state.dots.length; i++) {
          var point = this.state.dots[i];

          if (i === 0) {
            minX = point.x;
            maxX = point.x;
            minY = point.y;
            maxY = point.y;
          } else {
            if (point.x < minX) {
              minX = point.x;
            }

            if (point.x > maxX) {
              maxX = point.x;
            }

            if (point.y < minY) {
              minY = point.y;
            }

            if (point.y > maxY) {
              maxY = point.y;
            }
          }
        } //top-left point


        var x1 = minX;
        var y1 = minY; //top-right point

        var x2 = maxX;
        var y2 = minY; //bottom-left point

        var x3 = minX;
        var y3 = maxY; //bottom-right point

        var x4 = maxX;
        var y4 = maxY;
        return [new DOMPoint(x1, y1), new DOMPoint(x2, y2), new DOMPoint(x3, y3), new DOMPoint(x4, y4)];
      }
    }]);

    return ICEDotPath;
  }(ICEPath);

  /**
   * @class ICERect 矩形
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var ICERect = /*#__PURE__*/function (_ICEDotPath) {
    _inherits(ICERect, _ICEDotPath);

    var _super = _createSuper(ICERect);

    function ICERect() {
      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, ICERect);

      return _super.call(this, _objectSpread2({
        width: 10,
        height: 10
      }, props));
    }
    /**
     * 计算路径上的关键点:
     * - 默认的坐标原点是 (0,0) 位置。
     * - 这些点没有经过 transform 矩阵变换。
     * - this.calcOriginalDimension() 会依赖此方法，在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     * @returns
     */


    _createClass(ICERect, [{
      key: "calcDots",
      value: function calcDots() {
        var point1 = new DOMPoint(0, 0); //top-left point

        var point2 = new DOMPoint(this.state.width, 0); //top-right point

        var point3 = new DOMPoint(this.state.width, this.state.height); //bottom-right point

        var point4 = new DOMPoint(0, this.state.height); //bottom-left point

        this.state.dots = [point1, point2, point3, point4];
        return this.state.dots;
      }
    }]);

    return ICERect;
  }(ICEDotPath);

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

  var author = "大漠穷秋";
  var name = "ice-render";
  var version = "0.0.1";
  var description = "A canvas engine for interactive graphics.";
  var repository = "https://gitee.com/ice-render/ice-render";
  var browser = "dist/index.umd.js";
  var main = "dist/index.cjs.js";
  var module = "dist/index.esm.js";
  var types = "dist/types/index.d.ts";
  var files = [
  	"dist"
  ];
  var scripts = {
  	build: "npm run build:types && npm run build:js",
  	"build:js": "rollup -c --environment NODE_ENV:production",
  	"build:types": "tsc --emitDeclarationOnly",
  	clean: "rimraf dist",
  	pretty: "prettier src/**/* --write",
  	start: "rollup -c -w  --environment NODE_ENV:development",
  	"types:check": "tsc --noEmit",
  	"types:watch": "npm run types:check -- --watch"
  };
  var dependencies = {
  	"gl-matrix": "3.3.0",
  	lodash: "4.17.21"
  };
  var devDependencies = {
  	"@babel/core": "7.9.0",
  	"@babel/plugin-proposal-class-properties": "7.16.0",
  	"@babel/preset-env": "7.9.5",
  	"@babel/preset-typescript": "7.9.0",
  	"@commitlint/cli": "8.3.5",
  	"@commitlint/config-conventional": "8.3.4",
  	"@rollup/plugin-commonjs": "11.1.0",
  	"@rollup/plugin-json": "4.0.3",
  	"@rollup/plugin-node-resolve": "7.1.3",
  	"@types/jest": "25.2.1",
  	"@types/lodash": "4.14.178",
  	"@typescript-eslint/eslint-plugin": "2.29.0",
  	"@typescript-eslint/parser": "2.29.0",
  	eslint: "6.8.0",
  	"eslint-config-prettier": "6.11.0",
  	"eslint-plugin-jest": "23.8.2",
  	"eslint-plugin-prettier": "3.1.3",
  	husky: "4.2.5",
  	jest: "25.4.0",
  	"lint-staged": "10.1.7",
  	rimraf: "3.0.2",
  	rollup: "2.7.2",
  	"rollup-plugin-babel": "4.4.0",
  	"rollup-plugin-terser": "5.3.0",
  	storybook: "6.3.12",
  	typescript: "3.8.3"
  };
  var commitlint = {
  	"extends": [
  		"@commitlint/config-conventional"
  	]
  };
  var keywords = [
  	"canvas",
  	"graphic"
  ];
  var license = "MIT";
  var pkg = {
  	author: author,
  	name: name,
  	version: version,
  	description: description,
  	repository: repository,
  	browser: browser,
  	main: main,
  	module: module,
  	types: types,
  	files: files,
  	scripts: scripts,
  	dependencies: dependencies,
  	devDependencies: devDependencies,
  	commitlint: commitlint,
  	"lint-staged": {
  	"*.{js,jsx,ts,tsx}": [
  		"eslint --fix",
  		"git add"
  	],
  	"*.{json,md,yml}": [
  		"prettier --write",
  		"git add"
  	]
  },
  	keywords: keywords,
  	license: license
  };

  /**
   * @class DDManager
   *
   *  拖拽管理器
   *
   * - 拖拽管理器是纯逻辑组件，没有外观。
   * - 全局单例，一个 ICE 实例上只能有一个 DDManager 实例。
   * - DDManager 只负责拖拽和移动位置，不进行其它操作。
   *
   * @see ICE
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  var DDManager = /*#__PURE__*/function () {
    //当前正在拖动的组件，FIXME:同时拖动多个组件？
    function DDManager(ice) {
      _classCallCheck(this, DDManager);

      _defineProperty$1(this, "ice", void 0);

      _defineProperty$1(this, "currentObj", void 0);

      this.ice = ice;
    }

    _createClass(DDManager, [{
      key: "mouseDownHandler",
      value: function mouseDownHandler(evt) {
        var component = evt.target;

        if (!(component instanceof ICEBaseComponent)) {
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
    }, {
      key: "mouseMoveHandler",
      value: function mouseMoveHandler(evt) {
        var tx = evt.movementX / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去

        var ty = evt.movementY / window.devicePixelRatio; //FIXME: window.devicePixelRatio 需要移动到初始化参数中去

        this.currentObj.moveGlobalPosition(tx, ty, evt);
        return true;
      }
    }, {
      key: "mouseUpHandler",
      value: function mouseUpHandler(evt) {
        this.ice.evtBus.off('mousemove', this.mouseMoveHandler, this);
        this.ice.evtBus.off('mouseup', this.mouseUpHandler, this);
      }
    }, {
      key: "start",
      value: function start() {
        this.ice.evtBus.on('mousedown', this.mouseDownHandler, this);
        return this;
      } //FIXME:

    }, {
      key: "stop",
      value: function stop() {}
    }]);

    return DDManager;
  }();

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

  var ICEPolyLine = /*#__PURE__*/function (_ICEDotPath) {
    _inherits(ICEPolyLine, _ICEDotPath);

    var _super = _createSuper(ICEPolyLine);

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
    function ICEPolyLine() {
      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, ICEPolyLine);

      var param = ICEPolyLine.arrangeParam(props);
      return _super.call(this, param);
    }
    /**
     *
     * 整理并校验构造参数。
     *
     * @static
     * @param props
     * @returns
     */


    _createClass(ICEPolyLine, [{
      key: "calcLocalOrigin",
      value:
      /**
       * ICEPolyLine 有自己的特殊处理，它的原点永远在 (0,0) 位置，而不在几何中点。
       * @overwrite
       * @returns
       */
      function calcLocalOrigin() {
        var point = new DOMPoint(0, 0);
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

    }, {
      key: "calcDots",
      value: function calcDots() {
        var _this = this;

        var left = this.state.left;
        var top = this.state.top;
        this.state.dots = [];
        this.state.points.forEach(function (p) {
          var x = p[0] - left;
          var y = p[1] - top;

          _this.state.dots.push(new DOMPoint(x, y));
        });
        return this.state.dots;
      }
      /**
       * 动态向线条上增加一个点
       * @param point
       * @param index
       */

    }, {
      key: "addDot",
      value: function addDot(point, index) {
        this.state.points.splice(index, 0, point);
        this.state.dots.splice(index, 0, new DOMPoint(point[0], point[1]));
      }
      /**
       * 从线条上删掉一个点，如果线条上的点数已经小于等于 2 ，则什么都不做。
       * @param index
       */

    }, {
      key: "rmDot",
      value: function rmDot(index) {
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

    }, {
      key: "calcOriginalDimension",
      value: function calcOriginalDimension() {
        this.calcDots();
        var points = this.calc4VertexPoints(); //最小包围盒的4个顶点

        var width = Math.abs(points[1].x - points[0].x); //maxX-minX

        var height = this.state.style.lineWidth; //先进行共线判断，如果所有点都在同一条直线上，那么边界盒子的整体高度就等于线条的粗细

        if (this.isDotsOnSameLine()) {
          this.state.width = width;
          this.state.height = height;
          return {
            width: this.state.width,
            height: this.state.height
          };
        } else {
          height = Math.abs(points[2].y - points[0].y); //maxY-minY

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

    }, {
      key: "isDotsOnSameLine",
      value: function isDotsOnSameLine() {
        var len = this.state.points.length;
        var startX = round_1(this.state.points[0][0], 2);
        var startY = round_1(this.state.points[0][1], 2);
        var endX = round_1(this.state.points[len - 1][0], 2);
        var endY = round_1(this.state.points[len - 1][1], 2);
        var counter = 0;
        var vector1 = [endX - startX, endY - startY]; //起点和终点构成的向量坐标

        for (var i = 0; i < len; i++) {
          var p = this.state.points[i];
          var vector2 = [p[0] - startX, p[1] - startY];
          var crossProduct = GeoUtil.crossProduct(vector1[0], vector1[1], vector2[0], vector2[1]);

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
       * @returns Array<DOMPoint>
       */

    }, {
      key: "calc4VertexPoints",
      value: function calc4VertexPoints() {
        if (this.isDotsOnSameLine()) {
          return this.splitEndpointsTo4Points();
        } else {
          return _get(_getPrototypeOf(ICEPolyLine.prototype), "calc4VertexPoints", this).call(this);
        }
      }
      /**
       * 把直线的2个端点分裂成4个点，把线条的粗细参数(lineWidth)当成高度看待，方便计算最小包围盒。
       * @returns
       */

    }, {
      key: "splitEndpointsTo4Points",
      value: function splitEndpointsTo4Points() {
        var len = this.state.points.length;
        var startX = 0; //由于 ICEPolyLine 总是把 left/top 与起点重合，所以这里的 startX 总是为 0

        var startY = 0; //由于 ICEPolyLine 总是把 left/top 与起点重合，所以这里的 startY 总是为 0

        var endX = this.state.points[len - 1][0] - this.state.points[0][0];
        var endY = this.state.points[len - 1][1] - this.state.points[0][1];
        var angle = this.getRotateAngle();
        var height = this.state.height;
        var deltaX = Math.cos(angle * Math.PI / 180) * height / 2;
        var deltaY = Math.sin(angle * Math.PI / 180) * height / 2;
        deltaX = round_1(deltaX, 3);
        deltaY = round_1(deltaY, 3); //计算4个顶点，让边界盒子紧贴直线

        var point1 = new DOMPoint(startX + deltaX, startY + deltaY);
        var point2 = new DOMPoint(startX - deltaX, startY - deltaY);
        var point3 = new DOMPoint(endX + deltaX, endY + deltaY);
        var point4 = new DOMPoint(endX - deltaX, endY - deltaY);
        return [point1, point2, point3, point4];
      }
      /**
       * 获取组件的最小包围盒，此盒子的变换矩阵与组件自身完全相同。
       * @returns
       */

    }, {
      key: "getMinBoundingBox",
      value: function getMinBoundingBox() {
        //先基于组件本地坐标系进行计算
        var originX = this.state.localOrigin.x;
        var originY = this.state.localOrigin.y;
        var points = this.calc4VertexPoints();
        var boundingBox = new ICEBoundingBox([points[0].x - originX, points[0].y - originY, points[1].x - originX, points[1].y - originY, points[2].x - originX, points[2].y - originY, points[3].x - originX, points[3].y - originY, 0, 0]); //再用 composedMatrix 进行变换

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

    }, {
      key: "setState",
      value: function setState(newState) {
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
          var offsetX = newState.left - this.state.points[0][0];

          for (var i = 0; i < this.state.points.length; i++) {
            this.state.points[i][0] += offsetX;
          }
        }

        if (!isNil_1(newState.top)) {
          var offsetY = newState.top - this.state.points[0][1];

          for (var _i = 0; _i < this.state.points.length; _i++) {
            this.state.points[_i][1] += offsetY;
          }
        }

        if (!isNil_1(newState.startPoint)) {
          this.state.points[0] = _toConsumableArray(newState.startPoint); //对 ICEPolyLine 来说，需要保证 left/top 与起点始终重合。

          this.state.left = this.state.points[0][0];
          this.state.top = this.state.points[0][1];
        }

        if (!isNil_1(newState.endPoint)) {
          var len = this.state.points.length;
          this.state.points[len - 1] = _toConsumableArray(newState.endPoint);
        }

        _get(_getPrototypeOf(ICEPolyLine.prototype), "setState", this).call(this, newState);
      }
      /**
       * 获取旋转角
       * @returns
       */

    }, {
      key: "getRotateAngle",
      value: function getRotateAngle() {
        //先进行共线判断，如果所有点都共线，则旋转角等于直线斜率对应的旋转角。
        if (this.isDotsOnSameLine()) {
          var startX = 0; //由于 ICEPolyLine 总是把 left/top 与 startPoint 重合，所以这里的 startX 总是为 0

          var startY = 0; //由于 ICEPolyLine 总是把 left/top 与 startPoint 重合，所以这里的 startY 总是为 0

          var len = this.state.points.length;
          var endX = this.state.points[len - 1][0] - this.state.points[0][0];
          var endY = this.state.points[len - 1][1] - this.state.points[0][1]; //计算直线的旋转角

          var angle = GeoUtil.calcRotateAngle(endX, endY, startX, startY);
          angle += 90; //加90度，法向

          return angle;
        } else {
          return _get(_getPrototypeOf(ICEPolyLine.prototype), "getRotateAngle", this).call(this);
        }
      }
    }], [{
      key: "arrangeParam",
      value: function arrangeParam(props) {
        //dots 是内部计算使用的属性，外部传参用 points 属性
        //points 是一个数组，用来描述一系列的坐标点，这些点会被按照顺序连接起来，example: [[0,0],[10,10],[20,20],[30,30]]
        var param = merge_1({
          lineType: 'solid',
          lineWidth: 2,
          arrow: 'none',
          closePath: false,
          points: []
        }, props); //至少有2个点，如果点数少于2个，自动填充。

        var len = param.points.length;

        if (len < 2) {
          if (len === 0) {
            param.points.push([0, 0]);
            param.points.push([10, 10]);
          } else if (len === 1) {
            param.points.push([10, 10]);
          }
        } //ICEPolyLine 的参数需要特殊处理，总是把 left/top 移动到第 0 个点的位置，外部传递的 left/top ， translate.x/translate.y 都无效。


        param = merge_1(param, {
          left: props.points[0][0],
          top: props.points[0][1],
          transform: {
            translate: [0, 0],
            scale: [1, 1],
            skew: [0, 0],
            rotate: 0 //degree

          }
        }); //保证 lineWidth 不小于0

        if (param.style.lineWidth <= 0) {
          param.style.lineWidth = 2;
        }

        return param;
      }
    }]);

    return ICEPolyLine;
  }(ICEDotPath);

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  var ICE_CONSTS = {
    ICE_FRAME_EVENT: 'ICE_FRAME_EVENT',
    BEFORE_RENDER: 'BEFORE_RENDER',
    AFTER_RENDER: 'AFTER_RENDER',
    ICE_CLICK: 'ICE_CLICK',
    BEFORE_ADD: 'BEFORE_ADD',
    //在 addChild() 方法中的第一行执行
    AFTER_ADD: 'AFTER_ADD',
    //在 addChild() 方法返回之前执行
    BEFORE_REMOVE: 'BEFORE_REMOVE',
    //在 removeChild() 方法中的第一行执行
    AFTER_REMOVE: 'AFTER_REMOVE' //在 removeChild() 方法返回之前执行

  };

  /**
   * @class ICEGroup
   *
   * 容器型组件
   *
   * ICEGroup 可以包含自身，利用此组件可以构造出树形的对象结构。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var ICEGroup = /*#__PURE__*/function (_ICERect) {
    _inherits(ICEGroup, _ICERect);

    var _super = _createSuper(ICEGroup);

    function ICEGroup(props) {
      var _this;

      _classCallCheck(this, ICEGroup);

      _this = _super.call(this, props);

      _defineProperty$1(_assertThisInitialized(_this), "parentNode", null);

      _defineProperty$1(_assertThisInitialized(_this), "childNodes", []);

      return _this;
    }
    /**
     * 注意，在调用 ICEGroup.addChild() 方法时， ICEGroup 自身可能还没有被添加到 ICE 实例中去。
     * 所以此时 child.root, child.ctx, child.evtBus 都可能为空。
     * @param child
     */


    _createClass(ICEGroup, [{
      key: "addChild",
      value: function addChild(child) {
        child.trigger(ICE_CONSTS.BEFORE_ADD);
        child.parentNode = this;
        this.childNodes.push(child);
        child.trigger(ICE_CONSTS.AFTER_ADD);
      }
    }, {
      key: "addChildren",
      value: function addChildren(arr) {
        var _this2 = this;

        arr.forEach(function (child) {
          _this2.addChild(child);
        });
      }
    }, {
      key: "removeChild",
      value: function removeChild(child) {
        child.trigger(ICE_CONSTS.BEFORE_REMOVE);
        child.parentNode = null;
        child.root = null;
        child.ctx = null;
        child.evtBus = null;
        child.ice = null;
        this.childNodes.splice(this.childNodes.indexOf(child), 1);
        child.trigger(ICE_CONSTS.AFTER_REMOVE);
      }
    }, {
      key: "removeChildren",
      value: function removeChildren(arr) {
        var _this3 = this;

        arr.forEach(function (child) {
          _this3.removeChild(child);
        });
      }
    }]);

    return ICEGroup;
  }(ICERect);

  /**
   * @class ICEControlPanel
   *
   * 控制面板
   *
   * - ICEControlPanel 本身总是直接画在 canvas 上，不是任何组件的孩子。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  var ICEControlPanel = /*#__PURE__*/function (_ICEGroup) {
    _inherits(ICEControlPanel, _ICEGroup);

    var _super = _createSuper(ICEControlPanel);

    function ICEControlPanel(props) {
      var _this;

      _classCallCheck(this, ICEControlPanel);

      _this = _super.call(this, props);

      _defineProperty$1(_assertThisInitialized(_this), "_targetComponent", void 0);

      return _this;
    }

    _createClass(ICEControlPanel, [{
      key: "doRender",
      value: function doRender() {
        _get(_getPrototypeOf(ICEControlPanel.prototype), "doRender", this).call(this);

        this.setControlPositions();
      }
    }, {
      key: "moveGlobalPosition",
      value: function moveGlobalPosition(tx, ty, evt) {
        _get(_getPrototypeOf(ICEControlPanel.prototype), "moveGlobalPosition", this).call(this, tx, ty, evt);

        if (this._targetComponent) {
          this._targetComponent.moveGlobalPosition(tx, ty, evt);
        }
      }
    }]);

    return ICEControlPanel;
  }(ICEGroup);

  /**
   * @class ICEEllipse
   *
   * 椭圆形。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var ICEEllipse = /*#__PURE__*/function (_ICEPath) {
    _inherits(ICEEllipse, _ICEPath);

    var _super = _createSuper(ICEEllipse);

    //@see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/ellipse
    function ICEEllipse() {
      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, ICEEllipse);

      var param = _objectSpread2({
        radiusX: 20,
        radiusY: 10,
        rotation: 0,
        startAngle: 0,
        endAngle: 2 * Math.PI,
        counterclockwise: true
      }, props);

      param.width = param.radiusX * 2;
      param.height = param.radiusY * 2;
      return _super.call(this, param);
    }
    /**
     * 所有坐标点的坐标都是相对于父层组件，而不是全局坐标。
     * @returns
     */


    _createClass(ICEEllipse, [{
      key: "createPathObject",
      value: function createPathObject() {
        this.path2D = new Path2D();
        this.path2D.ellipse(this.state.radiusX - this.state.localOrigin.x, this.state.radiusY - this.state.localOrigin.y, this.state.radiusX, this.state.radiusY, this.state.rotation, this.state.startAngle, this.state.endAngle, this.state.counterclockwise);
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

    }, {
      key: "setState",
      value: function setState(newState) {
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

        _get(_getPrototypeOf(ICEEllipse.prototype), "setState", this).call(this, newState);
      }
    }]);

    return ICEEllipse;
  }(ICEPath);

  /**
   * @class ICECircle
   *
   * 正圆形，采用椭圆绘制方法，正圆形作为椭圆的特殊情况。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var ICECircle = /*#__PURE__*/function (_ICEEllipse) {
    _inherits(ICECircle, _ICEEllipse);

    var _super = _createSuper(ICECircle);

    function ICECircle() {
      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, ICECircle);

      var param = _objectSpread2({
        radius: 10
      }, props);

      param.radiusX = param.radius;
      param.radiusY = param.radius;
      return _super.call(this, param);
    }

    return _createClass(ICECircle);
  }(ICEEllipse);

  /**
   * @class ICELinkHook
   *
   * 连接钩子
   *
   * - ICELinkHook 与 ICELinkSlot 是一对组件，用来把两个组件连接起来
   * - ICELinkHook 不能独立存在，它的实例放在 @see LineControlPanel 上
   * - ICELinkHook 自身不进行任何 transform 。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var ICELinkHook = /*#__PURE__*/function (_ICECircle) {
    _inherits(ICELinkHook, _ICECircle);

    var _super = _createSuper(ICELinkHook);

    function ICELinkHook() {
      var props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      _classCallCheck(this, ICELinkHook);

      return _super.call(this, props);
    }

    _createClass(ICELinkHook, [{
      key: "initEvents",
      value: function initEvents() {
        _get(_getPrototypeOf(ICELinkHook.prototype), "initEvents", this).call(this);

        this.on('mousedown', this.mosueDownHandler, this);
        this.on('mousemove', this.mosueMoveHandler, this);
        this.on('mouseup', this.mosueUpHandler, this);
        this.on('after-move', this.resizeEvtHandler, this);
      }
      /**
       *
       * 在 mousedown 事件处理器里面可以直接访问 this.evtBus ，因为能接收到 mousedown 事件说明组件已经渲染出来了。
       * 在 this.evtBus 上触发事件，相当于全局广播，所有监听了 hook-mousedown 事件的组件都会收到消息。
       *
       * @param evt
       */

    }, {
      key: "mosueDownHandler",
      value: function mosueDownHandler(evt) {
        this.evtBus.trigger('hook-mousedown', new ICEEvent({
          target: this
        }));
      }
      /**
       *
       * 在 mousemove 事件处理器里面可以直接访问 this.evtBus ，因为能接收到 mousemove 事件说明组件已经渲染出来了。
       * 在 this.evtBus 上触发事件，相当于全局广播，所有监听了 hook-mousemove 事件的组件都会收到消息。
       *
       * @param evt
       */

    }, {
      key: "mosueMoveHandler",
      value: function mosueMoveHandler(evt) {
        this.evtBus.trigger('hook-mousemove', new ICEEvent({
          target: this
        }));
      }
      /**
       *
       * 在 mouseup 事件处理器里面可以直接访问 this.evtBus ，因为能接收到 mouseup 事件说明组件已经渲染出来了。
       * 在 this.evtBus 上触发事件，相当于全局广播，所有监听了 hook-mouseup 事件的组件都会收到消息。
       *
       * @param evt
       */

    }, {
      key: "mosueUpHandler",
      value: function mosueUpHandler(evt) {
        this.evtBus.trigger('hook-mouseup', new ICEEvent({
          target: this
        }));
      }
    }, {
      key: "resizeEvtHandler",
      value: function resizeEvtHandler(evt) {
        if (!this.parentNode) {
          return;
        }

        var position = this.props.position;
        this.parentNode.trigger('before-resize', new ICEEvent(evt, {
          position: position
        }));
        this.parentNode.trigger('after-resize', new ICEEvent(evt, {
          position: position
        }));
      }
    }]);

    return ICELinkHook;
  }(ICECircle);

  /**
   *
   * FIXME: 当组件移动位置是， LineControlPanel 不需要跟随移动，始终保持在左上角即可。
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

  var LineControlPanel = /*#__PURE__*/function (_ICEControlPanel) {
    _inherits(LineControlPanel, _ICEControlPanel);

    var _super = _createSuper(LineControlPanel);

    //TODO:改成可配置参数
    function LineControlPanel(props) {
      var _this;

      _classCallCheck(this, LineControlPanel);

      _this = _super.call(this, _objectSpread2(_objectSpread2({}, props), {}, {
        zIndex: Number.MAX_VALUE,
        showMinBoundingBox: true,
        showMaxBoundingBox: true
      }));

      _defineProperty$1(_assertThisInitialized(_this), "controlSize", 16);

      _defineProperty$1(_assertThisInitialized(_this), "startControl", void 0);

      _defineProperty$1(_assertThisInitialized(_this), "endControl", void 0);

      _this.initControls();

      return _this;
    }

    _createClass(LineControlPanel, [{
      key: "initControls",
      value: function initControls() {
        var counter = 1;
        var width = this.state.width;
        var height = this.state.height;
        var halfControlSize = this.controlSize / 2;
        this.startControl = new ICELinkHook({
          zIndex: Number.MAX_VALUE - counter++,
          left: -halfControlSize,
          top: -halfControlSize,
          width: this.controlSize,
          height: this.controlSize,
          //TODO: style 放到 props 中去变成可配置的参数
          style: {
            strokeStyle: '#8b0000',
            fillStyle: '#CC3300',
            lineWidth: 1
          },
          position: 'start'
        });
        this.addChild(this.startControl);
        this.endControl = new ICELinkHook({
          zIndex: Number.MAX_VALUE - counter++,
          left: width - halfControlSize,
          top: height - halfControlSize,
          width: this.controlSize,
          height: this.controlSize,
          //TODO: style 放到 props 中去变成可配置的参数
          style: {
            strokeStyle: '#8b0000',
            fillStyle: '#CC3300',
            lineWidth: 1
          },
          position: 'end'
        });
        this.addChild(this.endControl);
      }
    }, {
      key: "initEvents",
      value: function initEvents() {
        this.on('after-resize', this.resizeEvtHandler, this);
      }
      /**
       * 设置所有手柄在父组件中的位置，相对于父组件的本地坐标系。
       * LineControlPanel 不强制操作手柄的位置，操作手柄可以自由移动。
       */

    }, {
      key: "setControlPositions",
      value: function setControlPositions() {}
    }, {
      key: "resizeEvtHandler",
      value: function resizeEvtHandler(evt) {
        if (!this.targetComponent) {
          return;
        }

        var position = evt.position;
        var movementX = evt.movementX / window.devicePixelRatio;
        var movementY = evt.movementY / window.devicePixelRatio;
        var targetState = this.targetComponent.state;
        var len = targetState.points.length;
        var newStartX = targetState.points[0][0];
        var newStartY = targetState.points[0][1];
        var newEndX = targetState.points[len - 1][0];
        var newEndY = targetState.points[len - 1][1]; //用逆矩阵补偿组件 transform 导致的坐标变换。
        //组件自身的 absoluteLinearMatrix 已经包含了所有层级上的 transform 。

        var matrix = targetState.absoluteLinearMatrix.inverse();
        var point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
        movementX = point.x;
        movementY = point.y;

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
    }, {
      key: "updatePosition",
      value: function updatePosition() {
        if (this.targetComponent) {
          //ICEPolyLine 的处理方式与其它组件不同，这里 LineControPanel 本身的外观不重要，只要变换手柄能自由移动就可以
          //设置 LineControlPanel 自身的位置
          this.setState({
            left: 0,
            top: 0,
            width: 100,
            height: 100,
            transform: {
              translate: [0, 0],
              scale: [1, 1],
              skew: [0, 0],
              rotate: 0 //degree

            }
          }); //设置 LineControlPanel 内部手柄的位置

          var halfControlSize = this.controlSize / 2;
          var len = this.targetComponent.state.points.length;
          var start = this.targetComponent.state.points[0];
          var end = this.targetComponent.state.points[len - 1];
          var startPoint = new DOMPoint(start[0], start[1]);
          var endPoint = new DOMPoint(end[0], end[1]);
          this.startControl.setState({
            left: startPoint.x - halfControlSize,
            top: startPoint.y - halfControlSize
          });
          this.endControl.setState({
            left: endPoint.x - halfControlSize,
            top: endPoint.y - halfControlSize
          });
        }
      }
    }, {
      key: "followTargetComponent",
      value: function followTargetComponent(evt) {
        this.updatePosition();
      }
    }, {
      key: "targetComponent",
      get: function get() {
        return this._targetComponent;
      },
      set: function set(component) {
        this._targetComponent = component;

        if (component) {
          this.updatePosition();
          component.on('after-move', this.followTargetComponent, this);
        } else {
          component.off('after-move', this.followTargetComponent, this);
        }
      }
    }, {
      key: "showHooks",
      value: function showHooks() {
        this.startControl.setState({
          display: true
        });
        this.endControl.setState({
          display: true
        });
      }
    }, {
      key: "hideHooks",
      value: function hideHooks() {
        this.startControl.setState({
          display: false
        });
        this.endControl.setState({
          display: false
        });
      }
    }]);

    return LineControlPanel;
  }(ICEControlPanel);

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

  var ResizeControl = /*#__PURE__*/function (_ICERect) {
    _inherits(ResizeControl, _ICERect);

    var _super = _createSuper(ResizeControl);

    function ResizeControl(props) {
      var _this;

      _classCallCheck(this, ResizeControl);

      _this = _super.call(this, _objectSpread2({
        position: 'l',
        direction: 'x',
        quadrant: 1
      }, props));

      _this.on('after-move', _this.resizeEvtHandler, _assertThisInitialized(_this));

      return _this;
    }
    /**
     * 围绕几何中心点调整宽高。
     * @param evt
     */


    _createClass(ResizeControl, [{
      key: "resizeEvtHandler",
      value: function resizeEvtHandler(evt) {
        if (!this.parentNode) {
          //parentNode 是 TransformPanel
          return;
        }

        var quadrant = evt.quadrant;
        var movementX = evt.movementX / window.devicePixelRatio;
        var movementY = evt.movementY / window.devicePixelRatio;
        var parentState = this.parentNode.state;
        var newLeft = parentState.left;
        var newTop = parentState.top;
        var newWidth = parentState.width;
        var newHeight = parentState.height; //用 parentNode 的逆矩阵把全局坐标系中的移动量转换为组件本地的移动量。
        //组件自身的 absoluteLinearMatrix 已经包含了所有层级上的 transform 。

        var matrix = parentState.absoluteLinearMatrix.inverse();
        var point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
        movementX = point.x;
        movementY = point.y;

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

        var param = {
          top: newTop,
          left: newLeft,
          width: Math.abs(newWidth),
          height: Math.abs(newHeight)
        };
        this.parentNode.trigger('before-resize', new ICEEvent(evt, {
          quadrant: quadrant
        }));
        this.parentNode.setState(param);
        this.parentNode.trigger('after-resize', new ICEEvent(evt, {
          quadrant: quadrant
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

    }, {
      key: "moveGlobalPosition",
      value: function moveGlobalPosition(tx, ty) {
        var evt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new ICEEvent();
        var signX = tx > 0 ? 1 : -1; //signX 大于 0 表示鼠标正在向 X 轴正向移动

        var signY = ty > 0 ? 1 : -1; //signY 大于 0 表示鼠标正在向 Y 轴正向移动

        var parentState = this.parentNode.state;
        var parentLocalOrigin = parentState.localOrigin;
        var parentWidth = parentState.width;
        var parentHeight = parentState.height;
        var matrix = parentState.absoluteLinearMatrix.inverse();
        var point = new DOMPoint(tx, ty).matrixTransform(matrix);
        tx = point.x;
        ty = point.y;
        var _this$state = this.state,
            left = _this$state.left,
            top = _this$state.top,
            quadrant = _this$state.quadrant;
        var halfandleSize = this.state.width / 2;
        var newQuadrant = 0;

        if (this.state.direction === 'x') {
          left += tx; //用 0.5 像素的偏移量，防止 left 与原点重叠

          if (round_1(left) === 0) {
            left = signX * 0.5;
          } //手柄发生移动之后，重新计算当前位于哪个象限或者坐标轴上


          if (left + halfandleSize - parentLocalOrigin.x > 0) {
            newQuadrant = 8;
          } else {
            newQuadrant = 7;
          }
        } else if (this.state.direction === 'y') {
          top += ty; //用 0.5 像素的偏移量，防止 top 与原点重叠

          if (round_1(top) === 0) {
            top = signY * 0.5;
          } //手柄发生移动之后，重新计算当前位于哪个象限或者坐标轴上


          if (top + halfandleSize - parentLocalOrigin.y > 0) {
            newQuadrant = 6;
          } else {
            newQuadrant = 5;
          }
        } else if (this.state.direction === 'xy') {
          //限制4个顶点位置的手柄只能沿着对角线移动，第1象限和第3象限可以交换位置，第2象限和第4象限可以交换位置。
          //矩形两条对角线过原点，直线解析式 y=kx 。
          //Canvas 中 Y 轴正向向下，与数学坐标反向，斜向右上角的对角线 k 值小于0，斜向右下角对角线 k 值大于 0 。
          var x1 = -parentWidth / 2;

          if (round_1(x1) === 0) {
            x1 = signX * 0.5;
          }

          var y1 = -parentHeight / 2;
          var k1 = y1 / x1;
          var x2 = parentWidth / 2;

          if (round_1(x2) === 0) {
            x2 = signX * 0.5;
          }

          var y2 = -parentHeight / 2;
          var k2 = y2 / x2; //子组件的 left/top 是相对于父组件的左上角位置的数值，而不是父组件移动原点之后的数值，换基到本地原点，然后基于斜率计算。
          //k=(top+halfandleSize-parentLocalOrigin.y+ty)/(left+halfandleSize-parentLocalOrigin.x+tx)
          //ty=k(left+halfandleSize-parentLocalOrigin.x+tx)-(top+halfandleSize-parentLocalOrigin.y)

          if (quadrant === 2 || quadrant == 4) {
            ty = k1 * (left + halfandleSize - parentLocalOrigin.x + tx) - (top + halfandleSize - parentLocalOrigin.y);
          } else {
            ty = k2 * (left + halfandleSize - parentLocalOrigin.x + tx) - (top + halfandleSize - parentLocalOrigin.y);
          }

          left += tx;
          top += ty; //手柄发生移动之后，重新计算当前位于哪个象限或者坐标轴上

          if (left + halfandleSize - parentLocalOrigin.x > 0) {
            if (top + halfandleSize - parentLocalOrigin.y > 0) {
              newQuadrant = 4;
            } else {
              newQuadrant = 1;
            }
          } else {
            if (top + halfandleSize - parentLocalOrigin.y > 0) {
              newQuadrant = 3;
            } else {
              newQuadrant = 2;
            }
          }
        } //可能需要和对面的手柄交换象限


        var quadrantSwitched = quadrant === newQuadrant ? false : true;

        if (quadrantSwitched) {
          this.parentNode.toggleControlQuadrant(this, newQuadrant);
        }

        this.setPosition(left, top, new ICEEvent(evt, {
          left: left,
          top: top,
          tx: tx,
          ty: ty,
          quadrant: newQuadrant
        }));
      }
    }]);

    return ResizeControl;
  }(ICERect);

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

  var RotateControl = /*#__PURE__*/function (_ICECircle) {
    _inherits(RotateControl, _ICECircle);

    var _super = _createSuper(RotateControl);

    function RotateControl(props) {
      var _this;

      _classCallCheck(this, RotateControl);

      _this = _super.call(this, props);

      _this.on('after-move', _this.rotateEvtHandler, _assertThisInitialized(_this));

      return _this;
    }

    _createClass(RotateControl, [{
      key: "rotateEvtHandler",
      value: function rotateEvtHandler(evt) {
        if (!this.parentNode) {
          //parentNode 是 TransformPanel
          return;
        } //计算手柄旋转角


        var parentOrigin = this.parentNode.state.absoluteOrigin;
        var rotateAngle = GeoUtil.calcRotateAngle(evt.offsetX, evt.offsetY, parentOrigin.x, parentOrigin.y); //parentNode 旋转角与手柄旋转角同步

        var param = {
          transform: {
            rotate: rotateAngle + 90 //旋转手柄默认处于逆时针 90 度位置，这里加 90 度进行补偿。

          }
        };
        this.parentNode.trigger('before-rotate', new ICEEvent(param));
        this.parentNode.setState(param);
        this.parentNode.trigger('after-rotate', new ICEEvent(param));
      }
    }]);

    return RotateControl;
  }(ICECircle);

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

  var TransformControlPanel = /*#__PURE__*/function (_ICEControlPanel) {
    _inherits(TransformControlPanel, _ICEControlPanel);

    var _super = _createSuper(TransformControlPanel);

    //TODO:改成可配置参数
    //TODO:改成可配置参数
    //TODO:改成可配置参数
    function TransformControlPanel(props) {
      var _this;

      _classCallCheck(this, TransformControlPanel);

      _this = _super.call(this, _objectSpread2(_objectSpread2({}, props), {}, {
        zIndex: Number.MAX_VALUE
      }));

      _defineProperty$1(_assertThisInitialized(_this), "rotateControlInstance", void 0);

      _defineProperty$1(_assertThisInitialized(_this), "rotateControlSize", 8);

      _defineProperty$1(_assertThisInitialized(_this), "rotateControlffsetY", 60);

      _defineProperty$1(_assertThisInitialized(_this), "resizeControlInstanceCache", []);

      _defineProperty$1(_assertThisInitialized(_this), "resizeControlSize", 16);

      _this.initControls();

      return _this;
    }
    /**
     * 添加尺寸和旋转变换手柄，初始化时添加在内部的[0,0]位置，此方法只创建对象实例，不执行渲染操作。
     * TODO:添加斜切手柄？
     */


    _createClass(TransformControlPanel, [{
      key: "initControls",
      value: function initControls() {
        var _this2 = this;

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
        var width = this.state.width;
        var height = this.state.height;
        var halfWidth = width / 2;
        var halfHeight = height / 2;
        var halfControlSize = this.resizeControlSize / 2;
        var resizeControlConfig = [{
          direction: 'xy',
          //可以移动的坐标轴
          quadrant: 2,
          //在组件本地坐标轴中的象限 @see ResizeControl
          position: new DOMPoint(-halfControlSize, -halfControlSize)
        }, {
          direction: 'y',
          quadrant: 5,
          position: new DOMPoint(halfWidth - halfControlSize, -halfControlSize)
        }, {
          direction: 'xy',
          quadrant: 1,
          position: new DOMPoint(width - halfControlSize, -halfControlSize)
        }, {
          direction: 'x',
          quadrant: 8,
          position: new DOMPoint(width - halfControlSize, halfHeight - halfControlSize)
        }, {
          direction: 'xy',
          quadrant: 4,
          position: new DOMPoint(width - halfControlSize, height - halfControlSize)
        }, {
          direction: 'y',
          quadrant: 6,
          position: new DOMPoint(halfWidth - halfControlSize, height - halfControlSize)
        }, {
          direction: 'xy',
          quadrant: 3,
          position: new DOMPoint(-halfControlSize, height - halfControlSize)
        }, {
          direction: 'x',
          quadrant: 7,
          position: new DOMPoint(-halfControlSize, halfHeight - halfControlSize)
        }];
        var counter = 1;
        this.resizeControlInstanceCache = [];
        resizeControlConfig.forEach(function (controlConfig) {
          var handleInstance = new ResizeControl({
            zIndex: Number.MAX_VALUE - counter++,
            left: controlConfig.position.x,
            top: controlConfig.position.y,
            width: _this2.resizeControlSize,
            height: _this2.resizeControlSize,
            //TODO: style 放到 props 中去变成可配置的参数
            style: {
              strokeStyle: '#8b0000',
              fillStyle: '#CC3300',
              lineWidth: 1
            },
            direction: controlConfig.direction,
            quadrant: controlConfig.quadrant
          });

          _this2.addChild(handleInstance);

          _this2.resizeControlInstanceCache.push(handleInstance);
        }); // 创建 1 个 RotateControl

        var left = this.state.width / 2 - this.rotateControlSize;
        var top = -this.rotateControlffsetY;
        this.rotateControlInstance = new RotateControl({
          zIndex: Number.MAX_VALUE - counter++,
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
    }, {
      key: "initEvents",
      value: function initEvents() {
        this.on('after-resize', this.resizeEvtHandler, this);
        this.on('after-rotate', this.rotateEvtHandler, this);
      }
    }, {
      key: "setControlPositions",
      value: function setControlPositions() {
        //重新计算所有 ResizeControl 的位置，共8个
        var width = this.state.width;
        var height = this.state.height;
        var halfWidth = width / 2;
        var halfHeight = height / 2;
        var halfControlSize = this.resizeControlSize / 2;
        this.resizeControlInstanceCache.forEach(function (resizeControl) {
          var quadrant = resizeControl.state.quadrant;
          var point = new DOMPoint();

          switch (quadrant) {
            case 1:
              point = new DOMPoint(width - halfControlSize, -halfControlSize);
              break;

            case 2:
              point = new DOMPoint(-halfControlSize, -halfControlSize);
              break;

            case 3:
              point = new DOMPoint(-halfControlSize, height - halfControlSize);
              break;

            case 4:
              point = new DOMPoint(width - halfControlSize, height - halfControlSize);
              break;

            case 5:
              point = new DOMPoint(halfWidth - halfControlSize, -halfControlSize);
              break;

            case 6:
              point = new DOMPoint(halfWidth - halfControlSize, height - halfControlSize);
              break;

            case 7:
              point = new DOMPoint(-halfControlSize, halfHeight - halfControlSize);
              break;

            case 8:
              point = new DOMPoint(width - halfControlSize, halfHeight - halfControlSize);
              break;
          }

          resizeControl.setState({
            left: point.x,
            top: point.y
          });
        }); //重新计算 RotateControl 的位置

        var left = this.state.width / 2 - this.rotateControlSize;
        var top = -this.rotateControlffsetY;
        this.rotateControlInstance.setState({
          left: left,
          top: top
        });
      }
    }, {
      key: "rotateEvtHandler",
      value: function rotateEvtHandler(evt) {
        if (!this.targetComponent) {
          return;
        }

        var rotate = this.state.transform.rotate;
        this.targetComponent.setGlobalRotate(rotate);
      }
    }, {
      key: "resizeEvtHandler",
      value: function resizeEvtHandler(evt) {
        if (!this.targetComponent) {
          return;
        }

        var quadrant = evt.quadrant;
        var movementX = evt.movementX / window.devicePixelRatio;
        var movementY = evt.movementY / window.devicePixelRatio;
        var targetState = this.targetComponent.state;
        var newLeft = targetState.left;
        var newTop = targetState.top;
        var newWidth = targetState.width;
        var newHeight = targetState.height;
        var matrix = targetState.absoluteLinearMatrix.inverse();
        var point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
        movementX = point.x;
        movementY = point.y;

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
    }, {
      key: "updatePosition",
      value: function updatePosition() {
        if (this.targetComponent) {
          var angle = this.targetComponent.getRotateAngle();

          var _this$targetComponent = this.targetComponent.getLocalLeftTop(),
              left = _this$targetComponent.left,
              top = _this$targetComponent.top,
              width = _this$targetComponent.width,
              height = _this$targetComponent.height;

          this.setState({
            left: left,
            top: top,
            width: width,
            height: height,
            transform: {
              rotate: angle
            }
          });
        }
      }
    }, {
      key: "followTargetComponent",
      value: function followTargetComponent(evt) {
        this.updatePosition();
      }
    }, {
      key: "targetComponent",
      get: function get() {
        return this._targetComponent;
      }
      /**
       * 交换两个 Control 的象限
       * @param control
       * @param quadrant
       */
      ,
      set: function set(component) {
        this._targetComponent = component;

        if (component) {
          this.updatePosition();
          component.on('after-move', this.followTargetComponent, this);
        } else {
          component.off('after-move', this.followTargetComponent, this);
        }
      }
    }, {
      key: "toggleControlQuadrant",
      value: function toggleControlQuadrant(control, quadrant) {
        //1-3可以交换，2-4可以交换，5-6可以交换，7-8可以交换
        this.resizeControlInstanceCache.forEach(function (item) {
          if (item.state.quadrant === quadrant) {
            var tempQuadrant = 0;

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
        });
        control.setState({
          quadrant: quadrant
        });
      }
    }]);

    return TransformControlPanel;
  }(ICEControlPanel);

  /**
   * @class ICEControlPanelManager
   *
   * 控制面板管理器
   *
   * - ICEControlPanelManager 负责管理所有类型的控制面板（ControlPanel）。
   * - ICEControlPanelManager 是全局单例的，一个 ICE 实例上只能有一个实例。
   * - ICEControlPanelManager 只需要设置 targetComponent 即可，拖拽移位操作由  DDManager 完成。
   *
   * @see ICE
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var ICEControlPanelManager = /*#__PURE__*/function () {
    //FIXME:这里需要重构，不同类型的组件需要展现不同的操作工具，操作工具可能会有 N 种，需要进一步抽象操作工具相关的逻辑。
    function ICEControlPanelManager(ice) {
      _classCallCheck(this, ICEControlPanelManager);

      _defineProperty$1(this, "ice", void 0);

      _defineProperty$1(this, "transformControlPanel", void 0);

      _defineProperty$1(this, "lineControlPanel", void 0);

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
      }); //在同一时刻，不可能同时出现多个 TransformControlPanel 实例，这里默认构造一个，放在距离可见区域很远的位置？？？
      //FIXME:需要测试是否会影响 toDataURL 的输出结果。

      this.ice.addChild(this.transformControlPanel);
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
      this.ice.addChild(this.lineControlPanel);
    } //FIXME:先取消选中列表中的原有对象的选中状态?
    //FIXME:ICEControlPanel 需要根据情况决定自己的外观和状态。


    _createClass(ICEControlPanelManager, [{
      key: "mouseDownHandler",
      value: function mouseDownHandler(evt) {
        var component = evt.target;

        if (!(component instanceof ICEBaseComponent)) {
          console.warn('ICEControlPanelManager: 点击在 canvas 画布上，没有点击任何图形。');
          return;
        }

        if (!component.state.interactive || !component.state.transformable) {
          //TODO:隐藏 ICEControlPanel
          //FIXME:需要清理事件
          this.ice.removeChild(this.transformControlPanel);
          this.ice.removeChild(this.lineControlPanel);
          return;
        } //只有 ICEControlPanel 和它内部的变换手柄才具备跟随鼠标移动的功能，其它组件都需要由 ICEControlPanel 驱动进行移动和变换。


        var isControlPanel = component && (component instanceof ICEControlPanel || component.parentNode instanceof ICEControlPanel);

        if (!isControlPanel) {
          //被点击的对象不是 ICEControlPanel 的实例，也不是 ICEControlPanel 内部的组件，说明点击了普通的组件。
          if (evt.ctrlKey) {
            this.ice.selectionList.push(component);
          } else {
            this.ice.selectionList = [component];
          }

          if (component instanceof ICEPolyLine) {
            this.lineControlPanel.targetComponent = component;
            this.lineControlPanel.showHooks();
          } else {
            this.lineControlPanel.hideHooks(); //FIXME:处理多选的情况，如果实现多选机制，会导致 N 层重叠的对象的处理出现麻烦。

            this.transformControlPanel.targetComponent = component;
          }
        }
      }
    }, {
      key: "start",
      value: function start() {
        this.ice.evtBus.on('mousedown', this.mouseDownHandler, this);
        return this;
      } //FIXME:

    }, {
      key: "stop",
      value: function stop() {}
    }]);

    return ICEControlPanelManager;
  }();

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
  var Easing = {
    /**
     * 线性变化
     * @param from 起始值
     * @param to  终止值
     * @param duration 持续时间，ms
     * @param startTime 动画开始时间
     */
    linear: function linear(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      return from + deltaValue / duration * deltaT;
    },
    easeInQuad: function easeInQuad(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      return from + deltaValue / duration * (deltaT / duration) * deltaT;
    },
    easeOutQuad: function easeOutQuad(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      return -deltaValue * (deltaT /= duration) * (deltaT - 2) + from;
    },
    easeInOutQuad: function easeInOutQuad(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      if ((deltaT /= duration / 2) < 1) return deltaValue / 2 * deltaT * deltaT + from;
      return -deltaValue / 2 * (--deltaT * (deltaT - 2) - 1) + from;
    },
    easeInQuart: function easeInQuart(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      return deltaValue * (deltaT /= duration) * deltaT * deltaT * deltaT + from;
    },
    easeOutQuart: function easeOutQuart(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      return -deltaValue * ((deltaT = deltaT / duration - 1) * deltaT * deltaT * deltaT - 1) + from;
    },
    easeInOutQuart: function easeInOutQuart(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      if ((deltaT /= duration / 2) < 1) return deltaValue / 2 * deltaT * deltaT * deltaT * deltaT + from;
      return -deltaValue / 2 * ((deltaT -= 2) * deltaT * deltaT * deltaT - 2) + from;
    },
    easeInCubic: function easeInCubic(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      return deltaValue * (deltaT /= duration) * deltaT * deltaT + from;
    },
    easeOutCubic: function easeOutCubic(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      return deltaValue * ((deltaT = deltaT / duration - 1) * deltaT * deltaT + 1) + from;
    },
    easeInOutCubic: function easeInOutCubic(from, to, duration, startTime) {
      var deltaT = Date.now() - startTime;
      var deltaValue = to - from;
      if ((deltaT /= duration / 2) < 1) return deltaValue / 2 * deltaT * deltaT * deltaT + from;
      return deltaValue / 2 * ((deltaT -= 2) * deltaT * deltaT + 2) + from;
    } //TODO:增加更多缓动算法

  };

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

  var AnimationManager = /*#__PURE__*/function () {
    //所有需要执行动画的元素都会被自动存入此列表中
    function AnimationManager(ice) {
      _classCallCheck(this, AnimationManager);

      _defineProperty$1(this, "animationMap", new Map());

      _defineProperty$1(this, "ice", void 0);

      this.ice = ice;
    }

    _createClass(AnimationManager, [{
      key: "start",
      value: function start() {
        var _this = this;

        this.ice.evtBus.on(ICE_CONSTS.ICE_FRAME_EVENT, function (evt) {
          _this.animationMap.forEach(function (el) {
            //在动画过程中，对象不响应鼠标或者触摸交互，防止影响属性值的计算。
            el.state.interactive = false;

            _this.tween(el);

            el.state.interactive = true;
          });
        });
        return this;
      } //TODO:处理无限循环播放的情况，处理播放次数的情况
      //TODO:每一个属性变化的持续时间不同，需要做同步处理，所有动画都执行完毕之后，需要把对象从动画列表中删除

    }, {
      key: "tween",
      value: function tween(el) {
        var newState = {};
        var animations = el.props.animations;
        var finishCounter = 1;

        for (var key in animations) {
          var animation = animations[key];

          if (animation.finished) {
            finishCounter++; //元素上的所有动画效果都已经执行完毕，从动画列表中删除， FIXME: 处理无限循环动画的问题

            if (finishCounter === Object.keys(animations).length) {
              this.remove(el);
              break;
            }

            continue;
          }

          var from = animation.from;
          var to = animation.to;
          var duration = animation.duration;

          if (isUndefined_1(animation.startTime)) {
            animation.startTime = Date.now();
          }

          if (isUndefined_1(animation.easing)) {
            animation.easing = 'linear';
          }

          var newValue = Easing[animation.easing](from, to, duration, animation.startTime);

          if (newValue > to) {
            newValue = to;
            animation.finished = true;
          }

          newState[key] = Math.floor(newValue); //使用整数个像素点
        }

        el.setState(_objectSpread2({}, newState));
        return el;
      }
    }, {
      key: "add",
      value: function add(component) {
        this.animationMap.set(component.props.id, component);
      }
    }, {
      key: "remove",
      value: function remove(el) {
        if (isString_1(el)) {
          this.animationMap["delete"](el);
        } else {
          this.animationMap["delete"](el.props.id);
        }
      } //FIXME:

    }, {
      key: "stop",
      value: function stop() {}
    }]);

    return AnimationManager;
  }();

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  var FrameManager = {
    evtBuses: [],
    frameCallback: function frameCallback() {
      FrameManager.evtBuses.forEach(function (evtBus) {
        evtBus.trigger(ICE_CONSTS.ICE_FRAME_EVENT);
      });
      root$2.requestAnimationFrame(FrameManager.frameCallback);
    },
    start: function start() {
      //TODO:为 Node 平台自定义一个 requestAnimationFrame 函数，签名、参数、调用方式全部相同。
      root$2.requestAnimationFrame(FrameManager.frameCallback);
    },
    stop: function stop() {},
    pause: function pause() {},
    resume: function resume() {},
    regitserEvtBus: function regitserEvtBus(evtBus) {
      if (FrameManager.evtBuses.includes(evtBus)) {
        return;
      }

      FrameManager.evtBuses.push(evtBus);
    },
    delEvtBus: function delEvtBus(evtBus) {
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
   * 原生 DOM 事件与 ICE 内部转发事件之间的对应关系
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  var mouseEvents = [['click', 'ICE_CLICK'], ['dbclick', 'ICE_DBCLICK'], ['mousedown', 'ICE_MOUSEDOWN'], ['mouseup', 'ICE_MOUSEUP'], ['mousemove', 'ICE_MOUSEMOVE'], ['mouseenter', 'ICE_MOUSEENTER'], ['mouseleave', 'ICE_MOUSELEAVE'], ['mouseout', 'ICE_MOUSEOUT'], ['mouseover', 'ICE_MOUSEOVER'], ['contextmenu', 'ICE_CONTEXTMENU'], ['mousewheel', 'ICE_MOUSEWHEEL']];

  /**
   * @class DOMEventBridge
   *
   * 事件桥接器，把原生 DOM 事件转发给 canvas 内部的组件。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var DOMEventBridge = /*#__PURE__*/function () {
    function DOMEventBridge(ice) {
      _classCallCheck(this, DOMEventBridge);

      _defineProperty$1(this, "selectionCandidates", []);

      _defineProperty$1(this, "ice", void 0);

      this.ice = ice;
    }

    _createClass(DOMEventBridge, [{
      key: "start",
      value: function start() {
        var _this = this;

        //FIXME:这里触发事件的频率太高，所有所有鼠标事件都会被触发出来。
        //FIXME:这里需要增加节流机制，防止触发事件的频率过高导致 CPU 飙升。
        mouseEvents.forEach(function (evtMapping) {
          _this.ice.evtBus.on(evtMapping[1], function (evt) {
            var component = _this.findTargetComponent(evt.clientX, evt.clientY);

            if (component) {
              evt.target = component;
              component.trigger(evtMapping[0], evt);
            }

            _this.ice.evtBus.trigger(evtMapping[0], evt); //this.ice.evtBus 本身一定会触发一次事件。

          });
        });
        return this;
      }
      /**
       * 找到被点击的对象，用代码触发 click 事件。
       * 在点击状态下，每次只能点击一个对象，当前不支持 DOM 冒泡特性。
       * FIXME:这里需要进行优化，当存在大量对象时，每一个对象都进行比较会有性能问题。
       *
       * @param clientX
       * @param clientY
       * @returns
       */

    }, {
      key: "findTargetComponent",
      value: function findTargetComponent(clientX, clientY) {
        var x = clientX - this.ice.canvasBoundingClientRect.left;
        var y = clientY - this.ice.canvasBoundingClientRect.top;
        var components = Array.from(this.ice.displayMap.values());

        for (var i = 0; i < components.length; i++) {
          var _component = components[i];
          this.traverse(x, y, _component);
        } //TODO: 按照 zIndex 倒排，然后取第0个元素。
        //TODO: 需要重构设置和修改 zIndex 参数的时机。


        this.selectionCandidates.sort(function (a, b) {
          return a.zIndex - b.zIndex;
        });
        var component = this.selectionCandidates[0];
        this.selectionCandidates = [];
        return component;
      }
      /**
       * 如果存在子组件，遍历。
       * @param x
       * @param y
       * @param component
       */

    }, {
      key: "traverse",
      value: function traverse(x, y, component) {
        var _this2 = this;

        if (component.childNodes && component.childNodes.length) {
          component.childNodes.forEach(function (child) {
            _this2.traverse(x, y, child);
          });
        }

        var flag = component.getMinBoundingBox().containsPoint(new DOMPoint(x, y));

        if (flag && component.state.interactive) {
          this.selectionCandidates.push(component);
        }
      }
    }]);

    return DOMEventBridge;
  }();

  /**
   * @class EventTarget
   * EventBus, global singleton.
   * EventBus 是 EventTarget 接口的实现类，ICE 内部的全局事件总线。
   * EventBus 的用途：
   * - 把外层 DOM 上的原生时间转发到 canvas 内部(mouse/keyboard/touch)
   * - requestAnimationFrame 触发的事件
   * - ICE 内部需要使用事件总线的实现
   *
   * @singleton
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  var EventBus = /*#__PURE__*/function (_EventTarget) {
    _inherits(EventBus, _EventTarget);

    var _super = _createSuper(EventBus);

    function EventBus() {

      _classCallCheck(this, EventBus);

      return _super.call(this);
    }

    return _createClass(EventBus);
  }(EventTarget);

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

  var MouseEventInterceptor = {
    //在同一个 window 中可能存在多个 ICE 实例，每一个 ICE 实例上都有一条事件总线，这里把多个事件总线实例隔开。
    evtBuses: [],
    start: function start() {
      if (root$2 && root$2 && root$2.addEventListener) {
        //所有原生 DOM 事件全部通过 EventBus 转发到 canvas 内部的对象上去
        //TODO:不同浏览器版本，以及 NodeJS 环境兼容性测试
        //FIXME:全部转发是否有性能问题？
        MouseEventInterceptor.evtBuses.forEach(function (evtBus) {
          mouseEvents.forEach(function (item) {
            root$2.addEventListener(item[0], function (evt) {
              evtBus.trigger(item[1], evt);
            });
          });
        });
      }
    },
    regitserEvtBus: function regitserEvtBus(evtBus) {
      if (MouseEventInterceptor.evtBuses.includes(evtBus)) {
        return;
      }

      MouseEventInterceptor.evtBuses.push(evtBus);
    },
    delEvtBus: function delEvtBus(evtBus) {
      if (!MouseEventInterceptor.evtBuses.includes(evtBus)) {
        return;
      }

      MouseEventInterceptor.evtBuses.splice(MouseEventInterceptor.evtBuses.indexOf(evtBus), 1);
    }
  };

  /**
   * @class CanvasRenderer
   * Canvas 渲染器，全局单例。
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  var CanvasRenderer = /*#__PURE__*/function () {
    function CanvasRenderer(ice) {
      _classCallCheck(this, CanvasRenderer);

      _defineProperty$1(this, "ice", void 0);

      this.ice = ice;
    }

    _createClass(CanvasRenderer, [{
      key: "renderRecursively",
      value: function renderRecursively(component) {
        var _this = this;

        component.trigger(ICE_CONSTS.BEFORE_RENDER);

        if (component.state.isRendering) {
          return;
        }

        if (!component.state.display) {
          return;
        } //先渲染自己


        component.render(); //如果有子节点，递归

        if (component.childNodes && component.childNodes.length) {
          component.childNodes.forEach(function (child) {
            //子组件的 root/ctx/evtBus/ice 这4个属性总是和父组件保持一致
            child.root = component.root;
            child.ctx = component.ctx;
            child.evtBus = component.evtBus;
            child.ice = component.ice;

            _this.renderRecursively(child);
          });
        }

        component.trigger(ICE_CONSTS.AFTER_RENDER);
      }
    }, {
      key: "start",
      value: function start() {
        var _this2 = this;

        this.ice.evtBus.on(ICE_CONSTS.ICE_FRAME_EVENT, function (evt) {
          //FIXME:fix this when using increamental rendering
          //FIXME:动画有闪烁
          _this2.ice.ctx.clearRect(0, 0, _this2.ice.canvasWidth, _this2.ice.canvasHeight);

          if (_this2.ice.displayMap && _this2.ice.displayMap.size) {
            //根据组件的 zIndex 升序排列，保证 zIndex 大的组件在后面绘制。
            var arr = Array.from(_this2.ice.displayMap, function (_ref) {
              var _ref2 = _slicedToArray(_ref, 2);
                  _ref2[0];
                  var value = _ref2[1];

              return value;
            });
            arr.sort(function (firstEl, secondEl) {
              return firstEl.state.zIndex - secondEl.state.zIndex;
            });
            arr.forEach(function (component) {
              _this2.renderRecursively(component);
            });
          }
        });
        return this;
      }
    }, {
      key: "stop",
      value: function stop() {
        throw new Error('Method not implemented.');
      }
    }]);

    return CanvasRenderer;
  }();

  /**
   * @class ICE
   *
   * ICE: Interactive Canvas Engine ， 交互式 canvas 渲染引擎。
   *
   * 同一个 &lt;canvas&gt; 标签上只能初始化一个 ICE 实例。
   *
   * FIXME:使用 TS 的 namespance 机制进行改造
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  var ICE = /*#__PURE__*/function () {
    //所有需要在 canvas 中渲染的对象都在此结构中 TODO:为了支持 zIndex 特性，需要改成数组，有堆叠顺序
    //事件总线，每一个 ICE 实例上只能有一个 evtBus 实例
    //在浏览器里面是 window 对象，在 NodeJS 环境里面是 global 对象
    //&lt;canvas&gt; tag
    //CanvasRenderingContext2D, @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
    //当前选中的组件列表，支持 Ctrl 键同时选中多个组件。
    function ICE() {
      _classCallCheck(this, ICE);

      _defineProperty$1(this, "version", pkg.version);

      _defineProperty$1(this, "displayMap", new Map());

      _defineProperty$1(this, "evtBus", void 0);

      _defineProperty$1(this, "root", void 0);

      _defineProperty$1(this, "canvasEl", void 0);

      _defineProperty$1(this, "ctx", void 0);

      _defineProperty$1(this, "canvasWidth", 0);

      _defineProperty$1(this, "canvasHeight", 0);

      _defineProperty$1(this, "canvasBoundingClientRect", void 0);

      _defineProperty$1(this, "selectionList", []);

      _defineProperty$1(this, "animationManager", void 0);

      _defineProperty$1(this, "eventBridge", void 0);

      _defineProperty$1(this, "ddManager", void 0);

      _defineProperty$1(this, "controlPanelManager", void 0);

      _defineProperty$1(this, "renderer", void 0);
    }
    /**
     * @param ctx DOM id or CanvasContext
     */


    _createClass(ICE, [{
      key: "init",
      value: function init(ctx) {
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


        this.evtBus = new EventBus();
        FrameManager.regitserEvtBus(this.evtBus);
        FrameManager.start();
        MouseEventInterceptor.regitserEvtBus(this.evtBus);
        MouseEventInterceptor.start();
        this.animationManager = new AnimationManager(this).start();
        this.eventBridge = new DOMEventBridge(this).start();
        this.ddManager = new DDManager(this).start();
        this.controlPanelManager = new ICEControlPanelManager(this).start();
        this.renderer = new CanvasRenderer(this).start();
        return this;
      }
      /**
       *
       * 调用 ICE.addChild() 方法，会直接把对象画在 canvas 上。
       * 如果需要在容器中画组件，参见 @see ICEGroup.addChild() 方法
       *
       * @param component
       */

    }, {
      key: "addChild",
      value: function addChild(component) {
        component.trigger(ICE_CONSTS.BEFORE_ADD);
        component.ice = this;
        component.root = this.root;
        component.ctx = this.ctx;
        component.evtBus = this.evtBus;
        this.displayMap.set(component.props.id, component);

        if (Object.keys(component.props.animations).length) {
          this.animationManager.add(component);
        }

        component.trigger(ICE_CONSTS.AFTER_ADD);
      }
    }, {
      key: "addChildren",
      value: function addChildren(arr) {
        var _this = this;

        arr.forEach(function (child) {
          _this.addChild(child);
        });
      }
    }, {
      key: "removeChild",
      value: function removeChild(component) {
        component.trigger(ICE_CONSTS.BEFORE_REMOVE);
        component.ice = null;
        component.ctx = null;
        component.root = null;
        component.evtBus = null;
        this.displayMap["delete"](component.props.id); //FIXME:如果被移除的是容器型组件，先移除并清理其子节点，然后再移除容器自身
        //FIXME:立即停止组件上的所有动画效果
        //FIXME:清理所有事件监听，然后再从结构中删除

        component.trigger(ICE_CONSTS.AFTER_REMOVE);
      }
    }, {
      key: "removeChildren",
      value: function removeChildren(arr) {
        var _this2 = this;

        arr.forEach(function (child) {
          _this2.removeChild(child);
        });
      }
    }, {
      key: "clearRenderMap",
      value: function clearRenderMap() {//FIXME:停止所有对象的动画效果
        //FIXME:清理所有事件监听，然后再从结构中删除
      }
    }, {
      key: "toJSON",
      value: function toJSON() {
        return '{}';
      }
    }, {
      key: "fromJSON",
      value: function fromJSON(jsonStr) {
        return {};
      } //FIXME:实现销毁 ICE 实例的过程

    }, {
      key: "destory",
      value: function destory() {}
    }]);

    return ICE;
  }();

  // import ICEStar from '../src/graphic/shape/ICEStar';

  let ice = new ICE().init('canvas-1');

  let len = 1000;
  let starTime = performance.now();
  for (let i = 0; i < len; i++) {
    let rect = new ICERect({
      left: Math.random() * 1024,
      top: Math.random() * 768,
      width: 100,
      height: 100,
      style: {
        strokeStyle: 'black',
        fillStyle: '#f00',
      },
    });
    ice.addChild(rect);
  }
  let endTime = performance.now();
  console.log('ICE.addChild() 方法执行了 ' + len + ' 次，耗时：' + (endTime - starTime) + 'ms');

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

  // let baseRect1 = new ICERect({
  //   left: 100,
  //   top: 100,
  //   width: 300,
  //   height: 200,
  //   style: {
  //     strokeStyle: '#0c09d4',
  //     fillStyle: '#f5d106',
  //     lineWidth: 5,
  //   },
  //   animations: {
  //     left: { from: 0, to: 500, duration: 1000, easing: 'easeInQuad' },
  //     top: { from: 0, to: 200, duration: 3000 },
  //     width: { from: 100, to: 200, duration: 5000 },
  //     height: { from: 100, to: 200, duration: 5000 },
  //   },
  //   transform: {
  //     // translate: [10, 10],
  //     rotate: 45,
  //     // skew: [20, 0],
  //     // scale: [1, 1],
  //   },
  // });
  // baseRect1.on('click', (evt) => {
  //   console.log('baseRect1');
  // });
  // ice.addChild(baseRect1);

  // let linkableRect1 = new ICELinkableRect({
  //   left: 100,
  //   top: 20,
  //   width: 100,
  //   height: 100,
  //   style: {
  //     strokeStyle: '#0c09d4',
  //     fillStyle: '#f5d106',
  //     lineWidth: 5,
  //   },
  //   animations: {
  //     left: { from: 0, to: 100, duration: 2000, easing: 'easeOutQuart' },
  //     // top: { from: 0, to: 200, duration: 3000 },
  //     width: { from: 100, to: 200, duration: 5000 },
  //     height: { from: 100, to: 200, duration: 5000 },
  //   },
  // });
  // ice.addChild(linkableRect1);

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

  // let visioLink = new ICEVisioLink({
  //   left: 0,
  //   top: 0,
  //   startPoint: [500, 500],
  //   endPoint: [700, 700],
  //   style: {
  //     strokeStyle: '#08ee00',
  //     fillStyle: '#008000',
  //     lineWidth: 5,
  //   },
  // });
  // ice.addChild(visioLink);

  // let linkCircle3 = new ICELinkableCircle({
  //   left: 100,
  //   top: 100,
  //   radius: 50,
  // });
  // ice.addChild(linkCircle3);
  // console.log(linkCircle3 instanceof ICECircle);

  // let linkCircle4 = new ICELinkableCircle({
  //   left: 500,
  //   top: 300,
  //   radius: 50,
  // });
  // ice.addChild(linkCircle4);
  // console.log(linkCircle4 instanceof ICECircle);

  // let linkEllipse1 = new ICELinkableEllipse({
  //   left: 200,
  //   top: 400,
  // });
  // ice.addChild(linkEllipse1);

  // let linkableRect = new ICELinkableRect({
  //   left: 100,
  //   top: 100,
  //   width: 200,
  //   height: 50,
  //   style: {
  //     strokeStyle: '#0c09d4',
  //     fillStyle: '#f5d106',
  //     lineWidth: 5,
  //   },
  //   // animations: {
  //   //   left: { from: 0, to: 500, duration: 1000, easing: 'easeInQuad' },
  //   //   top: { from: 0, to: 200, duration: 3000 },
  //   //   width: { from: 100, to: 200, duration: 5000 },
  //   //   height: { from: 100, to: 200, duration: 5000 },
  //   // },
  //   transform: {
  //     // translate: [10, 10],
  //     // rotate: 45,
  //     // skew: [20, 0],
  //     // scale: [1, 1],
  //   },
  // });
  // ice.addChild(linkableRect);

  // let linkableCircle = new ICELinkableCircle({
  //   left: 200,
  //   top: 500,
  //   radius: 30,
  // });
  // ice.addChild(linkableCircle);

  // let img = new ICELinkableImage({
  //   left: 100,
  //   top: 500,
  //   width: 100,
  //   height: 100,
  //   transform: {
  //     // translate: [10, 10],
  //     rotate: 45,
  //     // skew: [20, 0],
  //     scale: [1, 2],
  //   },
  // });
  // ice.addChild(img);

  // //正三角形
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

  // //正五边形
  // let isogon5 = new ICEIsogon({
  //   left: 500,
  //   top: 400,
  //   radius: 50,
  //   edges: 5,
  // });
  // ice.addChild(isogon5);

  // //正6边形
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
  //   edges: 6,
  //   // transform: {
  //   //   translate: [10, -10],
  //   //   scale: [0.3, 0.5],
  //   //   skew: [0.2, 0],
  //   //   rotate: 30,
  //   // },
  // });
  // star1.on('click', (evt) => {
  // });
  // ice.addChild(star1);

  // let text = new ICEText({
  //   left: 0,
  //   top: 400,
  //   text: 'Test long long long text...',
  //   style: {
  //     lineWidth: 5,
  //     font: '48px serif',
  //     strokeStyle: '#ff3300',
  //     fillStyle: '#00ff00',
  //   },
  // });
  // ice.addChild(text);

  // let p1 = new DOMPoint(0, 100);
  // let p2 = new DOMPoint(150, 100);
  // let p3 = new DOMPoint(150, 200);
  // let p4 = new DOMPoint(0, 200);
  // let path = new ICEDotPath({ dots: [p1, p2, p3, p4] });
  // ice.addChild(path);

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
  //     scale: [1.2, 1.2],
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

  // let group1 = new ICEGroup({
  //   left: 100,
  //   top: 100,
  //   width: 100,
  //   height: 100,
  //   style: {
  //     strokeStyle: '#fa0404',
  //     fillStyle: '#beffff',
  //     lineWidth: 1,
  //   },
  //   transform: {
  //     // translate: [10, -10],
  //     // scale: [1, 1],
  //     rotate: 45,
  //   },
  // });
  // ice.addChild(group1);

  // let circle1 = new ICECircle({
  //   left: 0,
  //   top: 0,
  //   radius: 10,
  // });
  // group1.addChild(circle1);

  // let rect5 = new ICERect({
  //   left: 10,
  //   top: 10,
  //   with: 10,
  //   height: 10,
  // });
  // group1.addChild(rect5);

  // let rect6 = new ICERect({
  //   left: 600,
  //   top: 100,
  //   width: 400,
  //   height: 200,
  // });
  // ice.addChild(rect6);

  // let ellipse = new ICEEllipse({
  //   left: 100,
  //   top: 600,
  //   radiusX: 50,
  //   radiusY: 30,
  // });
  // ice.addChild(ellipse);

  // let circle2 = new ICECircle({
  //   left: 100,
  //   top: 200,
  //   radius: 50,
  // });
  // ice.addChild(circle2);

  // let group2 = new ICEGroup({
  //   left: 20,
  //   top: 20,
  //   width: 100,
  //   height: 100,
  //   style: {
  //     strokeStyle: '#8b0000',
  //     fillStyle: '#99FFFF',
  //     lineWidth: 1,
  //   },
  //   // transform: {
  //   //   translate: [10, -10],
  //   //   scale: [1, 1],
  //   //   rotate: 10,
  //   // },
  // });
  // ice.addChild(group2);

  // let circle3 = new ICECircle({
  //   left: 0,
  //   top: 0,
  //   radius: 10,
  // });
  // group2.addChild(circle3);

  // let circle4 = new ICECircle({
  //   left: 20,
  //   top: 20,
  //   radius: 20,
  // });
  // group2.addChild(circle4);

  // let rect2 = new ICERect({
  //   left: 200,
  //   top: 200,
  //   width: 200,
  //   height: 100,
  //   style: {
  //     strokeStyle: '#e01414',
  //     fillStyle: '#46ca46',
  //     lineWidth: 3,
  //   },
  //   transform: {
  //     // translate: [10, -10],
  //     scale: [1, 1],
  //     rotate: 20,
  //   },
  // });
  // ice.addChild(rect2);

  // let circle3 = new ICECircle({
  //   left: 0,
  //   top: 0,
  //   radius: 10,
  // });
  // ice.addChild(circle3);

  // let th = new TransformPanel({
  //   left: 400,
  //   top: 100,
  //   width: 100,
  //   height: 100,
  //   style: {
  //     strokeStyle: '#8b0000',
  //     fillStyle: '#99FFFF',
  //     lineWidth: 1,
  //   },
  // });
  // ice.addChild(th);

}));
