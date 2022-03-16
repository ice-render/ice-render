(function (factory) {
  typeof define === 'function' && define.amd ? define(factory) :
  factory();
}((function () { 'use strict';

  function _defineProperty(obj, key, value) {
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

  var IDX=256, HEX=[], BUFFER;
  while (IDX--) HEX[IDX] = (IDX + 256).toString(16).substring(1);

  function v4() {
  	var i=0, num, out='';

  	if (!BUFFER || ((IDX + 16) > 256)) {
  		BUFFER = Array(i=256);
  		while (i--) BUFFER[i] = 256 * Math.random() | 0;
  		i = IDX = 0;
  	}

  	for (; i < 16; i++) {
  		num = BUFFER[IDX + i];
  		if (i==6) out += HEX[num & 15 | 64];
  		else if (i==8) out += HEX[num & 63 | 128];
  		else out += HEX[num];

  		if (i & 1 && i > 1 && i < 11) out += '-';
  	}

  	IDX++;
  	return out;
  }

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
  var isArray = Array.isArray;

  var isArray_1 = isArray;

  var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

  function createCommonjsModule(fn, module) {
  	return module = { exports: {} }, fn(module, module.exports), module.exports;
  }

  /** Detect free variable `global` from Node.js. */
  var freeGlobal = typeof commonjsGlobal == 'object' && commonjsGlobal && commonjsGlobal.Object === Object && commonjsGlobal;

  var _freeGlobal = freeGlobal;

  /** Detect free variable `self`. */
  var freeSelf = typeof self == 'object' && self && self.Object === Object && self;

  /** Used as a reference to the global object. */
  var root = _freeGlobal || freeSelf || Function('return this')();

  var _root = root;

  /** Built-in value references. */
  var Symbol = _root.Symbol;

  var _Symbol = Symbol;

  /** Used for built-in method references. */
  var objectProto = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty = objectProto.hasOwnProperty;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var nativeObjectToString = objectProto.toString;

  /** Built-in value references. */
  var symToStringTag = _Symbol ? _Symbol.toStringTag : undefined;

  /**
   * A specialized version of `baseGetTag` which ignores `Symbol.toStringTag` values.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the raw `toStringTag`.
   */
  function getRawTag(value) {
    var isOwn = hasOwnProperty.call(value, symToStringTag),
        tag = value[symToStringTag];

    try {
      value[symToStringTag] = undefined;
      var unmasked = true;
    } catch (e) {}

    var result = nativeObjectToString.call(value);
    if (unmasked) {
      if (isOwn) {
        value[symToStringTag] = tag;
      } else {
        delete value[symToStringTag];
      }
    }
    return result;
  }

  var _getRawTag = getRawTag;

  /** Used for built-in method references. */
  var objectProto$1 = Object.prototype;

  /**
   * Used to resolve the
   * [`toStringTag`](http://ecma-international.org/ecma-262/7.0/#sec-object.prototype.tostring)
   * of values.
   */
  var nativeObjectToString$1 = objectProto$1.toString;

  /**
   * Converts `value` to a string using `Object.prototype.toString`.
   *
   * @private
   * @param {*} value The value to convert.
   * @returns {string} Returns the converted string.
   */
  function objectToString(value) {
    return nativeObjectToString$1.call(value);
  }

  var _objectToString = objectToString;

  /** `Object#toString` result references. */
  var nullTag = '[object Null]',
      undefinedTag = '[object Undefined]';

  /** Built-in value references. */
  var symToStringTag$1 = _Symbol ? _Symbol.toStringTag : undefined;

  /**
   * The base implementation of `getTag` without fallbacks for buggy environments.
   *
   * @private
   * @param {*} value The value to query.
   * @returns {string} Returns the `toStringTag`.
   */
  function baseGetTag(value) {
    if (value == null) {
      return value === undefined ? undefinedTag : nullTag;
    }
    return (symToStringTag$1 && symToStringTag$1 in Object(value))
      ? _getRawTag(value)
      : _objectToString(value);
  }

  var _baseGetTag = baseGetTag;

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
  function isObjectLike(value) {
    return value != null && typeof value == 'object';
  }

  var isObjectLike_1 = isObjectLike;

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
  function isSymbol(value) {
    return typeof value == 'symbol' ||
      (isObjectLike_1(value) && _baseGetTag(value) == symbolTag);
  }

  var isSymbol_1 = isSymbol;

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
  function isKey(value, object) {
    if (isArray_1(value)) {
      return false;
    }
    var type = typeof value;
    if (type == 'number' || type == 'symbol' || type == 'boolean' ||
        value == null || isSymbol_1(value)) {
      return true;
    }
    return reIsPlainProp.test(value) || !reIsDeepProp.test(value) ||
      (object != null && value in Object(object));
  }

  var _isKey = isKey;

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
  function isObject(value) {
    var type = typeof value;
    return value != null && (type == 'object' || type == 'function');
  }

  var isObject_1 = isObject;

  /** `Object#toString` result references. */
  var asyncTag = '[object AsyncFunction]',
      funcTag = '[object Function]',
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
  function isFunction(value) {
    if (!isObject_1(value)) {
      return false;
    }
    // The use of `Object#toString` avoids issues with the `typeof` operator
    // in Safari 9 which returns 'object' for typed arrays and other constructors.
    var tag = _baseGetTag(value);
    return tag == funcTag || tag == genTag || tag == asyncTag || tag == proxyTag;
  }

  var isFunction_1 = isFunction;

  /** Used to detect overreaching core-js shims. */
  var coreJsData = _root['__core-js_shared__'];

  var _coreJsData = coreJsData;

  /** Used to detect methods masquerading as native. */
  var maskSrcKey = (function() {
    var uid = /[^.]+$/.exec(_coreJsData && _coreJsData.keys && _coreJsData.keys.IE_PROTO || '');
    return uid ? ('Symbol(src)_1.' + uid) : '';
  }());

  /**
   * Checks if `func` has its source masked.
   *
   * @private
   * @param {Function} func The function to check.
   * @returns {boolean} Returns `true` if `func` is masked, else `false`.
   */
  function isMasked(func) {
    return !!maskSrcKey && (maskSrcKey in func);
  }

  var _isMasked = isMasked;

  /** Used for built-in method references. */
  var funcProto = Function.prototype;

  /** Used to resolve the decompiled source of functions. */
  var funcToString = funcProto.toString;

  /**
   * Converts `func` to its source code.
   *
   * @private
   * @param {Function} func The function to convert.
   * @returns {string} Returns the source code.
   */
  function toSource(func) {
    if (func != null) {
      try {
        return funcToString.call(func);
      } catch (e) {}
      try {
        return (func + '');
      } catch (e) {}
    }
    return '';
  }

  var _toSource = toSource;

  /**
   * Used to match `RegExp`
   * [syntax characters](http://ecma-international.org/ecma-262/7.0/#sec-patterns).
   */
  var reRegExpChar = /[\\^$.*+?()[\]{}|]/g;

  /** Used to detect host constructors (Safari). */
  var reIsHostCtor = /^\[object .+?Constructor\]$/;

  /** Used for built-in method references. */
  var funcProto$1 = Function.prototype,
      objectProto$2 = Object.prototype;

  /** Used to resolve the decompiled source of functions. */
  var funcToString$1 = funcProto$1.toString;

  /** Used to check objects for own properties. */
  var hasOwnProperty$1 = objectProto$2.hasOwnProperty;

  /** Used to detect if a method is native. */
  var reIsNative = RegExp('^' +
    funcToString$1.call(hasOwnProperty$1).replace(reRegExpChar, '\\$&')
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
  function baseIsNative(value) {
    if (!isObject_1(value) || _isMasked(value)) {
      return false;
    }
    var pattern = isFunction_1(value) ? reIsNative : reIsHostCtor;
    return pattern.test(_toSource(value));
  }

  var _baseIsNative = baseIsNative;

  /**
   * Gets the value at `key` of `object`.
   *
   * @private
   * @param {Object} [object] The object to query.
   * @param {string} key The key of the property to get.
   * @returns {*} Returns the property value.
   */
  function getValue(object, key) {
    return object == null ? undefined : object[key];
  }

  var _getValue = getValue;

  /**
   * Gets the native function at `key` of `object`.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {string} key The key of the method to get.
   * @returns {*} Returns the function if it's native, else `undefined`.
   */
  function getNative(object, key) {
    var value = _getValue(object, key);
    return _baseIsNative(value) ? value : undefined;
  }

  var _getNative = getNative;

  /* Built-in method references that are verified to be native. */
  var nativeCreate = _getNative(Object, 'create');

  var _nativeCreate = nativeCreate;

  /**
   * Removes all key-value entries from the hash.
   *
   * @private
   * @name clear
   * @memberOf Hash
   */
  function hashClear() {
    this.__data__ = _nativeCreate ? _nativeCreate(null) : {};
    this.size = 0;
  }

  var _hashClear = hashClear;

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
  function hashDelete(key) {
    var result = this.has(key) && delete this.__data__[key];
    this.size -= result ? 1 : 0;
    return result;
  }

  var _hashDelete = hashDelete;

  /** Used to stand-in for `undefined` hash values. */
  var HASH_UNDEFINED = '__lodash_hash_undefined__';

  /** Used for built-in method references. */
  var objectProto$3 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$2 = objectProto$3.hasOwnProperty;

  /**
   * Gets the hash value for `key`.
   *
   * @private
   * @name get
   * @memberOf Hash
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function hashGet(key) {
    var data = this.__data__;
    if (_nativeCreate) {
      var result = data[key];
      return result === HASH_UNDEFINED ? undefined : result;
    }
    return hasOwnProperty$2.call(data, key) ? data[key] : undefined;
  }

  var _hashGet = hashGet;

  /** Used for built-in method references. */
  var objectProto$4 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$3 = objectProto$4.hasOwnProperty;

  /**
   * Checks if a hash value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf Hash
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function hashHas(key) {
    var data = this.__data__;
    return _nativeCreate ? (data[key] !== undefined) : hasOwnProperty$3.call(data, key);
  }

  var _hashHas = hashHas;

  /** Used to stand-in for `undefined` hash values. */
  var HASH_UNDEFINED$1 = '__lodash_hash_undefined__';

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
  function hashSet(key, value) {
    var data = this.__data__;
    this.size += this.has(key) ? 0 : 1;
    data[key] = (_nativeCreate && value === undefined) ? HASH_UNDEFINED$1 : value;
    return this;
  }

  var _hashSet = hashSet;

  /**
   * Creates a hash object.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function Hash(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  // Add methods to `Hash`.
  Hash.prototype.clear = _hashClear;
  Hash.prototype['delete'] = _hashDelete;
  Hash.prototype.get = _hashGet;
  Hash.prototype.has = _hashHas;
  Hash.prototype.set = _hashSet;

  var _Hash = Hash;

  /**
   * Removes all key-value entries from the list cache.
   *
   * @private
   * @name clear
   * @memberOf ListCache
   */
  function listCacheClear() {
    this.__data__ = [];
    this.size = 0;
  }

  var _listCacheClear = listCacheClear;

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
  function eq(value, other) {
    return value === other || (value !== value && other !== other);
  }

  var eq_1 = eq;

  /**
   * Gets the index at which the `key` is found in `array` of key-value pairs.
   *
   * @private
   * @param {Array} array The array to inspect.
   * @param {*} key The key to search for.
   * @returns {number} Returns the index of the matched value, else `-1`.
   */
  function assocIndexOf(array, key) {
    var length = array.length;
    while (length--) {
      if (eq_1(array[length][0], key)) {
        return length;
      }
    }
    return -1;
  }

  var _assocIndexOf = assocIndexOf;

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
  function listCacheDelete(key) {
    var data = this.__data__,
        index = _assocIndexOf(data, key);

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

  var _listCacheDelete = listCacheDelete;

  /**
   * Gets the list cache value for `key`.
   *
   * @private
   * @name get
   * @memberOf ListCache
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function listCacheGet(key) {
    var data = this.__data__,
        index = _assocIndexOf(data, key);

    return index < 0 ? undefined : data[index][1];
  }

  var _listCacheGet = listCacheGet;

  /**
   * Checks if a list cache value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf ListCache
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function listCacheHas(key) {
    return _assocIndexOf(this.__data__, key) > -1;
  }

  var _listCacheHas = listCacheHas;

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
  function listCacheSet(key, value) {
    var data = this.__data__,
        index = _assocIndexOf(data, key);

    if (index < 0) {
      ++this.size;
      data.push([key, value]);
    } else {
      data[index][1] = value;
    }
    return this;
  }

  var _listCacheSet = listCacheSet;

  /**
   * Creates an list cache object.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function ListCache(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  // Add methods to `ListCache`.
  ListCache.prototype.clear = _listCacheClear;
  ListCache.prototype['delete'] = _listCacheDelete;
  ListCache.prototype.get = _listCacheGet;
  ListCache.prototype.has = _listCacheHas;
  ListCache.prototype.set = _listCacheSet;

  var _ListCache = ListCache;

  /* Built-in method references that are verified to be native. */
  var Map$1 = _getNative(_root, 'Map');

  var _Map = Map$1;

  /**
   * Removes all key-value entries from the map.
   *
   * @private
   * @name clear
   * @memberOf MapCache
   */
  function mapCacheClear() {
    this.size = 0;
    this.__data__ = {
      'hash': new _Hash,
      'map': new (_Map || _ListCache),
      'string': new _Hash
    };
  }

  var _mapCacheClear = mapCacheClear;

  /**
   * Checks if `value` is suitable for use as unique object key.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is suitable, else `false`.
   */
  function isKeyable(value) {
    var type = typeof value;
    return (type == 'string' || type == 'number' || type == 'symbol' || type == 'boolean')
      ? (value !== '__proto__')
      : (value === null);
  }

  var _isKeyable = isKeyable;

  /**
   * Gets the data for `map`.
   *
   * @private
   * @param {Object} map The map to query.
   * @param {string} key The reference key.
   * @returns {*} Returns the map data.
   */
  function getMapData(map, key) {
    var data = map.__data__;
    return _isKeyable(key)
      ? data[typeof key == 'string' ? 'string' : 'hash']
      : data.map;
  }

  var _getMapData = getMapData;

  /**
   * Removes `key` and its value from the map.
   *
   * @private
   * @name delete
   * @memberOf MapCache
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */
  function mapCacheDelete(key) {
    var result = _getMapData(this, key)['delete'](key);
    this.size -= result ? 1 : 0;
    return result;
  }

  var _mapCacheDelete = mapCacheDelete;

  /**
   * Gets the map value for `key`.
   *
   * @private
   * @name get
   * @memberOf MapCache
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function mapCacheGet(key) {
    return _getMapData(this, key).get(key);
  }

  var _mapCacheGet = mapCacheGet;

  /**
   * Checks if a map value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf MapCache
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function mapCacheHas(key) {
    return _getMapData(this, key).has(key);
  }

  var _mapCacheHas = mapCacheHas;

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
  function mapCacheSet(key, value) {
    var data = _getMapData(this, key),
        size = data.size;

    data.set(key, value);
    this.size += data.size == size ? 0 : 1;
    return this;
  }

  var _mapCacheSet = mapCacheSet;

  /**
   * Creates a map cache object to store key-value pairs.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function MapCache(entries) {
    var index = -1,
        length = entries == null ? 0 : entries.length;

    this.clear();
    while (++index < length) {
      var entry = entries[index];
      this.set(entry[0], entry[1]);
    }
  }

  // Add methods to `MapCache`.
  MapCache.prototype.clear = _mapCacheClear;
  MapCache.prototype['delete'] = _mapCacheDelete;
  MapCache.prototype.get = _mapCacheGet;
  MapCache.prototype.has = _mapCacheHas;
  MapCache.prototype.set = _mapCacheSet;

  var _MapCache = MapCache;

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
  function memoize(func, resolver) {
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
    memoized.cache = new (memoize.Cache || _MapCache);
    return memoized;
  }

  // Expose `MapCache`.
  memoize.Cache = _MapCache;

  var memoize_1 = memoize;

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
  function memoizeCapped(func) {
    var result = memoize_1(func, function(key) {
      if (cache.size === MAX_MEMOIZE_SIZE) {
        cache.clear();
      }
      return key;
    });

    var cache = result.cache;
    return result;
  }

  var _memoizeCapped = memoizeCapped;

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
  var stringToPath = _memoizeCapped(function(string) {
    var result = [];
    if (string.charCodeAt(0) === 46 /* . */) {
      result.push('');
    }
    string.replace(rePropName, function(match, number, quote, subString) {
      result.push(quote ? subString.replace(reEscapeChar, '$1') : (number || match));
    });
    return result;
  });

  var _stringToPath = stringToPath;

  /**
   * A specialized version of `_.map` for arrays without support for iteratee
   * shorthands.
   *
   * @private
   * @param {Array} [array] The array to iterate over.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array} Returns the new mapped array.
   */
  function arrayMap(array, iteratee) {
    var index = -1,
        length = array == null ? 0 : array.length,
        result = Array(length);

    while (++index < length) {
      result[index] = iteratee(array[index], index, array);
    }
    return result;
  }

  var _arrayMap = arrayMap;

  /** Used as references for various `Number` constants. */
  var INFINITY = 1 / 0;

  /** Used to convert symbols to primitives and strings. */
  var symbolProto = _Symbol ? _Symbol.prototype : undefined,
      symbolToString = symbolProto ? symbolProto.toString : undefined;

  /**
   * The base implementation of `_.toString` which doesn't convert nullish
   * values to empty strings.
   *
   * @private
   * @param {*} value The value to process.
   * @returns {string} Returns the string.
   */
  function baseToString(value) {
    // Exit early for strings to avoid a performance hit in some environments.
    if (typeof value == 'string') {
      return value;
    }
    if (isArray_1(value)) {
      // Recursively convert values (susceptible to call stack limits).
      return _arrayMap(value, baseToString) + '';
    }
    if (isSymbol_1(value)) {
      return symbolToString ? symbolToString.call(value) : '';
    }
    var result = (value + '');
    return (result == '0' && (1 / value) == -INFINITY) ? '-0' : result;
  }

  var _baseToString = baseToString;

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
  function toString(value) {
    return value == null ? '' : _baseToString(value);
  }

  var toString_1 = toString;

  /**
   * Casts `value` to a path array if it's not one.
   *
   * @private
   * @param {*} value The value to inspect.
   * @param {Object} [object] The object to query keys on.
   * @returns {Array} Returns the cast property path array.
   */
  function castPath(value, object) {
    if (isArray_1(value)) {
      return value;
    }
    return _isKey(value, object) ? [value] : _stringToPath(toString_1(value));
  }

  var _castPath = castPath;

  /** Used as references for various `Number` constants. */
  var INFINITY$1 = 1 / 0;

  /**
   * Converts `value` to a string key if it's not a string or symbol.
   *
   * @private
   * @param {*} value The value to inspect.
   * @returns {string|symbol} Returns the key.
   */
  function toKey(value) {
    if (typeof value == 'string' || isSymbol_1(value)) {
      return value;
    }
    var result = (value + '');
    return (result == '0' && (1 / value) == -INFINITY$1) ? '-0' : result;
  }

  var _toKey = toKey;

  /**
   * The base implementation of `_.get` without support for default values.
   *
   * @private
   * @param {Object} object The object to query.
   * @param {Array|string} path The path of the property to get.
   * @returns {*} Returns the resolved value.
   */
  function baseGet(object, path) {
    path = _castPath(path, object);

    var index = 0,
        length = path.length;

    while (object != null && index < length) {
      object = object[_toKey(path[index++])];
    }
    return (index && index == length) ? object : undefined;
  }

  var _baseGet = baseGet;

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
    var result = object == null ? undefined : _baseGet(object, path);
    return result === undefined ? defaultValue : result;
  }

  var get_1 = get;

  /**
   * Removes all key-value entries from the stack.
   *
   * @private
   * @name clear
   * @memberOf Stack
   */
  function stackClear() {
    this.__data__ = new _ListCache;
    this.size = 0;
  }

  var _stackClear = stackClear;

  /**
   * Removes `key` and its value from the stack.
   *
   * @private
   * @name delete
   * @memberOf Stack
   * @param {string} key The key of the value to remove.
   * @returns {boolean} Returns `true` if the entry was removed, else `false`.
   */
  function stackDelete(key) {
    var data = this.__data__,
        result = data['delete'](key);

    this.size = data.size;
    return result;
  }

  var _stackDelete = stackDelete;

  /**
   * Gets the stack value for `key`.
   *
   * @private
   * @name get
   * @memberOf Stack
   * @param {string} key The key of the value to get.
   * @returns {*} Returns the entry value.
   */
  function stackGet(key) {
    return this.__data__.get(key);
  }

  var _stackGet = stackGet;

  /**
   * Checks if a stack value for `key` exists.
   *
   * @private
   * @name has
   * @memberOf Stack
   * @param {string} key The key of the entry to check.
   * @returns {boolean} Returns `true` if an entry for `key` exists, else `false`.
   */
  function stackHas(key) {
    return this.__data__.has(key);
  }

  var _stackHas = stackHas;

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
  function stackSet(key, value) {
    var data = this.__data__;
    if (data instanceof _ListCache) {
      var pairs = data.__data__;
      if (!_Map || (pairs.length < LARGE_ARRAY_SIZE - 1)) {
        pairs.push([key, value]);
        this.size = ++data.size;
        return this;
      }
      data = this.__data__ = new _MapCache(pairs);
    }
    data.set(key, value);
    this.size = data.size;
    return this;
  }

  var _stackSet = stackSet;

  /**
   * Creates a stack cache object to store key-value pairs.
   *
   * @private
   * @constructor
   * @param {Array} [entries] The key-value pairs to cache.
   */
  function Stack(entries) {
    var data = this.__data__ = new _ListCache(entries);
    this.size = data.size;
  }

  // Add methods to `Stack`.
  Stack.prototype.clear = _stackClear;
  Stack.prototype['delete'] = _stackDelete;
  Stack.prototype.get = _stackGet;
  Stack.prototype.has = _stackHas;
  Stack.prototype.set = _stackSet;

  var _Stack = Stack;

  var defineProperty = (function() {
    try {
      var func = _getNative(Object, 'defineProperty');
      func({}, '', {});
      return func;
    } catch (e) {}
  }());

  var _defineProperty$1 = defineProperty;

  /**
   * The base implementation of `assignValue` and `assignMergeValue` without
   * value checks.
   *
   * @private
   * @param {Object} object The object to modify.
   * @param {string} key The key of the property to assign.
   * @param {*} value The value to assign.
   */
  function baseAssignValue(object, key, value) {
    if (key == '__proto__' && _defineProperty$1) {
      _defineProperty$1(object, key, {
        'configurable': true,
        'enumerable': true,
        'value': value,
        'writable': true
      });
    } else {
      object[key] = value;
    }
  }

  var _baseAssignValue = baseAssignValue;

  /**
   * This function is like `assignValue` except that it doesn't assign
   * `undefined` values.
   *
   * @private
   * @param {Object} object The object to modify.
   * @param {string} key The key of the property to assign.
   * @param {*} value The value to assign.
   */
  function assignMergeValue(object, key, value) {
    if ((value !== undefined && !eq_1(object[key], value)) ||
        (value === undefined && !(key in object))) {
      _baseAssignValue(object, key, value);
    }
  }

  var _assignMergeValue = assignMergeValue;

  /**
   * Creates a base function for methods like `_.forIn` and `_.forOwn`.
   *
   * @private
   * @param {boolean} [fromRight] Specify iterating from right to left.
   * @returns {Function} Returns the new base function.
   */
  function createBaseFor(fromRight) {
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

  var _createBaseFor = createBaseFor;

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
  var baseFor = _createBaseFor();

  var _baseFor = baseFor;

  var _cloneBuffer = createCommonjsModule(function (module, exports) {
  /** Detect free variable `exports`. */
  var freeExports =  exports && !exports.nodeType && exports;

  /** Detect free variable `module`. */
  var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports;

  /** Built-in value references. */
  var Buffer = moduleExports ? _root.Buffer : undefined,
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
  });

  /** Built-in value references. */
  var Uint8Array = _root.Uint8Array;

  var _Uint8Array = Uint8Array;

  /**
   * Creates a clone of `arrayBuffer`.
   *
   * @private
   * @param {ArrayBuffer} arrayBuffer The array buffer to clone.
   * @returns {ArrayBuffer} Returns the cloned array buffer.
   */
  function cloneArrayBuffer(arrayBuffer) {
    var result = new arrayBuffer.constructor(arrayBuffer.byteLength);
    new _Uint8Array(result).set(new _Uint8Array(arrayBuffer));
    return result;
  }

  var _cloneArrayBuffer = cloneArrayBuffer;

  /**
   * Creates a clone of `typedArray`.
   *
   * @private
   * @param {Object} typedArray The typed array to clone.
   * @param {boolean} [isDeep] Specify a deep clone.
   * @returns {Object} Returns the cloned typed array.
   */
  function cloneTypedArray(typedArray, isDeep) {
    var buffer = isDeep ? _cloneArrayBuffer(typedArray.buffer) : typedArray.buffer;
    return new typedArray.constructor(buffer, typedArray.byteOffset, typedArray.length);
  }

  var _cloneTypedArray = cloneTypedArray;

  /**
   * Copies the values of `source` to `array`.
   *
   * @private
   * @param {Array} source The array to copy values from.
   * @param {Array} [array=[]] The array to copy values to.
   * @returns {Array} Returns `array`.
   */
  function copyArray(source, array) {
    var index = -1,
        length = source.length;

    array || (array = Array(length));
    while (++index < length) {
      array[index] = source[index];
    }
    return array;
  }

  var _copyArray = copyArray;

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
  var baseCreate = (function() {
    function object() {}
    return function(proto) {
      if (!isObject_1(proto)) {
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

  var _baseCreate = baseCreate;

  /**
   * Creates a unary function that invokes `func` with its argument transformed.
   *
   * @private
   * @param {Function} func The function to wrap.
   * @param {Function} transform The argument transform.
   * @returns {Function} Returns the new function.
   */
  function overArg(func, transform) {
    return function(arg) {
      return func(transform(arg));
    };
  }

  var _overArg = overArg;

  /** Built-in value references. */
  var getPrototype = _overArg(Object.getPrototypeOf, Object);

  var _getPrototype = getPrototype;

  /** Used for built-in method references. */
  var objectProto$5 = Object.prototype;

  /**
   * Checks if `value` is likely a prototype object.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a prototype, else `false`.
   */
  function isPrototype(value) {
    var Ctor = value && value.constructor,
        proto = (typeof Ctor == 'function' && Ctor.prototype) || objectProto$5;

    return value === proto;
  }

  var _isPrototype = isPrototype;

  /**
   * Initializes an object clone.
   *
   * @private
   * @param {Object} object The object to clone.
   * @returns {Object} Returns the initialized clone.
   */
  function initCloneObject(object) {
    return (typeof object.constructor == 'function' && !_isPrototype(object))
      ? _baseCreate(_getPrototype(object))
      : {};
  }

  var _initCloneObject = initCloneObject;

  /** `Object#toString` result references. */
  var argsTag = '[object Arguments]';

  /**
   * The base implementation of `_.isArguments`.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is an `arguments` object,
   */
  function baseIsArguments(value) {
    return isObjectLike_1(value) && _baseGetTag(value) == argsTag;
  }

  var _baseIsArguments = baseIsArguments;

  /** Used for built-in method references. */
  var objectProto$6 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$4 = objectProto$6.hasOwnProperty;

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
  var isArguments = _baseIsArguments(function() { return arguments; }()) ? _baseIsArguments : function(value) {
    return isObjectLike_1(value) && hasOwnProperty$4.call(value, 'callee') &&
      !propertyIsEnumerable.call(value, 'callee');
  };

  var isArguments_1 = isArguments;

  /** Used as references for various `Number` constants. */
  var MAX_SAFE_INTEGER = 9007199254740991;

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
  function isLength(value) {
    return typeof value == 'number' &&
      value > -1 && value % 1 == 0 && value <= MAX_SAFE_INTEGER;
  }

  var isLength_1 = isLength;

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
  function isArrayLike(value) {
    return value != null && isLength_1(value.length) && !isFunction_1(value);
  }

  var isArrayLike_1 = isArrayLike;

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
  function isArrayLikeObject(value) {
    return isObjectLike_1(value) && isArrayLike_1(value);
  }

  var isArrayLikeObject_1 = isArrayLikeObject;

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

  var isBuffer_1 = createCommonjsModule(function (module, exports) {
  /** Detect free variable `exports`. */
  var freeExports =  exports && !exports.nodeType && exports;

  /** Detect free variable `module`. */
  var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports;

  /** Built-in value references. */
  var Buffer = moduleExports ? _root.Buffer : undefined;

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
  var isBuffer = nativeIsBuffer || stubFalse_1;

  module.exports = isBuffer;
  });

  /** `Object#toString` result references. */
  var objectTag = '[object Object]';

  /** Used for built-in method references. */
  var funcProto$2 = Function.prototype,
      objectProto$7 = Object.prototype;

  /** Used to resolve the decompiled source of functions. */
  var funcToString$2 = funcProto$2.toString;

  /** Used to check objects for own properties. */
  var hasOwnProperty$5 = objectProto$7.hasOwnProperty;

  /** Used to infer the `Object` constructor. */
  var objectCtorString = funcToString$2.call(Object);

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
  function isPlainObject(value) {
    if (!isObjectLike_1(value) || _baseGetTag(value) != objectTag) {
      return false;
    }
    var proto = _getPrototype(value);
    if (proto === null) {
      return true;
    }
    var Ctor = hasOwnProperty$5.call(proto, 'constructor') && proto.constructor;
    return typeof Ctor == 'function' && Ctor instanceof Ctor &&
      funcToString$2.call(Ctor) == objectCtorString;
  }

  var isPlainObject_1 = isPlainObject;

  /** `Object#toString` result references. */
  var argsTag$1 = '[object Arguments]',
      arrayTag = '[object Array]',
      boolTag = '[object Boolean]',
      dateTag = '[object Date]',
      errorTag = '[object Error]',
      funcTag$1 = '[object Function]',
      mapTag = '[object Map]',
      numberTag = '[object Number]',
      objectTag$1 = '[object Object]',
      regexpTag = '[object RegExp]',
      setTag = '[object Set]',
      stringTag = '[object String]',
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
  typedArrayTags[argsTag$1] = typedArrayTags[arrayTag] =
  typedArrayTags[arrayBufferTag] = typedArrayTags[boolTag] =
  typedArrayTags[dataViewTag] = typedArrayTags[dateTag] =
  typedArrayTags[errorTag] = typedArrayTags[funcTag$1] =
  typedArrayTags[mapTag] = typedArrayTags[numberTag] =
  typedArrayTags[objectTag$1] = typedArrayTags[regexpTag] =
  typedArrayTags[setTag] = typedArrayTags[stringTag] =
  typedArrayTags[weakMapTag] = false;

  /**
   * The base implementation of `_.isTypedArray` without Node.js optimizations.
   *
   * @private
   * @param {*} value The value to check.
   * @returns {boolean} Returns `true` if `value` is a typed array, else `false`.
   */
  function baseIsTypedArray(value) {
    return isObjectLike_1(value) &&
      isLength_1(value.length) && !!typedArrayTags[_baseGetTag(value)];
  }

  var _baseIsTypedArray = baseIsTypedArray;

  /**
   * The base implementation of `_.unary` without support for storing metadata.
   *
   * @private
   * @param {Function} func The function to cap arguments for.
   * @returns {Function} Returns the new capped function.
   */
  function baseUnary(func) {
    return function(value) {
      return func(value);
    };
  }

  var _baseUnary = baseUnary;

  var _nodeUtil = createCommonjsModule(function (module, exports) {
  /** Detect free variable `exports`. */
  var freeExports =  exports && !exports.nodeType && exports;

  /** Detect free variable `module`. */
  var freeModule = freeExports && 'object' == 'object' && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports`. */
  var moduleExports = freeModule && freeModule.exports === freeExports;

  /** Detect free variable `process` from Node.js. */
  var freeProcess = moduleExports && _freeGlobal.process;

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
  });

  /* Node.js helper references. */
  var nodeIsTypedArray = _nodeUtil && _nodeUtil.isTypedArray;

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
  var isTypedArray = nodeIsTypedArray ? _baseUnary(nodeIsTypedArray) : _baseIsTypedArray;

  var isTypedArray_1 = isTypedArray;

  /**
   * Gets the value at `key`, unless `key` is "__proto__" or "constructor".
   *
   * @private
   * @param {Object} object The object to query.
   * @param {string} key The key of the property to get.
   * @returns {*} Returns the property value.
   */
  function safeGet(object, key) {
    if (key === 'constructor' && typeof object[key] === 'function') {
      return;
    }

    if (key == '__proto__') {
      return;
    }

    return object[key];
  }

  var _safeGet = safeGet;

  /** Used for built-in method references. */
  var objectProto$8 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$6 = objectProto$8.hasOwnProperty;

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
  function assignValue(object, key, value) {
    var objValue = object[key];
    if (!(hasOwnProperty$6.call(object, key) && eq_1(objValue, value)) ||
        (value === undefined && !(key in object))) {
      _baseAssignValue(object, key, value);
    }
  }

  var _assignValue = assignValue;

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
  function copyObject(source, props, object, customizer) {
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
        _baseAssignValue(object, key, newValue);
      } else {
        _assignValue(object, key, newValue);
      }
    }
    return object;
  }

  var _copyObject = copyObject;

  /**
   * The base implementation of `_.times` without support for iteratee shorthands
   * or max array length checks.
   *
   * @private
   * @param {number} n The number of times to invoke `iteratee`.
   * @param {Function} iteratee The function invoked per iteration.
   * @returns {Array} Returns the array of results.
   */
  function baseTimes(n, iteratee) {
    var index = -1,
        result = Array(n);

    while (++index < n) {
      result[index] = iteratee(index);
    }
    return result;
  }

  var _baseTimes = baseTimes;

  /** Used as references for various `Number` constants. */
  var MAX_SAFE_INTEGER$1 = 9007199254740991;

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
  function isIndex(value, length) {
    var type = typeof value;
    length = length == null ? MAX_SAFE_INTEGER$1 : length;

    return !!length &&
      (type == 'number' ||
        (type != 'symbol' && reIsUint.test(value))) &&
          (value > -1 && value % 1 == 0 && value < length);
  }

  var _isIndex = isIndex;

  /** Used for built-in method references. */
  var objectProto$9 = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$7 = objectProto$9.hasOwnProperty;

  /**
   * Creates an array of the enumerable property names of the array-like `value`.
   *
   * @private
   * @param {*} value The value to query.
   * @param {boolean} inherited Specify returning inherited property names.
   * @returns {Array} Returns the array of property names.
   */
  function arrayLikeKeys(value, inherited) {
    var isArr = isArray_1(value),
        isArg = !isArr && isArguments_1(value),
        isBuff = !isArr && !isArg && isBuffer_1(value),
        isType = !isArr && !isArg && !isBuff && isTypedArray_1(value),
        skipIndexes = isArr || isArg || isBuff || isType,
        result = skipIndexes ? _baseTimes(value.length, String) : [],
        length = result.length;

    for (var key in value) {
      if ((inherited || hasOwnProperty$7.call(value, key)) &&
          !(skipIndexes && (
             // Safari 9 has enumerable `arguments.length` in strict mode.
             key == 'length' ||
             // Node.js 0.10 has enumerable non-index properties on buffers.
             (isBuff && (key == 'offset' || key == 'parent')) ||
             // PhantomJS 2 has enumerable non-index properties on typed arrays.
             (isType && (key == 'buffer' || key == 'byteLength' || key == 'byteOffset')) ||
             // Skip index properties.
             _isIndex(key, length)
          ))) {
        result.push(key);
      }
    }
    return result;
  }

  var _arrayLikeKeys = arrayLikeKeys;

  /**
   * This function is like
   * [`Object.keys`](http://ecma-international.org/ecma-262/7.0/#sec-object.keys)
   * except that it includes inherited enumerable properties.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   */
  function nativeKeysIn(object) {
    var result = [];
    if (object != null) {
      for (var key in Object(object)) {
        result.push(key);
      }
    }
    return result;
  }

  var _nativeKeysIn = nativeKeysIn;

  /** Used for built-in method references. */
  var objectProto$a = Object.prototype;

  /** Used to check objects for own properties. */
  var hasOwnProperty$8 = objectProto$a.hasOwnProperty;

  /**
   * The base implementation of `_.keysIn` which doesn't treat sparse arrays as dense.
   *
   * @private
   * @param {Object} object The object to query.
   * @returns {Array} Returns the array of property names.
   */
  function baseKeysIn(object) {
    if (!isObject_1(object)) {
      return _nativeKeysIn(object);
    }
    var isProto = _isPrototype(object),
        result = [];

    for (var key in object) {
      if (!(key == 'constructor' && (isProto || !hasOwnProperty$8.call(object, key)))) {
        result.push(key);
      }
    }
    return result;
  }

  var _baseKeysIn = baseKeysIn;

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
  function keysIn(object) {
    return isArrayLike_1(object) ? _arrayLikeKeys(object, true) : _baseKeysIn(object);
  }

  var keysIn_1 = keysIn;

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
  function toPlainObject(value) {
    return _copyObject(value, keysIn_1(value));
  }

  var toPlainObject_1 = toPlainObject;

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
  function baseMergeDeep(object, source, key, srcIndex, mergeFunc, customizer, stack) {
    var objValue = _safeGet(object, key),
        srcValue = _safeGet(source, key),
        stacked = stack.get(srcValue);

    if (stacked) {
      _assignMergeValue(object, key, stacked);
      return;
    }
    var newValue = customizer
      ? customizer(objValue, srcValue, (key + ''), object, source, stack)
      : undefined;

    var isCommon = newValue === undefined;

    if (isCommon) {
      var isArr = isArray_1(srcValue),
          isBuff = !isArr && isBuffer_1(srcValue),
          isTyped = !isArr && !isBuff && isTypedArray_1(srcValue);

      newValue = srcValue;
      if (isArr || isBuff || isTyped) {
        if (isArray_1(objValue)) {
          newValue = objValue;
        }
        else if (isArrayLikeObject_1(objValue)) {
          newValue = _copyArray(objValue);
        }
        else if (isBuff) {
          isCommon = false;
          newValue = _cloneBuffer(srcValue, true);
        }
        else if (isTyped) {
          isCommon = false;
          newValue = _cloneTypedArray(srcValue, true);
        }
        else {
          newValue = [];
        }
      }
      else if (isPlainObject_1(srcValue) || isArguments_1(srcValue)) {
        newValue = objValue;
        if (isArguments_1(objValue)) {
          newValue = toPlainObject_1(objValue);
        }
        else if (!isObject_1(objValue) || isFunction_1(objValue)) {
          newValue = _initCloneObject(srcValue);
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
    _assignMergeValue(object, key, newValue);
  }

  var _baseMergeDeep = baseMergeDeep;

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
  function baseMerge(object, source, srcIndex, customizer, stack) {
    if (object === source) {
      return;
    }
    _baseFor(source, function(srcValue, key) {
      stack || (stack = new _Stack);
      if (isObject_1(srcValue)) {
        _baseMergeDeep(object, source, key, srcIndex, baseMerge, customizer, stack);
      }
      else {
        var newValue = customizer
          ? customizer(_safeGet(object, key), srcValue, (key + ''), object, source, stack)
          : undefined;

        if (newValue === undefined) {
          newValue = srcValue;
        }
        _assignMergeValue(object, key, newValue);
      }
    }, keysIn_1);
  }

  var _baseMerge = baseMerge;

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
  function identity(value) {
    return value;
  }

  var identity_1 = identity;

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
  function apply(func, thisArg, args) {
    switch (args.length) {
      case 0: return func.call(thisArg);
      case 1: return func.call(thisArg, args[0]);
      case 2: return func.call(thisArg, args[0], args[1]);
      case 3: return func.call(thisArg, args[0], args[1], args[2]);
    }
    return func.apply(thisArg, args);
  }

  var _apply = apply;

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
  function overRest(func, start, transform) {
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
      return _apply(func, this, otherArgs);
    };
  }

  var _overRest = overRest;

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
  function constant(value) {
    return function() {
      return value;
    };
  }

  var constant_1 = constant;

  /**
   * The base implementation of `setToString` without support for hot loop shorting.
   *
   * @private
   * @param {Function} func The function to modify.
   * @param {Function} string The `toString` result.
   * @returns {Function} Returns `func`.
   */
  var baseSetToString = !_defineProperty$1 ? identity_1 : function(func, string) {
    return _defineProperty$1(func, 'toString', {
      'configurable': true,
      'enumerable': false,
      'value': constant_1(string),
      'writable': true
    });
  };

  var _baseSetToString = baseSetToString;

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
  function shortOut(func) {
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

  var _shortOut = shortOut;

  /**
   * Sets the `toString` method of `func` to return `string`.
   *
   * @private
   * @param {Function} func The function to modify.
   * @param {Function} string The `toString` result.
   * @returns {Function} Returns `func`.
   */
  var setToString = _shortOut(_baseSetToString);

  var _setToString = setToString;

  /**
   * The base implementation of `_.rest` which doesn't validate or coerce arguments.
   *
   * @private
   * @param {Function} func The function to apply a rest parameter to.
   * @param {number} [start=func.length-1] The start position of the rest parameter.
   * @returns {Function} Returns the new function.
   */
  function baseRest(func, start) {
    return _setToString(_overRest(func, start, identity_1), func + '');
  }

  var _baseRest = baseRest;

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
  function isIterateeCall(value, index, object) {
    if (!isObject_1(object)) {
      return false;
    }
    var type = typeof index;
    if (type == 'number'
          ? (isArrayLike_1(object) && _isIndex(index, object.length))
          : (type == 'string' && index in object)
        ) {
      return eq_1(object[index], value);
    }
    return false;
  }

  var _isIterateeCall = isIterateeCall;

  /**
   * Creates a function like `_.assign`.
   *
   * @private
   * @param {Function} assigner The function to assign values.
   * @returns {Function} Returns the new assigner function.
   */
  function createAssigner(assigner) {
    return _baseRest(function(object, sources) {
      var index = -1,
          length = sources.length,
          customizer = length > 1 ? sources[length - 1] : undefined,
          guard = length > 2 ? sources[2] : undefined;

      customizer = (assigner.length > 3 && typeof customizer == 'function')
        ? (length--, customizer)
        : undefined;

      if (guard && _isIterateeCall(sources[0], sources[1], guard)) {
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

  var _createAssigner = createAssigner;

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
  var merge = _createAssigner(function(object, source, srcIndex) {
    _baseMerge(object, source, srcIndex);
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
   * @class ICEEvent
   * 在 ICE 中，所有事件都会被转化成 ICEEvent 进行处理。
   * ICEEvent 用来模拟 W3C 定义的 Event 接口，ICE 自定义的事件也使用此实现，事件对象上能获取到的属性不同。
   * 从原始 DOM 事件转发出来的 ICEEvent 实例包含 Event 接口上所定义的所有属性，ICE 内部代码创建的 ICEEvent 实例上只包含很少的自定义属性。
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Event
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class ICEEvent {
    constructor() {
      let evt = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      let data = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      _defineProperty(this, "originalEvent", void 0);

      _defineProperty(this, "target", void 0);

      _defineProperty(this, "param", void 0);

      //FIXME:事件对象的属性拷贝需要更加细致的控制
      for (let p in evt) {
        this[p] = evt[p];
      }

      for (let p in data) {
        this[p] = data[p];
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
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  let root$1 = null;

  (() => {
    root$1 = window || global || {};
  })();

  var root$2 = root$1;

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
      _defineProperty(this, "listeners", {});

      _defineProperty(this, "suspendedEventNames", []);
    }

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

    off(eventName, fn) {
      let scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : root$2;
      let arr = this.listeners[eventName];
      if (!arr) return;

      for (let i = 0; i < arr.length; i++) {
        let item = arr[i];

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


    once(eventName, fn) {
      let scope = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : root$2;

      function callback(evt) {
        this.off(eventName, callback, scope);
        fn.call(scope, evt);
      }

      this.on(eventName, callback, scope);
    }

    trigger(eventName) {
      let originalEvent = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
      let param = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      if (!this.listeners[eventName]) return false;
      if (this.suspendedEventNames.includes(eventName)) return false; //DOM 事件和代码触发的事件都会被转换成 ICEEvent
      //FIXME:这里需要判断传递了 originalEvent 且类型为 ICEEvent 的情况。

      let iceEvent;

      if (originalEvent) {
        iceEvent = new ICEEvent(originalEvent);
        iceEvent.originalEvent = originalEvent;
        iceEvent.param = { ...param
        };
      } else {
        iceEvent = new ICEEvent({
          type: eventName,
          timeStamp: new Date().getTime(),
          param: { ...param
          }
        });
      }

      this.listeners[eventName].forEach(item => {
        let fn = item.callback;
        let scope = item.scope;
        fn.call(scope, iceEvent);
      });
      return true;
    }

    suspend(eventName) {
      if (eventName && !this.suspendedEventNames.includes(eventName)) {
        this.suspendedEventNames.push(eventName);
      }
    }

    resume(eventName) {
      this.suspendedEventNames.splice(this.suspendedEventNames.findIndex(el => el === eventName), 1);
    }

    purgeEvents() {
      this.listeners = {};
      this.suspendedEventNames = [];
    }

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
  function trimmedEndIndex(string) {
    var index = string.length;

    while (index-- && reWhitespace.test(string.charAt(index))) {}
    return index;
  }

  var _trimmedEndIndex = trimmedEndIndex;

  /** Used to match leading whitespace. */
  var reTrimStart = /^\s+/;

  /**
   * The base implementation of `_.trim`.
   *
   * @private
   * @param {string} string The string to trim.
   * @returns {string} Returns the trimmed string.
   */
  function baseTrim(string) {
    return string
      ? string.slice(0, _trimmedEndIndex(string) + 1).replace(reTrimStart, '')
      : string;
  }

  var _baseTrim = baseTrim;

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
  function toNumber(value) {
    if (typeof value == 'number') {
      return value;
    }
    if (isSymbol_1(value)) {
      return NAN;
    }
    if (isObject_1(value)) {
      var other = typeof value.valueOf == 'function' ? value.valueOf() : value;
      value = isObject_1(other) ? (other + '') : other;
    }
    if (typeof value != 'string') {
      return value === 0 ? value : +value;
    }
    value = _baseTrim(value);
    var isBinary = reIsBinary.test(value);
    return (isBinary || reIsOctal.test(value))
      ? freeParseInt(value.slice(2), isBinary ? 2 : 8)
      : (reIsBadHex.test(value) ? NAN : +value);
  }

  var toNumber_1 = toNumber;

  /** Used as references for various `Number` constants. */
  var INFINITY$2 = 1 / 0,
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
  function toFinite(value) {
    if (!value) {
      return value === 0 ? value : 0;
    }
    value = toNumber_1(value);
    if (value === INFINITY$2 || value === -INFINITY$2) {
      var sign = (value < 0 ? -1 : 1);
      return sign * MAX_INTEGER;
    }
    return value === value ? value : 0;
  }

  var toFinite_1 = toFinite;

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
  function toInteger(value) {
    var result = toFinite_1(value),
        remainder = result % 1;

    return result === result ? (remainder ? result - remainder : result) : 0;
  }

  var toInteger_1 = toInteger;

  /* Built-in method references for those with the same name as other `lodash` methods. */
  var nativeIsFinite = _root.isFinite,
      nativeMin = Math.min;

  /**
   * Creates a function like `_.round`.
   *
   * @private
   * @param {string} methodName The name of the `Math` method to use when rounding.
   * @returns {Function} Returns the new round function.
   */
  function createRound(methodName) {
    var func = Math[methodName];
    return function(number, precision) {
      number = toNumber_1(number);
      precision = precision == null ? 0 : nativeMin(toInteger_1(precision), 292);
      if (precision && nativeIsFinite(number)) {
        // Shift with exponential notation to avoid floating-point issues.
        // See [MDN](https://mdn.io/round#Examples) for more details.
        var pair = (toString_1(number) + 'e').split('e'),
            value = func(pair[0] + 'e' + (+pair[1] + precision));

        pair = (toString_1(value) + 'e').split('e');
        return +(pair[0] + 'e' + (+pair[1] - precision));
      }
      return func(number);
    };
  }

  var _createRound = createRound;

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
  var round = _createRound('round');

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
     * 判断一个坐标点是否包含在图元内部。
     * @param component
     * @param point
     * @returns
     */


    static containsPoint(component, point) {
      return false;
    }
    /**
     * 判断两个图元是否相交。
     * @param a 第一个图元
     * @param b 第二个图元
     * @returns
     */


    static isIntersect(a, b) {
      return false;
    }
    /**
     * 已知两点坐标，求线段长度。
     * @param x1
     * @param y1
     * @param x2
     * @param y2
     */


    static getLength(x1, y1, x2, y2) {
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


    static calcRotateAngle(x, y, originX, originY) {
      let offsetX = x - originX;
      let offsetY = y - originY;
      let cos = offsetX / Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      let sin = offsetY / Math.sqrt(offsetX * offsetX + offsetY * offsetY); //Math.acos 的返回值处于 [0,PI] 之间，根据 sin 的正负号进行判断之后， rotateAngle 处于 [-180,180] 度之间
      //先加 360 度，保证 rotateAngle 为正值，再对 360 取模，最终让 rotateAngle 的返回值始终处于 [0,360] 度之间

      let sign = sin < 0 ? -1 : 1;
      let rotateAngle = sign * Math.acos(cos) * 180 / Math.PI + 360;
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


    static crossProduct(x1, y1, x2, y2) {
      //FIXME:需要确认计算公式是否正确
      let result = x1 * y2 - x2 * y1;
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


    static dotProduct(x1, y1, x2, y2) {
      let result = x1 * x2 + y1 * y2;
      return round_1(result, 2);
    }

  }

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

  class ICEBoundingBox {
    //top-left
    //top-right
    //bottom-left
    //bottom-right
    //center-point
    //FIXME:不使用 tl/tr/bl/br 固定4个顶点，顶点不定位
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

      _defineProperty(this, "tl", new DOMPoint());

      _defineProperty(this, "tr", new DOMPoint());

      _defineProperty(this, "bl", new DOMPoint());

      _defineProperty(this, "br", new DOMPoint());

      _defineProperty(this, "center", new DOMPoint());

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


    static fromDimension(left, top, width, height) {
      let tl = [left, top];
      let tr = [left + width, top];
      let bl = [left, top + height];
      let br = [left + width, top + height];
      let center = [left + width / 2, top + height / 2];
      let paramArr = [...tl, ...tr, ...bl, ...br, ...center];
      return new ICEBoundingBox(paramArr);
    }

    clone() {
      const tl = DOMPoint.fromPoint(this.tl);
      const tr = DOMPoint.fromPoint(this.tr);
      const bl = DOMPoint.fromPoint(this.bl);
      const br = DOMPoint.fromPoint(this.br);
      const center = DOMPoint.fromPoint(this.center);
      return new ICEBoundingBox([tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y, center.x, center.y]);
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

      if (point.x < minX || point.x > maxX || point.y < minY || point.y > maxY) {
        return false;
      }

      let xcount = 0; //交叉点个数

      let xi; //交点的 x 坐标

      const boudingLines = this.getBoundingLines();

      for (let i = 0; i < boudingLines.length; i++) {
        const line = boudingLines[i]; //特例1：点位于线段下方，水平射线不可能与线段交叉

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
          const k = (line.d.y - line.o.y) / (line.d.x - line.o.x); //斜率

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


    getBoundingLines() {
      const line_1 = {
        o: DOMPoint.fromPoint(this.tl),
        d: DOMPoint.fromPoint(this.tr)
      }; //o:origin, d:destination

      const line_2 = {
        o: DOMPoint.fromPoint(this.tr),
        d: DOMPoint.fromPoint(this.br)
      };
      const line_3 = {
        o: DOMPoint.fromPoint(this.br),
        d: DOMPoint.fromPoint(this.bl)
      };
      const line_4 = {
        o: DOMPoint.fromPoint(this.bl),
        d: DOMPoint.fromPoint(this.tl)
      };
      return [line_1, line_2, line_3, line_4];
    }
    /**
     * 获取边界盒子 x,y 的最大和最小值
     * @returns
     */


    getMinAndMaxPoint() {
      //取任意一个顶点坐标作为初始值，然后与其它3个顶点的坐标进行比较
      let minX = this.tl.x;
      let minY = this.tl.y;
      let maxX = this.tl.x;
      let maxY = this.tl.y;
      const arr = [this.tr, this.bl, this.br];
      arr.forEach(p => {
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
      let left1 = this.tl.x;
      let right1 = this.br.x;
      let top1 = this.tl.y;
      let bottom1 = this.br.y;
      let left2 = box.tl.x;
      let right2 = box.br.x;
      let top2 = box.tl.y;
      let bottom2 = box.br.y;
      let isIntersect = !(left1 > right2 || top1 > bottom2 || right1 < left2 || bottom1 < top2);
      return isIntersect;
    }
    /**
     * @param matrix
     * @returns A new ICEBoundingBox instance.
     */


    transform(matrix) {
      const tl = DOMPoint.fromPoint(this.tl).matrixTransform(matrix);
      const tr = DOMPoint.fromPoint(this.tr).matrixTransform(matrix);
      const bl = DOMPoint.fromPoint(this.bl).matrixTransform(matrix);
      const br = DOMPoint.fromPoint(this.br).matrixTransform(matrix);
      const center = DOMPoint.fromPoint(this.center).matrixTransform(matrix);
      return new ICEBoundingBox([tl.x, tl.y, tr.x, tr.y, bl.x, bl.y, br.x, br.y, center.x, center.y]);
    }
    /**
     * @param box
     * @returns A new ICEBoundingBox instance.
     */


    union(box) {
      return null;
    }

    get width() {
      return GeoUtil.getLength(this.br.x, this.br.y, this.bl.x, this.bl.y);
    }

    get height() {
      return GeoUtil.getLength(this.br.x, this.br.y, this.tr.x, this.tr.y);
    }

    get left() {
      return this.tl.x;
    } //不允许设置 left 参数


    set left(num) {
      throw new Error('Can not set left to ICEBoundingBox directly.');
    }

    get top() {
      return this.tl.y;
    } //不允许设置 top 参数


    set top(num) {
      throw new Error('Can not set top to ICEBoundingBox directly.');
    }

    get centerX() {
      return this.center.x;
    }

    get centerY() {
      return this.center.y;
    }

    get centerPoint() {
      return this.center;
    }

  }

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
  class ICEMatrix {
    constructor() {}
    /**
     * 从变换矩阵计算旋转角度。
     * @param matrix
     * @returns 角度
     */


    static calcRotateAngleFromMatrix(matrix) {
      let radians = 0;
      let {
        a,
        b
      } = matrix;
      let sin = b / Math.sqrt(a * a + b * b);
      let cos = a / Math.sqrt(a * a + b * b);
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
      const scaleX = Math.sqrt(matrix.a * matrix.a + matrix.b * matrix.b) / matrix.a;
      const scaleY = Math.sqrt(matrix.c * matrix.c + matrix.d * matrix.d) / matrix.d;
      return [scaleX, scaleY];
    }

  }

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */
  const ICE_CONSTS = {
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
   * @class ICEBaseComponent
   *
   * 最顶级的抽象类，Canvas 内部所有可见的组件都是它的子类。
   *
   * @abstract
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEBaseComponent extends ICEEventTarget {
    //组件当前归属的 ICE 实例，在处理一些内部逻辑时需要引用当前所在的 ICE 实例。只有当组件被 addChild() 方法加入到显示列表中之后， ice 属性才会有值。
    //当对象被添加到 canvas 中时，ICE 会自动设置 root 的值，没有被添加到 canvas 中的对象 root 为 null 。
    //当对象被添加到 canvas 中时，ICE 会自动设置 ctx 的值，没有被添加到 canvas 中的对象 ctx 为 null 。
    //事件总线， evtBus 在 render() 方法被调用时才会被设置，在被渲染出来之前，evtBus 为 null 。
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

      _defineProperty(this, "ice", void 0);

      _defineProperty(this, "root", void 0);

      _defineProperty(this, "ctx", void 0);

      _defineProperty(this, "evtBus", void 0);

      _defineProperty(this, "parentNode", void 0);

      _defineProperty(this, "props", {
        id: 'ICE_' + v4(),
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
        linkable: true,
        showMinBoundingBox: true,
        showMaxBoundingBox: true
      });

      _defineProperty(this, "state", { ...this.props
      });

      this.props = merge_1(this.props, props);
      this.state = JSON.parse(JSON.stringify(this.props));
      this.initEvents();
    }

    /**
     * !Important: 核心方法，FrameManager 会调度此方法进行实际的渲染操作。
     * !Important: 这些方法调用有顺序
     */
    render() {
      this.state.isRendering = true;
      this.calcOriginalDimension();
      this.applyStyle();
      this.applyTransformToCtx();
      this.doRender();
      this.ctx.setTransform(new DOMMatrix());
      this.state.isRendering = false;
    }

    applyStyle() {
      Object.assign(this.ctx, { ...this.props.style,
        ...this.state.style
      });
    }
    /**
     * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
     * 此方法不能依赖原点位置和 transform 矩阵。
     * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     * @returns
     */


    calcOriginalDimension() {
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
      let point = new DOMPoint(0, 0);
      let position = this.state.origin;

      if (!position || position === 'localCenter') {
        let halfWidth = this.state.width / 2;
        let halfHeight = this.state.height / 2;
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


    calcAbsoluteOrigin() {
      let tx = get_1(this, 'state.transform.translate.0') + this.state.left;
      let ty = get_1(this, 'state.transform.translate.1') + this.state.top;
      let point = DOMPoint.fromPoint(this.calcLocalOrigin());
      point.x += tx;
      point.y += ty;

      if (this.parentNode) {
        let pLocalX = this.parentNode.state.localOrigin.x;
        let pLocalY = this.parentNode.state.localOrigin.y;
        point = point.matrixTransform(new DOMMatrix([1, 0, 0, 1, -pLocalX, -pLocalY]));
        let pcm = this.parentNode.state.composedMatrix;
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


    calcLinearMatrix() {
      let matrix = new DOMMatrix(); //step1: skew
      //DOMMatrix.skeXSelf 方法的参数是角度值，不是百分比。 @see https://drafts.fxtf.org/geometry/#DOMMatrix

      const skewX = get_1(this, 'state.transform.skew.0');
      const skewY = get_1(this, 'state.transform.skew.1');
      matrix.skewXSelf(skewX);
      matrix.skewYSelf(skewY); //step2: rotate

      let angle = get_1(this, 'state.transform.rotate');
      matrix.rotateSelf(angle); //step3: scale

      const scaleX = get_1(this, 'state.transform.scale.0');
      const scaleY = get_1(this, 'state.transform.scale.1');
      matrix.scaleSelf(scaleX, scaleY);
      this.state.linearMatrix = matrix;
      return matrix;
    }
    /**
     * 复合所有祖先节点的线性变换矩阵，获得相对于全局 canvas 对象的变换矩阵。
     * @returns
     */


    calcAbsoluteLinearMatrix() {
      let component = this;
      let matrix = DOMMatrix.fromMatrix(component.calcLinearMatrix());

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


    composeMatrix() {
      //step-1: 移动到指定原点（全局坐标系）。
      let origin = this.calcAbsoluteOrigin();
      let translationMatrix = new DOMMatrix([1, 0, 0, 1, origin.x, origin.y]); //step-2: 计算线性变换矩阵，包含了所有祖先节点的线性变换。

      let linearMatrix = this.calcAbsoluteLinearMatrix(); //step-3: 计算综合变换矩阵，相当于先在 canvas 默认原点（左上角位置）进行变换，然后在平移到计算出的原点位置。

      let composedMatrix = translationMatrix.multiplySelf(linearMatrix);
      this.state.composedMatrix = DOMMatrix.fromMatrix(composedMatrix);
      return composedMatrix;
    }
    /**
     * 把变换矩阵应用到 this.ctx 上
     */


    applyTransformToCtx() {
      this.ctx.setTransform(this.composeMatrix());
    }
    /**
     * 所有子类都应该提供具体的实现。
     * @method doRender
     */


    doRender() {
      if (this.state.showMinBoundingBox) {
        let minBox = this.getMinBoundingBox();
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
        let maxBox = this.getMaxBoundingBox();
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


    getMinBoundingBox() {
      //先基于组件本地坐标系进行计算
      let originX = this.state.localOrigin.x;
      let originY = this.state.localOrigin.y;
      let width = this.state.width;
      let height = this.state.height;
      let boundingBox = new ICEBoundingBox([0 - originX, 0 - originY, 0 - originX + width, 0 - originY, 0 - originX, 0 - originY + height, 0 - originX + width, 0 - originY + height, 0, 0]); //再用 composedMatrix 进行变换

      boundingBox = boundingBox.transform(this.composeMatrix());
      return boundingBox;
    }
    /**
     * 获取组件的最大包围盒：
     * - 盒子保持水平和竖直，不旋转、不错切。
     * - 盒子的4边在全局坐标 X/Y 轴上的投影范围与组件完全一致。
     * @returns
     */


    getMaxBoundingBox() {
      let boundingBox = this.getMinBoundingBox();
      let {
        minX,
        minY,
        maxX,
        maxY
      } = boundingBox.getMinAndMaxPoint();
      let center = boundingBox.centerPoint;
      boundingBox = new ICEBoundingBox([minX, minY, maxX, minY, minX, maxY, maxX, maxY, center.x, center.y]);
      return boundingBox;
    }
    /**
     * setState 仅仅修改参数，不会立即导致重新渲染，需要等待 FrameManager 调度，最小延迟时间约为 1/60=16.67 ms 。
     * @param newState
     */


    setState(newState) {
      merge_1(this.state, newState);
    }
    /**
     * 相对于父组件的坐标系和原点。
     * @param left
     * @param top
     * @param evt
     */


    setPosition(left, top) {
      let evt = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : new ICEEvent();
      this.trigger('before-move', { ...evt,
        left,
        top
      });
      this.setState({
        left,
        top
      });
      this.trigger('after-move', { ...evt,
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
        let point = new DOMPoint(tx, ty);
        let matrix = this.parentNode.state.absoluteLinearMatrix.inverse();
        point = point.matrixTransform(matrix);
        tx = point.x;
        ty = point.y;
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
        let point = new DOMPoint(left, top);
        let matrix = this.parentNode.state.absoluteLinearMatrix.inverse();
        point = point.matrixTransform(matrix);
        left = point.x;
        top = point.y;
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
      let point = new DOMPoint(localX, localY);
      let matrix = this.state.composedMatrix;
      point = point.matrixTransform(matrix);
      return point;
    }
    /**
     * 全局空间(canvas)中的点转换成组件局部坐标系中的点，包含移动原点的操作。
     * @param globalX
     * @param globalY
     * @returns
     */


    globalToLocal(globalX, globalY) {
      let point = new DOMPoint(globalX, globalY);
      let matrix = this.state.composedMatrix.inverse();
      point = point.matrixTransform(matrix);
      return point;
    }
    /**
     * 根据变换矩阵计算组件在全局空间(canvas)中的旋转角度。
     * @returns
     */


    getRotateAngle() {
      let matrix = this.state.composedMatrix;
      return ICEMatrix.calcRotateAngleFromMatrix(matrix);
    }

    getLocalLeftTop() {
      let box = this.getMinBoundingBox();
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
      return this.getMinBoundingBox().containsPoint(new DOMPoint(x, y));
    }
    /**
     * @method destory
     * 销毁组件
     * - FIXME:立即停止组件上的所有动画效果
     * - 需要清理绑定的事件
     * - 带有子节点的组件需要先销毁子节点，然后再销毁自身。
     */


    destory() {
      this.trigger(ICE_CONSTS.BEFORE_REMOVE);
      this.purgeEvents();
      this.ice = null;
      this.ctx = null;
      this.root = null;
      this.evtBus = null;
      this.parentNode = null;
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      return {
        props: this.props,
        state: this.state
      };
    }

  }

  _defineProperty(ICEBaseComponent, "instanceCounter", 0);

  /**
   * @class ICEPath
   *
   * 路径
   *
   * @abstract
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEPath extends ICEBaseComponent {
    /**
     * @cfg
     * {
     *   dots:Array<DOMPoint>  //可选参数，路径上的点。
     * }
     * @param props
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        closePath: true,
        ...props
      });

      _defineProperty(this, "path2D", new Path2D());
    }
    /**
     * 空实现。
     *
     * @see ICEBaseComponent.initEvents
     * @overwrite
     */


    initEvents() {}
    /**
     * @method doRender
     * @overwrite
     */


    doRender() {
      //创建 Path2D 对象，doRender() 方法仅创建对象实例，不会立即绘制到画布上，绘制过程由 FrameManager 进行调度。
      //@see FrameManager.ts
      //@see https://developer.mozilla.org/en-US/docs/Web/API/Path2D/Path2D
      this.createPathObject();
      this.ctx.beginPath();

      if (this.state.closePath) {
        this.ctx.fill(this.path2D);
      }

      this.ctx.stroke(this.path2D);
      super.doRender();
    }
    /**
     * @method createPathObject
     * 创建路径对象，子类需要提供具体实现。
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


    calcOriginalDimension() {
      //DotPath 需要先计算每个点的坐标，然后才能计算 width/height
      this.calcDots();
      let points = this.calc4VertexPoints();
      let width = Math.abs(points[1].x - points[0].x); //maxX-minX

      let height = Math.abs(points[2].y - points[0].y); //maxY-minY

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
        dot = dot.matrixTransform(new DOMMatrix([1, 0, 0, 1, -origin.x, -origin.y]));
        this.state.dots[i] = dot;
      }

      return origin;
    }
    /**
     * @returns
     */


    createPathObject() {
      this.path2D = new Path2D();

      for (let i = 0; i < this.state.dots.length; i++) {
        const dot = this.state.dots[i];

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
     * @returns Array<DOMPoint>
     */


    calc4VertexPoints() {
      let minX = 0;
      let minY = 0;
      let maxX = 0;
      let maxY = 0;

      for (let i = 0; i < this.state.dots.length; i++) {
        let point = this.state.dots[i];

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


      const x1 = minX;
      const y1 = minY; //top-right point

      const x2 = maxX;
      const y2 = minY; //bottom-left point

      const x3 = minX;
      const y3 = maxY; //bottom-right point

      const x4 = maxX;
      const y4 = maxY;
      return [new DOMPoint(x1, y1), new DOMPoint(x2, y2), new DOMPoint(x3, y3), new DOMPoint(x4, y4)];
    }

    applyTransformToCtx() {
      super.applyTransformToCtx();
      const matrix = this.state.composedMatrix;
      const dots = this.state.dots;
      this.state.transformedDots = [];

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const point = DOMPoint.fromPoint(dot).matrixTransform(matrix);
        this.state.transformedDots.push(point);
      }
    }

  }

  /**
   * @class ICERect 矩形
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICERect extends ICEDotPath {
    /**
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        width: 10,
        height: 10,
        ...props
      });
    }
    /**
     * 计算路径上的关键点:
     * - 默认的坐标原点是 (0,0) 位置。
     * - 这些点没有经过 transform 矩阵变换。
     * - this.calcOriginalDimension() 会依赖此方法，在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     * @returns
     */


    calcDots() {
      let point1 = new DOMPoint(0, 0); //top-left point

      let point2 = new DOMPoint(this.state.width, 0); //top-right point

      let point3 = new DOMPoint(this.state.width, this.state.height); //bottom-right point

      let point4 = new DOMPoint(0, this.state.height); //bottom-left point

      this.state.dots = [point1, point2, point3, point4];
      return this.state.dots;
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = { ...super.toJSON(),
        type: ICERect.type
      };
      return result;
    }

  }

  _defineProperty(ICERect, "type", 'ICERect');

  /** `Object#toString` result references. */
  var stringTag$1 = '[object String]';

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
      (!isArray_1(value) && isObjectLike_1(value) && _baseGetTag(value) == stringTag$1);
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
  	"@lukeed/uuid": "^2.0.0",
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
  var browserslist = {
  	production: [
  		">0.2%",
  		"not dead",
  		"not op_mini all"
  	],
  	development: [
  		"last 1 chrome version",
  		"last 1 firefox version",
  		"last 1 safari version"
  	]
  };
  var engines = {
  	npm: ">=6.4.1",
  	node: ">=10.13.0"
  };
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
  	browserslist: browserslist,
  	engines: engines,
  	license: license
  };

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
      _defineProperty(this, "ice", void 0);

      _defineProperty(this, "currentObj", void 0);

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

  class ICEPolyLine extends ICEDotPath {
    /**
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */

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
      let param = merge_1({
        linkable: false,
        //所有线条类型的组件 linkable 都为 false ，因为在 ICE 中，用线条连接线条是没有意义的，线条之间不能互相连接。
        lineType: 'solid',
        lineWidth: 2,
        arrow: 'none',
        closePath: false,
        points: [],
        showMinBoundingBox: false,
        showMaxBoundingBox: false
      }, props); //至少有2个点，如果点数少于2个，自动填充。

      let len = param.points.length;

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
    /**
     * ICEPolyLine 有自己的特殊处理，它的原点永远在 (0,0) 位置，而不在几何中点。
     * @overwrite
     * @returns
     */


    calcLocalOrigin() {
      let point = new DOMPoint(0, 0);
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
      this.state.points.forEach(p => {
        let x = p[0] - left;
        let y = p[1] - top;
        this.state.dots.push(new DOMPoint(x, y));
      });
      return this.state.dots;
    }
    /**
     * 动态向线条上增加一个点
     * @param point
     * @param index
     */


    addDot(point, index) {
      this.state.points.splice(index, 0, point);
      this.state.dots.splice(index, 0, new DOMPoint(point[0], point[1]));
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


    calcOriginalDimension() {
      this.calcDots();
      let points = this.calc4VertexPoints(); //最小包围盒的4个顶点

      let width = Math.abs(points[1].x - points[0].x); //maxX-minX

      let height = this.state.style.lineWidth; //先进行共线判断，如果所有点都在同一条直线上，那么边界盒子的整体高度就等于线条的粗细

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
        let crossProduct = GeoUtil.crossProduct(vector1[0], vector1[1], vector2[0], vector2[1]);

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

      let point1 = new DOMPoint(startX + deltaX, startY + deltaY);
      let point2 = new DOMPoint(startX - deltaX, startY - deltaY);
      let point3 = new DOMPoint(endX + deltaX, endY + deltaY);
      let point4 = new DOMPoint(endX - deltaX, endY - deltaY);
      return [point1, point2, point3, point4];
    }
    /**
     * 获取组件的最小包围盒，此盒子的变换矩阵与组件自身完全相同。
     * @returns
     */


    getMinBoundingBox() {
      //先基于组件本地坐标系进行计算
      let originX = this.state.localOrigin.x;
      let originY = this.state.localOrigin.y;
      let points = this.calc4VertexPoints();
      let boundingBox = new ICEBoundingBox([points[0].x - originX, points[0].y - originY, points[1].x - originX, points[1].y - originY, points[2].x - originX, points[2].y - originY, points[3].x - originX, points[3].y - originY, 0, 0]); //再用 composedMatrix 进行变换

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
        let offsetX = newState.left - this.state.points[0][0];

        for (let i = 0; i < this.state.points.length; i++) {
          this.state.points[i][0] += offsetX;
        }
      }

      if (!isNil_1(newState.top)) {
        let offsetY = newState.top - this.state.points[0][1];

        for (let i = 0; i < this.state.points.length; i++) {
          this.state.points[i][1] += offsetY;
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
        const x1 = line.o.x;
        const y1 = line.o.y;
        const x2 = line.d.x;
        const y2 = line.d.y;
        const lineLength = GeoUtil.getLength(x1, y1, x2, y2);
        const len1 = GeoUtil.getLength(x, y, x1, y1);
        const len2 = GeoUtil.getLength(x, y, x2, y2);

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
        const x1 = dots[i].x;
        const y1 = dots[i].y;
        const x2 = dots[i + 1].x;
        const y2 = dots[i + 1].y;
        const line = {
          o: new DOMPoint(x1, y1),
          d: new DOMPoint(x2, y2)
        }; //o:origin, d:destination

        result.push(line);
      }

      return result;
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = { ...super.toJSON(),
        type: ICEPolyLine.type
      };
      return result;
    }

  }

  _defineProperty(ICEPolyLine, "type", 'ICEPolyLine');

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
    /**
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */
    constructor(props) {
      super(props);

      _defineProperty(this, "parentNode", null);

      _defineProperty(this, "childNodes", []);
    }
    /**
     * 注意，在调用 ICEGroup.addChild() 方法时， ICEGroup 自身可能还没有被添加到 ICE 实例中去。
     * 所以此时 child.root, child.ctx, child.evtBus 都可能为空。
     * @param child
     */


    addChild(child) {
      child.trigger(ICE_CONSTS.BEFORE_ADD);
      child.parentNode = this;
      this.childNodes.push(child);
      child.trigger(ICE_CONSTS.AFTER_ADD);
    }

    addChildren(arr) {
      arr.forEach(child => {
        this.addChild(child);
      });
    }

    removeChild(child) {
      child.destory();
      this.childNodes.splice(this.childNodes.indexOf(child), 1);
    }

    removeChildren(arr) {
      arr.forEach(child => {
        this.removeChild(child);
      });
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
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = {
        type: ICEGroup.type,
        props: this.props,
        state: this.state,
        childNodes: []
      };
      this.childNodes.forEach(child => {
        if (child.toJSON()) {
          result.childNodes.push(child.toJSON());
        }
      });
      return result;
    }

  }

  _defineProperty(ICEGroup, "type", 'ICEGroup');

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
      super({
        linkable: false,
        ...props
      });

      _defineProperty(this, "_targetComponent", void 0);
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
   * @class ICEEllipse
   *
   * 椭圆形。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEEllipse extends ICEPath {
    /**
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */
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
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = { ...super.toJSON(),
        type: ICEEllipse.type
      };
      return result;
    }

  }

  _defineProperty(ICEEllipse, "type", 'ICEEllipse');

  /**
   * @class ICECircle
   *
   * 正圆形，采用椭圆绘制方法，正圆形作为椭圆的特殊情况。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICECircle extends ICEEllipse {
    /**
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */
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
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = { ...super.toJSON(),
        type: ICECircle.type
      };
      return result;
    }

  }

  _defineProperty(ICECircle, "type", 'ICECircle');

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
      this.on('after-move', this.resizeEvtHandler, this);
    }
    /**
     *
     * 在 mousedown 事件处理器里面可以直接访问 this.evtBus ，因为能接收到 mousedown 事件说明组件已经渲染出来了。
     * 在 this.evtBus 上触发事件，相当于全局广播，所有监听了 hook-mousedown 事件的组件都会收到消息。
     *
     * @param evt
     */


    mosueDownHandler(evt) {
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


    mosueMoveHandler(evt) {
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


    mosueUpHandler(evt) {
      this.evtBus.trigger('hook-mouseup', new ICEEvent({
        target: this
      }));
    }

    resizeEvtHandler(evt) {
      if (!this.parentNode) {
        return;
      }

      let position = this.props.position;
      this.parentNode.trigger('before-resize', new ICEEvent(evt, {
        position
      }));
      this.parentNode.trigger('after-resize', new ICEEvent(evt, {
        position
      }));
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      return null;
    }

  }

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

  class LineControlPanel extends ICEControlPanel {
    //TODO:改成可配置参数
    constructor(props) {
      super({ ...props,
        zIndex: Number.MAX_VALUE,
        showMinBoundingBox: false,
        showMaxBoundingBox: false
      });

      _defineProperty(this, "controlSize", 16);

      _defineProperty(this, "startControl", void 0);

      _defineProperty(this, "endControl", void 0);

      this.initControls();
    }

    initControls() {
      let counter = 1;
      let width = this.state.width;
      let height = this.state.height;
      let halfControlSize = this.controlSize / 2;
      this.startControl = new ICELinkHook({
        zIndex: Number.MAX_VALUE - counter++,
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
        zIndex: Number.MAX_VALUE - counter++,
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
      this.on('after-resize', this.resizeEvtHandler, this);
    }

    enable() {
      this.setState({
        display: true
      });
      this.resume('after-resize');
      this.showHooks();
    }

    disable() {
      this.setState({
        display: false
      });
      this.suspend('after-resize');
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

      let matrix = targetState.absoluteLinearMatrix.inverse();
      let point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
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

    updatePosition() {
      if (this.targetComponent) {
        //ICEPolyLine 的处理方式与其它组件不同，这里 LineControPanel 本身的外观不重要，只要变换手柄能自由移动就可以
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
        let startPoint = new DOMPoint(start[0], start[1]);
        let endPoint = new DOMPoint(end[0], end[1]);
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

    set targetComponent(component) {
      this._targetComponent = component;

      if (component) {
        this.updatePosition();
        component.on('after-move', this.updatePosition, this);
      } else {
        component.off('after-move', this.updatePosition, this);
      }
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
        linkable: false,
        position: 'l',
        direction: 'x',
        quadrant: 1,
        ...props
      });
      this.on('after-move', this.resizeEvtHandler, this);
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

      let matrix = parentState.absoluteLinearMatrix.inverse();
      let point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
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

      const param = {
        top: newTop,
        left: newLeft,
        width: Math.abs(newWidth),
        height: Math.abs(newHeight)
      };
      this.parentNode.trigger('before-resize', new ICEEvent(evt, {
        quadrant
      }));
      this.parentNode.setState(param);
      this.parentNode.trigger('after-resize', new ICEEvent(evt, {
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
      let matrix = parentState.absoluteLinearMatrix.inverse();
      let point = new DOMPoint(tx, ty).matrixTransform(matrix);
      tx = point.x;
      ty = point.y;
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
      super({
        linkable: false,
        props
      });
      this.on('after-move', this.rotateEvtHandler, this);
    }

    rotateEvtHandler(evt) {
      if (!this.parentNode) {
        //parentNode 是 TransformPanel
        return;
      } //计算手柄旋转角


      let parentOrigin = this.parentNode.state.absoluteOrigin;
      let rotateAngle = GeoUtil.calcRotateAngle(evt.offsetX, evt.offsetY, parentOrigin.x, parentOrigin.y); //parentNode 旋转角与手柄旋转角同步

      const param = {
        transform: {
          rotate: rotateAngle + 90 //旋转手柄默认处于逆时针 90 度位置，这里加 90 度进行补偿。

        }
      };
      this.parentNode.trigger('before-rotate', new ICEEvent(param));
      this.parentNode.setState(param);
      this.parentNode.trigger('after-rotate', new ICEEvent(param));
    }

  }

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
        zIndex: Number.MAX_VALUE
      });

      _defineProperty(this, "rotateControlInstance", void 0);

      _defineProperty(this, "rotateControlSize", 8);

      _defineProperty(this, "rotateControlffsetY", 60);

      _defineProperty(this, "resizeControlInstanceCache", []);

      _defineProperty(this, "resizeControlSize", 16);

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
      let counter = 1;
      this.resizeControlInstanceCache = [];
      resizeControlConfig.forEach(controlConfig => {
        const handleInstance = new ResizeControl({
          zIndex: Number.MAX_VALUE - counter++,
          display: false,
          left: controlConfig.position.x,
          top: controlConfig.position.y,
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
      }); // 创建 1 个 RotateControl

      let left = this.state.width / 2 - this.rotateControlSize;
      let top = -this.rotateControlffsetY;
      this.rotateControlInstance = new RotateControl({
        zIndex: Number.MAX_VALUE - counter++,
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
      this.on('after-resize', this.resizeEvtHandler, this);
      this.on('after-rotate', this.rotateEvtHandler, this);
    }

    enable() {
      this.rotateControlInstance.setState({
        display: true
      });
      this.resizeControlInstanceCache.forEach(item => {
        item.setState({
          display: true
        });
      });
      this.setState({
        display: true
      });
      this.resume('after-resize');
      this.resume('after-rotate');
    }

    disable() {
      this.rotateControlInstance.setState({
        display: false
      });
      this.resizeControlInstanceCache.forEach(item => {
        item.setState({
          display: false
        });
      });
      this.setState({
        display: false
      });
      this.suspend('after-resize');
      this.suspend('after-rotate');
    }

    setControlPositions() {
      //重新计算所有 ResizeControl 的位置，共8个
      let width = this.state.width;
      let height = this.state.height;
      let halfWidth = width / 2;
      let halfHeight = height / 2;
      let halfControlSize = this.resizeControlSize / 2;
      this.resizeControlInstanceCache.forEach(resizeControl => {
        let quadrant = resizeControl.state.quadrant;
        let point = new DOMPoint();

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
      let matrix = targetState.absoluteLinearMatrix.inverse();
      let point = new DOMPoint(movementX, movementY).matrixTransform(matrix);
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

    updatePosition() {
      if (this.targetComponent) {
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
    }

    set targetComponent(component) {
      this._targetComponent = component;

      if (component) {
        this.updatePosition();
        component.on('after-move', this.updatePosition, this);
      } else {
        component.off('after-move', this.updatePosition, this);
      }
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
      this.resizeControlInstanceCache.forEach(item => {
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
      });
      control.setState({
        quadrant: quadrant
      });
    }

  }

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
      _defineProperty(this, "ice", void 0);

      _defineProperty(this, "transformControlPanel", void 0);

      _defineProperty(this, "lineControlPanel", void 0);

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
      this.ice.addChild(this.lineControlPanel);
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

      if (!(component instanceof ICEBaseComponent) || !component.state.interactive || !component.state.transformable) {
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
      _defineProperty(this, "animationMap", new Map());

      _defineProperty(this, "ice", void 0);

      this.ice = ice;
    }

    start() {
      this.ice.evtBus.on(ICE_CONSTS.ICE_FRAME_EVENT, this.frameEventHandler, this);
      return this;
    }

    stop() {
      this.ice.evtBus.off(ICE_CONSTS.ICE_FRAME_EVENT, this.frameEventHandler, this);
      return this;
    }

    frameEventHandler(evt) {
      this.animationMap.forEach(el => {
        //在动画过程中，对象不响应鼠标或者触摸交互，防止影响属性值的计算。
        el.state.interactive = false;
        this.tween(el);
        el.state.interactive = true;
      });
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
  const FrameManager = {
    evtBuses: [],
    stopped: false,
    frameCallback: function () {
      FrameManager.evtBuses.forEach(evtBus => {
        if (FrameManager.stopped) return;
        evtBus.trigger(ICE_CONSTS.ICE_FRAME_EVENT);
      });

      if (!FrameManager.stopped) {
        root$2.requestAnimationFrame(FrameManager.frameCallback);
      }
    },
    start: function () {
      //TODO:为 Node 平台自定义一个 requestAnimationFrame 函数，签名、参数、调用方式全部相同。
      FrameManager.stopped = false;
      root$2.requestAnimationFrame(FrameManager.frameCallback);
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
   * 原生 DOM 事件与 ICE 内部转发事件之间的对应关系
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  const mouseEvents = [['click', 'ICE_CLICK'], ['dbclick', 'ICE_DBCLICK'], ['mousedown', 'ICE_MOUSEDOWN'], ['mouseup', 'ICE_MOUSEUP'], ['mousemove', 'ICE_MOUSEMOVE'], ['mouseenter', 'ICE_MOUSEENTER'], ['mouseleave', 'ICE_MOUSELEAVE'], ['mouseout', 'ICE_MOUSEOUT'], ['mouseover', 'ICE_MOUSEOVER'], ['contextmenu', 'ICE_CONTEXTMENU'], ['mousewheel', 'ICE_MOUSEWHEEL']];

  /**
   * @class DOMEventBridge
   *
   * 事件桥接器，把原生 DOM 事件转发给 canvas 内部的组件。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class DOMEventBridge {
    constructor(ice) {
      _defineProperty(this, "selectionCandidates", []);

      _defineProperty(this, "ice", void 0);

      _defineProperty(this, "_stopped", false);

      this.ice = ice;
    }

    start() {
      //FIXME:这里触发事件的频率太高，所有所有鼠标事件都会被触发出来。
      //FIXME:这里需要增加节流机制，防止触发事件的频率过高导致 CPU 飙升。
      mouseEvents.forEach(evtMapping => {
        const iceEvtName = evtMapping[1];
        const originEvtName = evtMapping[0];
        this.ice.evtBus.on(iceEvtName, evt => {
          //在一些场景下，需要整体禁用事件系统。
          if (this._stopped) {
            return;
          }

          const component = this.findTargetComponent(evt.clientX, evt.clientY); //FIXME:需要把 clientX/clientY 转换成 canvas 内部的坐标

          if (component) {
            evt.target = component;
            component.trigger(originEvtName, evt);
          }

          this.ice.evtBus.trigger(originEvtName, evt); //this.ice.evtBus 本身一定会触发一次事件。
        });
      });
      return this;
    }

    set stopped(flag) {
      this._stopped = flag;
    }

    get stopped() {
      return this._stopped;
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


    findTargetComponent(clientX, clientY) {
      if (this._stopped) return null;
      let x = clientX - this.ice.canvasBoundingClientRect.left;
      let y = clientY - this.ice.canvasBoundingClientRect.top; // let components = Array.from(this.ice.childNodes);

      let components = this.ice.childNodes;

      for (let i = 0; i < components.length; i++) {
        let component = components[i];
        this.traverse(x, y, component);
      }

      this.selectionCandidates.sort((a, b) => {
        return a.zIndex - b.zIndex;
      });
      let component = this.selectionCandidates[0];
      this.selectionCandidates = [];
      return component;
    }
    /**
     * 广度优先遍历。
     * @param x
     * @param y
     * @param component
     */


    traverse(x, y, component) {
      if (this._stopped) return;

      if (component.childNodes && component.childNodes.length) {
        component.childNodes.forEach(child => {
          this.traverse(x, y, child);
        });
      } //不可交互的组件、没有渲染的组件，不派发事件。


      let {
        interactive,
        display
      } = component.state;
      let flag = component.containsPoint(x, y);

      if (flag && interactive && display) {
        this.selectionCandidates.push(component);
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
        //FIXME:全部转发是否有性能问题？
        MouseEventInterceptor.evtBuses.forEach(evtBus => {
          mouseEvents.forEach(item => {
            root$2.addEventListener(item[0], evt => {
              evtBus.trigger(item[1], evt);
            });
          });
        });
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
   * @class ICELinkSlot
   *
   * 连接插槽
   *
   * - ICELinkSlot 与 ICELinkHook 是一对组件，用来把两个组件连接起来。
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

      _defineProperty(this, "_hostComponent", void 0);
    }

    initEvents() {
      super.initEvents(); //由于 ICELinkSlot 默认不可见，实例的 display 为 false ，所以不会触发 AFTER_RENDER 事件，这里只能监听 BEFORE_RENDER
      //这里不能直接访问 this.evtBus ，因为对象在进入到渲染阶段时才会被设置 evtBus 实例，在 initEvents() 被调用时 this.evtBus 为空。 @see ICE.evtBus

      this.once(ICE_CONSTS.BEFORE_RENDER, this.afterAddHandler, this);
      this.once(ICE_CONSTS.BEFORE_REMOVE, this.beforeRemoveHandler, this);
    }

    afterAddHandler(evt) {
      this.evtBus.on('hook-mousedown', this.hookMouseDownHandler, this);
      this.evtBus.on('hook-mousemove', this.hookMouseMoveHandler, this);
      this.evtBus.on('hook-mouseup', this.hookMouseUpHandler, this);
    }

    beforeRemoveHandler(evt) {
      this.evtBus.off('hook-mousedown', this.hookMouseDownHandler, this);
      this.evtBus.off('hook-mousemove', this.hookMouseMoveHandler, this);
      this.evtBus.off('hook-mouseup', this.hookMouseUpHandler, this);
    }
    /**
     * 监听 EventBus 上连接钩子鼠标按下事件
     * @param evt
     */


    hookMouseDownHandler(evt) {
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
     * 监听 EventBus 上连接钩子鼠标弹起事件
     * @param evt
     */


    hookMouseUpHandler(evt) {
      let linkHook = evt.target;
      let linkLine = linkHook.parentNode.targetComponent;
      let position = linkHook.state.position;

      if (this.isIntersectWithHook(linkHook)) {
        // 如果 hook 与 slot 位置重叠，让连接线与 slot 所在的组件建立连接关系
        // 把连线上的起点或者终点坐标设置为当前发生碰撞的 ICELinkSlot 的坐标
        // ICELinkHook 实例在 LinkControlPanel 中，全局只有2个实例，所有连接线都共享同一个 LinkControlPanel 实例。
        linkLine && linkLine.setSlot(this, position);
      } else {
        //hook 没有与当前的 slot 重叠，让 hook 所在的连接线解除与当前 slot 之间的连接关系
        linkLine && linkLine.deleteSlot(this, position);
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
    }

    set hostComponent(component) {
      this._hostComponent = component;
    }

    get hostComponent() {
      return this._hostComponent;
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      return null;
    }

  }

  /**
   * @class ICELinkSlotManager
   *
   * - ICELinkSlotManager 连接插槽管理器，用于管理所有可连接组件上的连接插槽。
   * - ICELinkSlotManager 监听 renderer 上的 BEFORE_RENDER 和 AFTER_RENDER 事件，如果发现组件的 linkable 状态为 true ，会动态在组件上创建用于连接的插槽 ICELinkSlot 。
   * - ICELinkSlotManager 的实例是在 ICE 初始化时创建的。
   * - ICELinkSlotManager 是全局单例，同一个 ICE 实例上只能有一个 ICELinkSlotManager 实例。
   *
   * @see ICE
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */


  class ICELinkSlotManager {
    constructor(ice) {
      _defineProperty(this, "slotRadius", 10);

      _defineProperty(this, "ice", void 0);

      this.ice = ice;
    }

    start() {
      this.ice.renderer.on(ICE_CONSTS.AFTER_RENDER, this.afterRenderHandler, this);
      return this;
    }

    stop() {
      this.ice.renderer.off(ICE_CONSTS.AFTER_RENDER, this.afterRenderHandler, this);
      return this;
    }

    afterRenderHandler(evt) {
      const component = evt.param.component;

      if (!component || !component.state.linkable) {
        return;
      } //FIXME:这里需要处理删除事件
      // console.log(component.hasListener(ICE_CONSTS.BEFORE_REMOVE, slotBeforeRemoveHandler, component));
      // if (!component.hasListener(ICE_CONSTS.BEFORE_REMOVE, slotBeforeRemoveHandler, component)) {
      //   component.once(ICE_CONSTS.BEFORE_REMOVE, slotBeforeRemoveHandler, component);
      // }


      if (!component.linkSlots || !component.linkSlots.length) {
        this.createLinkSlots(component);
      } //FIXME: 如果 slot 处于显示状态，则计算所有 slot 当前的位置。当 slot 处于隐藏状态时，不计算它们的位置，节约性能？？？


      this.setSlotPositions(component);
    }
    /**
     * 创建连接插槽，插槽默认分布在组件最小边界盒子的4条边几何中点位置。
     */


    createLinkSlots(component) {
      let slot_1 = new ICELinkSlot({
        display: false,
        transformable: false,
        radius: this.slotRadius,
        position: 'T',
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        }
      });
      slot_1.hostComponent = component;
      this.ice.addChild(slot_1);
      let slot_2 = new ICELinkSlot({
        display: false,
        transformable: false,
        radius: this.slotRadius,
        position: 'R',
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        }
      });
      slot_2.hostComponent = component;
      this.ice.addChild(slot_2);
      let slot_3 = new ICELinkSlot({
        display: false,
        transformable: false,
        radius: this.slotRadius,
        position: 'B',
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        }
      });
      slot_3.hostComponent = component;
      this.ice.addChild(slot_3);
      let slot_4 = new ICELinkSlot({
        display: false,
        transformable: false,
        radius: this.slotRadius,
        position: 'L',
        style: {
          strokeStyle: '#0c09d4',
          fillStyle: '#3ce92c',
          lineWidth: 1
        }
      });
      slot_4.hostComponent = component;
      this.ice.addChild(slot_4);
      component.linkSlots = [slot_1, slot_2, slot_3, slot_4];
    } //FIXME:这里需要采用 TransformControlPanel 中的算法来计算插槽位置。


    setSlotPositions(component) {
      let box = component.getMinBoundingBox();
      component.linkSlots.forEach(slot => {
        let left = 0;
        let top = 0;

        switch (slot.state.position) {
          case 'T':
            left = box.center.x - this.slotRadius;
            top = box.tl.y - this.slotRadius;
            break;

          case 'R':
            left = box.tr.x - this.slotRadius;
            top = box.center.y - this.slotRadius;
            break;

          case 'B':
            left = box.center.x - this.slotRadius;
            top = box.br.y - this.slotRadius;
            break;

          case 'L':
            left = box.bl.x - this.slotRadius;
            top = box.center.y - this.slotRadius;
            break;
        }

        slot.setState({
          left,
          top
        });
      });
    }

  }

  /**
   * @class ICEImage
   * TODO:支持以下几种图片类型：jpg/jpeg/png/gif
   * TODO:ICEImage 来源的几种方式
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEImage extends ICEBaseComponent {
    /**
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        width: 100,
        height: 100,
        ...props
      });
    }
    /**
     * 空实现。
     */


    initEvents() {}

    doRender() {
      let img = new Image();
      img.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAO0AAADUCAMAAABH5lTYAAAAYFBMVEX///8A2P8A1/8A1f/x/P/s+/++8f/7/v/e+P+i7P/4/v9j4f/O9P/k+f+H5//G8//W9v+Z6v9V3/+s7f+07/9z5P+T6f+A5v9F3f/L9P+F5v+x7v+o7f8w2/945P9J3v9/jwyPAAATg0lEQVR4nO0dabeyOO9aFBdUFBFX9P//yxdcSNKmS4ow75wz+TLzeKE0bZo96d/ff/Af2GC1K5fVttof8s0Ao8/y5SkrzufiWKWzAcYXwaKqE9VBUl/T1e8Gnx0yhUZvhq/+SYTzBtUJgWZK5+VPpjTbt+s40YZPsn8K3805mTDQIlz2HTt96uvY4Vv9Yu5iuFnm80JYbXvswWqvjF1Fg5/nv0MiFE7sxmKaW8QNvNral/E99GT6W1T88HDP6IVvEcGk5z5cX+j+kBWGwN69s93+Sndh6SBhNHA9CFI2WIcgOxHzlMskBNd23GwozBiY00l95SE7L5WGjjrNuDV8S9pEGz4JHrU/HBWezeSxTNP0UGUTU0C2EyvCyPnAvNzg+dyWu81stkiv5O9qYBQBFmgP1HkHf5imR2aLVXL3jzk9m+8pdbrgZw54kbe/xsoGT/hqstf/mGcmU1Vn3/aWxksNi8v1p2boXCcjiaEdbG1yYP6+2hvMRiVu7co4sY16wmGzgoHH2tys+6R6WB4pDXwTBxfd6U8rZZDM91FYlnFO7grtg/0pA181selWS21jnWJrC0t964VGINzhe04xcNf5FUv2mFS+VOA8kfD1cw8kggGYp0ejmT+0TUuO5kOzWpPd9c58CMO+ez4ZwfgDQlZeu25hoKIruGtKAMrk8TrM4fsBgq0vpLC2AU8vqWRRih7eA919VQdsV6faqCIOAwl0xk+YrqpTKlH5rhRZ/8a2kMPJjUJABHX3rUBVdW9FifInO9PWAEjZc8T7AxzbYGVmQYVR8hXSVFd0CWQKRUddgx/cXShHxqBt4uu8rSiJW8QTB8sOW5ty8zPoNHPFiBMrUAWilZRTsuE693LCOmbB42AbR0Y7aq7VlLpljjV0mISTF0NHlOrifxjBtNZYEv6HhEwaAPIfWr/oWHIidbHpGiLMOUjwIAA2NTRTFukWFLa8M0vudDl12A7trwFhJ3/3wPqd5PuzH0sETbsJx/DD3EBXqQifc9lhO3CUZPOdr3rGvL7Tzm6c27/THdUpZhLhsJBpyQZsKLaGTRQE6yiZHwG7ntgCT+8xSN8lD4Zdz2XVDd6o6W7Gsvl6EtFTl7lRJ+9fgi2jYCRL+TDAKgfGthclbzltKiKiM9re9uFSrHLRoCtWL0bDdhH/IRIFJRaQVOaOxpNn3ZGRenM3BNkSB84cTngWeovBUIjWHOeEeBd/KUZXqJddRnNexFoF2AmVrJsf7hhdmRzqnLyDR74iLT4c3/7E+zCHTkQxHfAWSS1jKYA1L+EtZCO/U8TSN5GkG4HFF+66i4NOG5L4zXYYWRDUWI1UAvtgPGse4hJG5NwKU4wV4kiYc0l4PPjGhvbUVBF+A7SHVNps4jhVvG9MCgc5PyQZONRLiJ0Z4SpkD9+YEC5iyY4ViZfswbDHnCrQX7rq4xuTASI+8QsTJpUIMebQfD5QpYaPzksd9ZgTcXYTPtRhdhUoFwM7av5wRDNIBHn3DjPssKNbjaZcYPYfMrUb5rq8PnLBpB5ydGUz6AewsgHO3I2LQxkjBh5deDoy31sAcGoCLFzkYVR2lwzyVoXItfFCfHi7/Pz/hM7kebPO07I83JfL5b6B5j/3w61M88sO+9T9noyoeHk0gGx3azLTzY3GqO2AH5ssPGc3Ll4eC08Pk9hcbtXxOUnYZOUAaFOv6+y6THc8V4Okngh3pRiATV01NPP7qZgk9jx0CcqvjHNVH6t0ocXtQQTa2N4vITXPzfSyPNavbPi+WHJYJ5OsSrtTg/IQxqgcmRKeOMurQulZ/7+GF87nU9lKnMuoTArLu1M2OKIUZVXswcAePH/oBWDBjYUoQbn7397FgkGQjo4jC2qMas30ETc3J0SNmN2GLaRY3QqxFG1Ll5JJfS6y42lb7V8a1K0sb7dDq1btq+3jmBXnun1KPvJ5OZSvZnV7hqFK097Os8AdmM9opCjkW2299W+KmymkmR/Vdw1ane3Rb6J0NeS3UdnpqYIkeLPDt59W5G6unq++lYBie1u3G5mjScu0O+xhbv45X6T7j9ri/npy/JlelZ5dJ+ql4T2vtx2sL0JW6DlC9jASp5u08gn2hqJ/kSk2d1Z1t/hsS41TII+qOO0SWfaa7TfN94V7Jura8wRPr76qbpMF4XIsueMI2f+MZnhwU3R09XoL04dXKDBxJ/d8fYDqP5kzf/TMRyVFZLBkdeJxbcXcs/uHEWheIlqMEYbI32GGEeFvTDOML74xX92zuDaoZuUUcV3d7JqivYmLJaOP6eEI8lm21veF71GqY6VcBXuL6sdfAc4pLc6cURkSASg2pLspwf558/rLg0VYWK0/ezLJPg2NgNUBPl1KykgdSsJDnhQK64KB/dMdaa64uQ0lhn+cIeJmCfeYPlB9GyEbYFHx+S5TG6NCH0WyZn4wuuW0T2Rhng29Fu21rZleM8HXDt5dLCYYEKMjIXs4JRqzXzDCI6wZg9l+hm06w34ZdYbo5RBEFIK8qKg60xh8vjQZTUD1GFPBzqoIiKqA4596s6g34NMP+sLNcno+UBo0qSYej7f+hrLuEXCMjgFu7NxUCKg0HzTts4UzdpAa+DqDhguNn9ur9Yla8/0JmKmDRc1uj3PrWq+Lys43MaP6ThiFZKweKUNwOmTRhVKxSh4Ovgaezq8XG9OfjUXd686WaY0ng/l9YW+eCTAYEoc5q7f1sa67Vr+iajfVGwMi3mJZ0UrXBRpDzYIveuZzlkIIp4H5UUODD0XmWozKl2e21da6RAyZfYHvMJQULAEhx6Z6DY9Kqj0VhDutZJBDd0eRfXrF5UYTuehl9lxZCtuadWXNFkgDfcebCpNPWIF+iqGFGVmPoELCmohcpBKwhl7Bbezna9zqLCgXmMHaBijBtDuKmXgWsNo6IPm3w8YYK32MahEvukdyUBGPCvJQkMXVC7ex6WJ2pbAALPcRzYY9J9ZyVPsCISnUKDAwfGDqdoWpmVraJBM8uGLggdbbbcMv3cjy+TZ4ARGPCk2kKcnhxX/BOxtuu+w4vsPlB2wsDAq9xe0YYsvoyeDpYWc8PuxIvxUZaqQo7wOcYmH2BTPRZY7unXlNUoSK0YXTjvU0kQP4Zk6Hc89cvFvbAjN+4GJaAakQsIvXaNOFwZbR6gK2lt9cM3Yq9BFgl+B3c9FPQn+sUavGEZr/1L7e5KjKOCpS2woZKp+cGFD5xF7CmWENMw9VIVvLy1HjDEg91Ni/8P4FGZPCsQwNibUQOV7GAKuYa4dAnn0A0YWPqcZ48oJBa1HKLdcqiJB50RUyvgfg3dchg2MVk4BEK8O55dI7A1iBpVKiccb0QIDioZfWBB0GYtoclGQ23idcwKakEg0mZju0LFToHhEVycBqDms5ebXGDhdWlOJ03qgMKVBv2391GktcZ5ClwfU02Adjyxo3CzR+VHwWqodaygBso1zApU816YntGmEbFa2E8ed4unGdQXB6OVtpyWm7PLbsqUQyKK5wnKaq92vFlRNcuCeCU+fYg7C2m6lhgERC+0+UkxoxGJUQrMslFFvWICHqRUy2eWcEfFRsGExOygtNdeCeCdUuuK9r2kVEKE3XncC6lQ+mJUKwJ9fhfyPvck4JvdOLWEgif9bb4oGDK465mloh85A7EaYDLgJgNKSSqo7YbPn8hL4orJ4ypAsns8MUZXalDYNCqhMAbXSqD1YQZLTMTJp5ypf3815oRphy7Fw0P5yg08k3hK1ICuXmbDjt0bCCGWCVdO45STYH6hWDTjxSAESmAcd/OFfNyb+5nPRj3F4iDYP4jdG06qjh0J6h5eLYphdZ9i006Nm5LAHIYlcBadEQvLsoyueJ3bKeZ4wsd4CABaoChYFChRBueaQ5vbA7TdWByc04GALEyio8Nze6XLcLdDdBIypBZwsUQiTOpzNfrKH5sjM+AByzYR1IzLCOS9cVO4o15U5EDUChkSDfFI166axtRTiC5+oIY8A/ErVhFd67FV014ZDFKSvt3+HxAAe/1sLXlBPU68s129cArIm3uwgRHisldpZc6oRni8gT/HJZoM79XsqjhMS6PLTg/MRnOoNO8jbDsR3LvjA/Mhl6ykKYmO29DvUqmE9ttEwEXh3W7Q2PRQSVoZ/NQR+weEEWhd7Q3+pFRCkrHzoMdXtXSQiypvPWGSoFUvg+hhNDbM7BGb6bESfFaoD1ne/sgkK4esaUw3NnZIed7XGhq7nUZ7cU+sA0X26Px0d1cxwVHNDoVgR+sipAOz3A5sxUnuorY8/jBsw6it95pFA4oPvvQO9AfIonnY2Rq+yz6XTVVyUnFl9IhUPGS8ZNMgJwPg0E9ZAQ4Oy+hYFrgN5gqAEqeTDy8EGErTGffk3M0JHAPAb6nZtruS4Mhh9034NxE1ObjG2cMdNKbgEX4sXX1iEXNVG64Xfd9Vya6ee+y7U6MO/FU0lN30XVG4Ra0Cvx3SjQklX8H8gSb7bc3Xb+ZD7AhVMDrojzgDuCEhUu+Iht2oav6KR/4b5aclWGNp3FAlzlU1sZ+F0wa8zXXvARCphFaSz1olNUfuSKoBpOIzxGCzY1RCXPQ4vw2nqCsIUf13EeaVGG/k8WOeergSaJQ0uwAlsA9bmqeWsh5D9aZRkTk3NWxgGR15ZKr4ZfR9YhGbeufRFWVkL+I4wqom+buzIOB/y4qTW/9ugL4b2Oltk+lAcTERH2nHvndFQvXFu4u6+kVaV5RpBGJQ61pHYW9bcpr670nOaI/aBzGiO5yXom5xMuI6eXXQpTObA1gFX/Rbl99Qxw4WpqQHGwYysDEcLvPkHltyEUrjCQKZC4Q+Dbht+lVVb7eiPoVYY9Ybr09qT5NITKqttlBt7f+CzMY7o/nkN6QCju7ti+sLNINwZp4gET8GXiCQzs6NIcpMMwfaZCOnww6E/q56drS9v1Ls3z/NJA85+07Yr3bt5SPOtJEhjWRkMP08kEELYJdc+0/CAetGGB9+HbEK09FRFjwdCXA33g8Y9i29vqEAL68mht0r6fSyZg9Y1yTzfKOJpd9iN1hnuJt6LKp9iP/XO5w4De4XC49oYfNFvWm+3zL0eCjvYD32H2ArhbEnev3OTLx6ch1G+wfqOpzsd9SlVxyFQc4bZfZ2fS+SK/b7NX7XQ01q+WXO/epAtOb5C0ve0PQbG26eJSLmm6RaCsTe75zi1GrX6TAUCytDh1qM5v90Zvqrbb6+kF1+22avSr+61c47QP/2EsHMT1axB1i8Zba7eGsM0UEGMAxjF83/P4TuA2+5M8FECcwKaGb6As67GOQ9i2MCc+tCGeloUmAocEmHxQKgryM1mMP2zBh2WVjtj4vM/tDJweT0pKhEMOzpTFZITztRlCxdkeoUFfYMpDd8cGlhyay3x34YPdFcE1K6A7Dt1U+C7XUjMHp8K3jAQrgsvRRNA2Yl1rqzw9yg/tH6avoQ36LOLM4M4hZAcxhxJkaox2++Bf5zyVXDiNi4aR5UTuUxE4niGOOPQFQTA9SYiUXPH0DQ6RW70kahG0TBvaWRNpbpG7994+hxU6srIE/17XwEtgFbustXFEyW18kcUbAytT0Xek0jjAjIYupSkatMh0OIi//5bWwNGLNaW5VR2rHFh17MH8cVEDiaHJS6Y7Z9HA2MIt3fKqbkuyfUS5PijKw162mPdRY9ggg5Adv2B8bK/+hw1gq6UiPP7/Dmz1AtNJZGrvv4KSGzB6aXq6FfIwFpfqe0H2VCPjOAM17oJlOQBPjvT30dLjSDcakMZPr9wwoO/F9rQ1XRRD/hvvAtxNrOb4hqWR2B7aTRHDaDZQtFXwAqY5KV/W5gYwFYd2KPfx5fIJG/K7P9ej+S6AQYjZoa0ZnrjV/62f0BcARG+FVtqMlk0SdIXtgMAT+ItbclwAt1iyLXisoHVnpkQdUBGKAVY8SjcRwDJOmaooskete42MNY8Xro662HFOzYGkTSrf0HRIwcGAhRo8FQHlDwXrMVqd8eeYajWDQQ2qXwDhiuHTTGA7QlkppWIIfc31/uSB1AwW0PCxeemtnfq1JZhkKYGrsPVDRdbDX4Bbyk7NUqt0pqrTSdv2EN58GEtLbgH12fCnIiz0jdV9UFqnhJB7fSDzb2hNinzNz5W1reNK8fVOCUnm0dGg3H2UK2FRLwS3cDeKp9gcEv0iF+VhzucxCZlUY7nsIKMwzlrprF2V4a7XQmxjjAvYSSsGa+cJ5vIa++RK0+q1sQTcvOZH9T8ewI03+FmZBWLubhIb8yKjmt9f1Pls6NjtF5DpxhzFNXfJ1tnDe3R+1q7P1qR8/OWhLYIvkKyfjAjQy5Upk1KJ3zJbm/WCbf0LQTjHTbvG2lotSyZ5Li+b2Wyzvm3PbL1QUgQZ/g8mTNTWEdwvm1V78fGekHvUrZVxsNI0vlf+tCX9OuymuBZ2ZiShGz3R1jHy1so4MLpK2kAlkmktQy/qjvTMxoJxUYEF10xmb6+4pkzcwGMUxyAI6EipkkIe0tqYPUlM6NkFJwL8F+9Glv/uvPjG9cjuB66+dm3LiXimafbXIUNH+Nt/AGZDmw7V+t4vHDXd26qbldA/+UO4m3NqC7OqX8jCNVfdrJLzP0DFHaQZKexJVHb4ndhff9uqvZexGf00OnvSYXfYZsXzWWTbe/77E9WOfq4ndV2cDv84qv/B/zH8D3OHxzhj1luJAAAAAElFTkSuQmCC';
      this.ctx.drawImage(img, 0 - this.state.localOrigin.x, 0 - this.state.localOrigin.y, this.state.width, this.state.height);
      super.doRender();
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = { ...super.toJSON(),
        type: ICEImage.type
      };
      return result;
    }

  }

  _defineProperty(ICEImage, "type", 'ICEImage');

  /**
   * Copyright (c) 2022 大漠穷秋.
   *
   * This source code is licensed under the MIT license found in the
   * LICENSE file in the root directory of this source tree.
   *
   */

  /**
   * FIXME: 与 ICEPoint 合并。
   *
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
     * @method loadArray
     * Creates an array of points from an array of {JSONObject}s.
     *
     *
     * 从 {JSONObject} 数组创建实例。
     * @param {Array} v the array of JSONObjects
     * @return an {Array} of {GeoPoint}s
     */


    static loadArray(v) {
      let newPoints = [];

      for (let i = 0; i < v.length; i++) {
        newPoints.push(GeoPoint.load(v[i]));
      }

      return newPoints;
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
     *
     * @method pointsToArray
     * @param {*} points
     */


    static pointsToArray(points) {
      let result = [];

      for (let i = 0; i < points.length; i++) {
        result.push([points[i].x, points[i].y]);
      }

      return result;
    }
    /**
     * @method toArray
     */


    toArray() {
      return [this.x, this.y];
    }
    /**
     * @method transform
     * @param {*} matrix
     */


    transform(matrix) {
      let oldX = this.x;
      let oldY = this.y;
      this.x = matrix[0][0] * oldX + matrix[0][1] * oldY + matrix[0][2];
      this.y = matrix[1][0] * oldX + matrix[1][1] * oldY + matrix[1][2];
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
    /**
     * @method add
     * @param {*} point
     */


    add(point) {
      this.x = this.x + point.x;
      this.y = this.y + point.y;
      return this;
    }
    /**
     * @method near
     * Tests to see if a point (x, y) is within a range of current GeoPoint.
     *
     *
     * 测试某个点 (x,y) 是否处于当前 GeoPoint 的某个范围内。
     * @param {Numeric} x - the x coordinate of tested point
     * @param {Numeric} y - the x coordinate of tested point
     * @param {Numeric} radius - the radius of the vicinity
     */


    near(x, y, radius) {
      let distance = Math.sqrt(Math.pow(this.x - x, 2) + Math.pow(this.y - y, 2));
      return distance <= radius;
    }
    /**
     * @method toString
     */


    toString() {
      return '[' + this.x + ',' + this.y + ']';
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
    /**
     *
     * @method load
     * Creates a {GeoLine} out of JSON parsed object.
     *
     *
     * 从 JSON 对象创建直线。
     * @param {JSONObject} o - the JSON parsed object
     * @return {GeoLine} a newly constructed GeoLine
     */


    static load(o) {
      let newLine = new GeoLine(GeoPoint.load(o.startPoint), GeoPoint.load(o.endPoint));
      return newLine;
    }
    /**
     * @method constants
     * Tests to see if a point belongs to this line (not as infinite line but more like a segment)
     * Algorithm: Compute line's equation and see if (x, y) verifies it.
     *
     * 测试某个点是否位于直线上（这里不是数学意义上的无线延长直线，而是线段）。
     * 算法：计算斜率，看(x,y)点是否位于线段上。
     *
     * @see http://www.jeffreythompson.org/collision-detection/line-point.php
     * @param {Number} x - the X coordinates
     * @param {Number} y - the Y coordinates
     */


    contains(x, y) {
      // if the point is inside rectangle bounds of the segment
      if (Math.min(this.startPoint.x, this.endPoint.x) <= x && x <= Math.max(this.startPoint.x, this.endPoint.x) && Math.min(this.startPoint.y, this.endPoint.y) <= y && y <= Math.max(this.startPoint.y, this.endPoint.y)) {
        // check for vertical line
        if (this.startPoint.x == this.endPoint.x) {
          return x == this.startPoint.x;
        } else {
          // usual (not vertical) line can be represented as y = a * x + b
          let a = (this.endPoint.y - this.startPoint.y) / (this.endPoint.x - this.startPoint.x);
          let b = this.startPoint.y - a * this.startPoint.x;
          return y == a * x + b;
        }
      } else {
        return false;
      }
    }
    /**
     * @method near
     * See if we are near a {GeoLine} by a certain radius (also includes the extremities into computation).
     *
     *
     * 测试某个点是否在某个角度上接近 {GeoLine} （断点也计算在内）。
     *
     * @param {Number} x - the x coordinates
     * @param {Number} y - the y coordinates
     * @param {Number} radius - the radius to search for
     * @see http://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
     * @see "Mathematics for Computer Graphics, 2nd Ed., by John Vice, page 227"
     */


    near(x, y, radius) {
      if (this.endPoint.x === this.startPoint.x) {
        //Vertical line, so the vicinity area is a rectangle
        return (this.startPoint.y - radius <= y && this.endPoint.y + radius >= y || this.endPoint.y - radius <= y && this.startPoint.y + radius >= y) && x > this.startPoint.x - radius && x < this.startPoint.x + radius;
      }

      if (this.startPoint.y === this.endPoint.y) {
        //Horizontal line, so the vicinity area is a rectangle
        return (this.startPoint.x - radius <= x && this.endPoint.x + radius >= x || this.endPoint.x - radius <= x && this.startPoint.x + radius >= x) && y > this.startPoint.y - radius && y < this.startPoint.y + radius;
      }

      let startX = Math.min(this.endPoint.x, this.startPoint.x);
      let startY = Math.min(this.endPoint.y, this.startPoint.y);
      let endX = Math.max(this.endPoint.x, this.startPoint.x);
      let endY = Math.max(this.endPoint.y, this.startPoint.y);
      /*We will compute the distance from point to the line
       * by using the algorithm from
       * http://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
       * */
      //First we need to find a,b,c of the line equation ax + by + c = 0

      let a = this.endPoint.y - this.startPoint.y;
      let b = this.startPoint.x - this.endPoint.x;
      let c = -(this.startPoint.x * this.endPoint.y - this.endPoint.x * this.startPoint.y); //Secondly we get the distance "Mathematics for Computer Graphics, 2nd Ed., by John Vice, page 227"

      let d = Math.abs((a * x + b * y + c) / Math.sqrt(Math.pow(a, 2) + Math.pow(b, 2))); //Thirdly we get coordinates of closest line's point to target point
      //http://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line#Cartesian_coordinates

      let closestX = (b * (b * x - a * y) - a * c) / (Math.pow(a, 2) + Math.pow(b, 2));
      let closestY = (a * (-b * x + a * y) - b * c) / (Math.pow(a, 2) + Math.pow(b, 2));
      let r = d <= radius && endX >= closestX && closestX >= startX && endY >= closestY && closestY >= startY || //the projection of the point falls INSIDE of the segment
      this.startPoint.near(x, y, radius) || this.endPoint.near(x, y, radius); //the projection of the point falls OUTSIDE of the segment

      return r;
    }
    /**
     * @method getPoints
     * Get an arry composed by the start point and end point of the line.
     *
     *
     * 获取端点构成的数组。
     */


    getPoints() {
      let points = [];
      points.push(this.startPoint);
      points.push(this.endPoint);
      return points;
    }
    /**
     * @method getPoint
     * Return the {GeoPoint} corresponding the t certain t value.
     *
     *
     * 获取指定百分比上的点，参数 t 是百分比。
     * @param {Number} t the value of parameter t, where t in [0,1], t is like a percent
     */


    getPoint(t) {
      let xp = t * (this.endPoint.x - this.startPoint.x) + this.startPoint.x;
      let yp = t * (this.endPoint.y - this.startPoint.y) + this.startPoint.y;
      return new GeoPoint(xp, yp);
    }
    /**
     * @method clone
     */


    clone() {
      let ret = new GeoLine(this.startPoint.clone(), this.endPoint.clone());
      return ret;
    }
    /**
     * @equals
     * @param {*} anotherLine
     */


    equals(anotherLine) {
      if (!(anotherLine instanceof GeoLine)) {
        return false;
      }

      return this.startPoint.equals(anotherLine.startPoint) && this.endPoint.equals(anotherLine.endPoint);
    }
    /**
     * @method toString
     */


    toString() {
      return 'line(' + this.startPoint + ',' + this.endPoint + ')';
    }

  }

  /**
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
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */
    //FIXME:序列化时存组件 ID

    /**
     * FIXME:补全 props 配置项的描述
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

      if (isNil_1(props.startPoint)) {
        props.startPoint = [0, 0];
      }

      if (isNil_1(props.endPoint)) {
        props.endPoint = [10, 10];
      }

      props.points = [props.startPoint, props.endPoint]; //escapeDistance 疏散距离，是4个距离边界盒子边缘的点，线条从组件上出来时会首先经过这些点。
      //escapeDistance 不是固定值，会根据 startSlot 和 endSlot 宿主组件的尺寸动态计算和调整，这样可以保证连接线不与相连接的组件产生重叠。

      props = {
        escapeDistance: 30,
        ...props
      };
      super(props);

      _defineProperty(this, "startSlot", void 0);

      _defineProperty(this, "endSlot", void 0);
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
      arr.forEach(item => {
        this.state.points.push([item.x, item.y]);
        this.state.dots.push(new DOMPoint(item.x - left, item.y - top));
      });
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

      if (this.startSlot) {
        startBounding = this.startSlot.hostComponent.getMinBoundingBox();
        potentialExits[0] = new GeoPoint(startPoint.x, startBounding.tl.y - this.state.escapeDistance); //north

        potentialExits[1] = new GeoPoint(startBounding.tr.x + this.state.escapeDistance, startPoint.y); //east

        potentialExits[2] = new GeoPoint(startPoint.x, startBounding.br.y + this.state.escapeDistance); //south

        potentialExits[3] = new GeoPoint(startBounding.tl.x - this.state.escapeDistance, startPoint.y); //west
        //pick closest exit point

        startExitPoint = potentialExits[0];

        for (let i = 1; i < potentialExits.length; i++) {
          if (this.distance(startPoint, potentialExits[i]) < this.distance(startPoint, startExitPoint)) {
            startExitPoint = potentialExits[i];
          }
        }
      } //find end exit point


      if (this.endSlot) {
        endBounding = this.endSlot.hostComponent.getMinBoundingBox();
        potentialExits[0] = new GeoPoint(endPoint.x, endBounding.tl.y - this.state.escapeDistance); //north

        potentialExits[1] = new GeoPoint(endBounding.tr.x + this.state.escapeDistance, endPoint.y); //east

        potentialExits[2] = new GeoPoint(endPoint.x, endBounding.br.y + this.state.escapeDistance); //south

        potentialExits[3] = new GeoPoint(endBounding.tl.x - this.state.escapeDistance, endPoint.y); //west
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
        eastExits.push(startBounding.br.x + 20);
      }

      if (endBounding) {
        eastExits.push(endBounding.br.x + 20);
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
        northExits.push(startBounding.tl.y - 20);
      }

      if (endBounding) {
        northExits.push(endBounding.tl.y - 20);
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
        westExits.push(startBounding.tl.x - 20);
      }

      if (endBounding) {
        westExits.push(endBounding.tl.x - 20);
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
        southExits.push(startBounding.tl.y + startBounding.height + 20);
      }

      if (endBounding) {
        southExits.push(endBounding.tl.y + endBounding.height + 20);
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
      return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
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
    /**
     *
     * 当连线两头的组件发生移动时，触发连线重新绘制自身。
     *
     * @param slot
     * @param position
     */


    syncPosition(slot, position) {
      let slotBounding = slot.getMinBoundingBox();
      let {
        x,
        y
      } = slotBounding.center;
      let point = this.globalToLocal(x, y);
      let {
        left,
        top
      } = this.state;
      point = point.matrixTransform(new DOMMatrix([1, 0, 0, 1, left, top]));

      if (position === 'start') {
        this.setState({
          startPoint: [point.x, point.y]
        });
      } else if (position === 'end') {
        this.setState({
          endPoint: [point.x, point.y]
        });
      }
    }

    followStartSlot(evt) {
      this.syncPosition(this.startSlot, 'start');
    }

    followEndSlot(evt) {
      this.syncPosition(this.endSlot, 'end');
    } //FIXME:以下特性需要测试
    // - 监听目标组件上的 after-move 事件，同步位置
    // - 如果 slot 为 null ，清理事件和相关资源
    // - 设置了 startSlot 或者 endSlot 之后，连线本身不能拖拽


    setSlot(slot, position) {
      if (!slot || !position) return; //总是先尝试解除连接关系，然后再重新尝试连接

      this.deleteSlot(slot, position);
      this.setState({
        draggable: false
      });

      if (position === 'start') {
        this.startSlot = slot;
        this.syncPosition(this.startSlot, 'start');
        this.startSlot.hostComponent.on('after-move', this.followStartSlot, this);
      } else if (position === 'end') {
        this.endSlot = slot;
        this.syncPosition(this.endSlot, 'end');
        this.endSlot.hostComponent.on('after-move', this.followEndSlot, this);
      }
    }
    /**
     * 解除连线与组件之间的连接关系。
     * @param slot
     */


    deleteSlot(slot, position) {
      if (position === 'start' && this.startSlot === slot) {
        this.startSlot.hostComponent.off('after-move', this.followStartSlot, this);
        this.startSlot = null;
      } else if (position === 'end' && this.endSlot === slot) {
        this.endSlot.hostComponent.off('after-move', this.followEndSlot, this);
        this.endSlot = null;
      } //如果两端都没有连接的组件，连接线自身变成可拖动


      if (!this.startSlot && !this.endSlot) {
        this.setState({
          draggable: true
        });
      }
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = { ...super.toJSON(),
        type: ICEVisioLink.type
      };
      return result;
    }

  }

  _defineProperty(ICEVisioLink, "type", 'ICEVisioLink');

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
    /**
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */
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

      _defineProperty(this, "radius", 10);

      _defineProperty(this, "edges", 3);

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
        this.state.dots.push(new DOMPoint(x, y));
      }

      return this.state.dots;
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = { ...super.toJSON(),
        type: ICEIsogon.type
      };
      return result;
    }

  }

  _defineProperty(ICEIsogon, "type", 'ICEIsogon');

  /**
   * @class ICEStar 五角星
   * TODO:实现正 N 角星
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEStar extends ICEIsogon {
    /**
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */
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
          this.path2D.moveTo(v1.x, v1.y);
          this.path2D.lineTo(v2.x, v2.y);
        } else {
          this.path2D.lineTo(v2.x, v2.y);
        }

        i = j;
        counter++;
      }

      this.path2D.closePath();
      return this.path2D;
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = { ...super.toJSON(),
        type: ICEStar.type
      };
      return result;
    }

  }

  _defineProperty(ICEStar, "type", 'ICEStar');

  /**
   * TODO:draw text along Path2D
   * @see https://longviewcoder.com/2021/02/11/html5-canvas-text-line-height-measurement/
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class ICEText extends ICEBaseComponent {
    /**
     * @required
     * ICE 会根据 type 动态创建组件的实例， type 会被持久化，在同一个 ICE 实例中必须全局唯一，确定之后不可修改，否则 ICE 无法从 JSON 字符串反解析出实例。
     */

    /**
     * @cfg
     * {
     *   text:'文本内容',
     *   left:0,
     *   top:0,
     *   fontSize:48,
     *   fontFamily:'Arial',
     *   fontWeight:24,
     * }
     * FIXME: fontSize/fontFamily/fontWeight 移动到 style 配置项中一起处理。
     * @param props
     */
    constructor() {
      let props = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
      super({
        text: '',
        left: 0,
        top: 0,
        fontSize: 48,
        fontFamily: 'Arial',
        fontWeight: 24,
        ...props
      });
    }
    /**
     * 空实现。
     */


    initEvents() {}
    /**
     * 计算原始的宽高、位置，此时没有经过任何变换，也没有移动坐标原点。
     * 文本尺寸的计算需要使用特殊的方法。
     * 这里使用的方法来自 https://longviewcoder.com/2021/02/11/html5-canvas-text-line-height-measurement/
     *
     * 在计算组件的原始尺寸时还没有确定原点坐标，所以只能基于组件本地坐标系的左上角 (0,0) 点进行计算。
     *
     * FIXME:某些运行时环境可能不支持动态插入 HTML 标签，以上测量文本宽高的方法可能存在兼容性问题。
     * FIXME:边界盒子的高度与字体高度之间存在误差。
     * @returns
     */


    calcOriginalDimension() {
      const div = this.root.document.createElement('div');
      div.contenteditable = false;
      div.innerHTML = this.state.text;
      div.style.position = 'absolute';
      div.style.top = '200px';
      div.style.left = '0';
      div.style.fontFamily = this.state.fontFamily;
      div.style.fontWeight = this.state.fontWeight;
      div.style.fontSize = this.state.fontSize + 'px';
      this.root.document.body.appendChild(div);
      let cssSize = {
        width: div.offsetWidth,
        height: div.offsetHeight
      };
      this.root.document.body.removeChild(div); //这里需要同时修改一下 props 中的 width/height ，因为构造时无法计算文本的宽高

      this.props.width = cssSize.width;
      this.props.height = cssSize.height;
      this.state.width = cssSize.width;
      this.state.height = cssSize.height;
      return {
        width: this.state.width,
        height: this.state.height
      };
    }
    /**
     * 文本是基于 baseline 绘制的，文本是从 y 坐标向屏幕上方绘制的，48 是文本高度，这里需要补偿文本高度。
     * 同时把移动坐标轴原点的偏移量计算进去。
     */


    doRender() {
      this.ctx.strokeText(this.state.text, 0 - this.state.localOrigin.x, 0 - this.state.localOrigin.y + this.state.height, this.state.width);
      this.ctx.fillText(this.state.text, 0 - this.state.localOrigin.x, 0 - this.state.localOrigin.y + this.state.height, this.state.width);
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      let result = { ...super.toJSON(),
        type: ICEText.type
      };
      return result;
    }

  }

  _defineProperty(ICEText, "type", 'ICEText');

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

  const componentTypeMap = Object.fromEntries(new Map([[ICERect.type, ICERect], [ICECircle.type, ICECircle], [ICEEllipse.type, ICEEllipse], [ICEStar.type, ICEStar], [ICEIsogon.type, ICEIsogon], [ICEText.type, ICEText], [ICEImage.type, ICEImage], [ICEGroup.type, ICEGroup], [ICEVisioLink.type, ICEVisioLink], [ICEPolyLine.type, ICEPolyLine]]));

  /**
   * @class Deserializer
   *
   * 把 JSON 字符串反解析成图形。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class Deserializer {
    constructor(ice) {
      _defineProperty(this, "ice", void 0);

      this.ice = ice;
    }

    fromJSON(jsonStr) {
      const jsonObj = JSON.parse(jsonStr);
      const childNodes = jsonObj.childNodes;

      for (let i = 0; i < childNodes.length; i++) {
        const node = childNodes[i];
        const Clazz = componentTypeMap[node.type]; // const props = node.props;

        const state = node.state;
        const instance = new Clazz(state); // instance.setState(state);

        this.ice.addChild(instance);
        return {};
      }

      return {};
    }

  }

  /**
   * @class Serializer
   *
   * 把图形序列化成 JSON 字符串。
   *
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */
  class Serializer {
    constructor(ice) {
      _defineProperty(this, "ice", void 0);

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
      this.ice.childNodes.forEach(child => {
        if (child instanceof ICEControlPanel) {
          console.warn('控制手柄类型的组件不需要存储...', child);
          return;
        }

        if (child.toJSON()) {
          result.childNodes.push(child.toJSON());
        }
      });
      console.log(result);
      return JSON.stringify(result);
    }

  }

  /**
   * @class CanvasRenderer
   * Canvas 渲染器，全局单例。
   * @author 大漠穷秋<damoqiongqiu@126.com>
   */

  class CanvasRenderer extends ICEEventTarget {
    constructor(ice) {
      super();

      _defineProperty(this, "ice", void 0);

      _defineProperty(this, "stopped", false);

      this.ice = ice;
    }

    start() {
      this.stopped = false;
      this.ice.evtBus.on(ICE_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
      return this;
    }

    stop() {
      this.stopped = true;
      this.ice.evtBus.off(ICE_CONSTS.ICE_FRAME_EVENT, this.frameEvtHandler, this);
      return this;
    } //FIXME:fix this when using increamental rendering
    //FIXME:动画有闪烁


    frameEvtHandler(evt) {
      if (this.stopped) return;
      console.log('CanvasRenderer...');
      this.ice.ctx.clearRect(0, 0, this.ice.canvasWidth, this.ice.canvasHeight);
      if (!this.ice.childNodes || !this.ice.childNodes.length) return; //根据组件的 zIndex 升序排列，保证 zIndex 大的组件在后面绘制。

      let arr = Array.from(this.ice.childNodes);
      arr.sort((firstEl, secondEl) => {
        return firstEl.state.zIndex - secondEl.state.zIndex;
      });
      arr.forEach(component => {
        this.renderRecursively(component);
      });
    }

    renderRecursively(component) {
      if (this.stopped) return;
      this.trigger(ICE_CONSTS.BEFORE_RENDER, null, {
        component: component
      });
      component.trigger(ICE_CONSTS.BEFORE_RENDER);

      if (component.state.isRendering) {
        return;
      }

      if (!component.state.display) {
        return;
      } //先渲染自己


      component.render(); //如果有子节点，递归

      if (component.childNodes && component.childNodes.length) {
        component.childNodes.forEach(child => {
          //子组件的 root/ctx/evtBus/ice 这4个属性总是和父组件保持一致
          child.root = component.root;
          child.ctx = component.ctx;
          child.evtBus = component.evtBus;
          child.ice = component.ice;
          child.parentNode = component;
          this.renderRecursively(child);
        });
      }

      component.trigger(ICE_CONSTS.AFTER_RENDER);
      this.trigger(ICE_CONSTS.AFTER_RENDER, null, {
        component: component
      });
    }

  }

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
    //所有直接添加到 canvas 的对象都在此结构中
    //事件总线，每一个 ICE 实例上只能有一个 evtBus 实例
    //在浏览器里面是 window 对象，在 NodeJS 环境里面是 global 对象
    //&lt;canvas&gt; tag
    //CanvasRenderingContext2D, @see https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D
    //当前选中的组件列表，支持 Ctrl 键同时选中多个组件。
    constructor() {
      _defineProperty(this, "version", pkg.version);

      _defineProperty(this, "childNodes", []);

      _defineProperty(this, "evtBus", void 0);

      _defineProperty(this, "root", void 0);

      _defineProperty(this, "canvasEl", void 0);

      _defineProperty(this, "ctx", void 0);

      _defineProperty(this, "canvasWidth", 0);

      _defineProperty(this, "canvasHeight", 0);

      _defineProperty(this, "canvasBoundingClientRect", void 0);

      _defineProperty(this, "selectionList", []);

      _defineProperty(this, "renderer", void 0);

      _defineProperty(this, "animationManager", void 0);

      _defineProperty(this, "eventBridge", void 0);

      _defineProperty(this, "ddManager", void 0);

      _defineProperty(this, "controlPanelManager", void 0);

      _defineProperty(this, "linkSlotManager", void 0);

      _defineProperty(this, "serializer", void 0);

      _defineProperty(this, "deserializer", void 0);
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
      return this;
    }
    /**
     *
     * 调用 ICE.addChild() 方法，会直接把对象画在 canvas 上。
     * 如果需要在容器中画组件，参见 @see ICEGroup.addChild() 方法
     *
     * @param component
     */


    addChild(component) {
      if (this.childNodes.indexOf(component) !== -1) return;
      component.trigger(ICE_CONSTS.BEFORE_ADD);
      component.ice = this;
      component.root = this.root;
      component.ctx = this.ctx;
      component.evtBus = this.evtBus;
      this.childNodes.push(component);

      if (Object.keys(component.props.animations).length) {
        this.animationManager.add(component);
      }

      component.trigger(ICE_CONSTS.AFTER_ADD);
    }

    addChildren(arr) {
      arr.forEach(child => {
        this.addChild(child);
      });
    }

    removeChild(component) {
      component.destory();
      this.childNodes.splice(this.childNodes.indexOf(component), 1);
    }

    removeChildren(arr) {
      arr.forEach(child => {
        this.removeChild(child);
      });
    }

    clearRenderMap() {
      //FIXME:不删除编辑工具类型的实例。
      this.removeChildren(this.childNodes);
    }
    /**
     * 把对象序列化成 JSON 字符串：
     * - 容器型组件需要负责子节点的序列化操作
     * - 如果组件不需要序列化，需要返回 null
     * @returns JSONObject
     */


    toJSON() {
      return this.serializer.toJSON();
    }

    fromJSON(jsonStr) {
      //先停止关键的管理器
      FrameManager.stop();
      this.renderer.stop();
      this.eventBridge.stopped = true;
      this.animationManager.stop();
      this.ddManager.stop();
      this.controlPanelManager.stop();
      this.linkSlotManager.stop();
      this.clearRenderMap(); //反序列化，创建组件实例

      this.deserializer.fromJSON(jsonStr); //重新启动关键管理器

      FrameManager.start();
      this.renderer.start();
      this.animationManager.start();
      this.ddManager.start();
      this.controlPanelManager.start();
      this.linkSlotManager.start();
      setTimeout(() => {
        this.eventBridge.stopped = false;
      }, 0);
    }

  }

  // import ICEStar from '../src/graphic/shape/ICEStar';

  let ice = new ICE().init('canvas-1');

  document.querySelector('#btn-1').addEventListener('click', (evt) => {
    const jsonStr = ice.toJSON();
    window.localStorage.setItem('json-data', jsonStr);
  });
  document.querySelector('#btn-2').addEventListener('click', (evt) => {
    const jsonStr = window.localStorage.getItem('json-data');
    ice.fromJSON(jsonStr);
  });

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

  let rect1 = new ICERect({
    left: 100,
    top: 20,
    width: 100,
    height: 100,
    style: {
      strokeStyle: '#0c09d4',
      fillStyle: '#f5d106',
      lineWidth: 5,
    },
    // animations: {
    //   left: { from: 0, to: 100, duration: 2000, easing: 'easeOutQuart' },
    //   // top: { from: 0, to: 200, duration: 3000 },
    //   width: { from: 100, to: 200, duration: 5000 },
    //   height: { from: 100, to: 200, duration: 5000 },
    // },
  });
  ice.addChild(rect1);

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
  //   endPoint: [600, 600],
  //   style: {
  //     strokeStyle: '#08ee00',
  //     fillStyle: '#008000',
  //     lineWidth: 5,
  //   },
  // });
  // ice.addChild(visioLink);

  // let visioLink2 = new ICEVisioLink({
  //   left: 0,
  //   top: 0,
  //   startPoint: [300, 300],
  //   endPoint: [400, 400],
  //   style: {
  //     strokeStyle: '#08ee00',
  //     fillStyle: '#008000',
  //     lineWidth: 5,
  //   },
  // });
  // ice.addChild(visioLink2);

  // let linkCircle3 = new ICECircle({
  //   left: 100,
  //   top: 500,
  //   radius: 50,
  // });
  // ice.addChild(linkCircle3);
  // console.log(linkCircle3 instanceof ICECircle);

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

})));
