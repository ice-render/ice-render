!function(t){"function"==typeof define&&define.amd?define(t):t()}((function(){"use strict";function t(t,e){var n=Object.keys(t);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(t);e&&(r=r.filter((function(e){return Object.getOwnPropertyDescriptor(t,e).enumerable}))),n.push.apply(n,r)}return n}function e(e){for(var n=1;n<arguments.length;n++){var r=null!=arguments[n]?arguments[n]:{};n%2?t(Object(r),!0).forEach((function(t){o(e,t,r[t])})):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(r)):t(Object(r)).forEach((function(t){Object.defineProperty(e,t,Object.getOwnPropertyDescriptor(r,t))}))}return e}function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}function r(t,e){for(var n=0;n<e.length;n++){var r=e[n];r.enumerable=r.enumerable||!1,r.configurable=!0,"value"in r&&(r.writable=!0),Object.defineProperty(t,r.key,r)}}function i(t,e,n){return e&&r(t.prototype,e),n&&r(t,n),t}function o(t,e,n){return e in t?Object.defineProperty(t,e,{value:n,enumerable:!0,configurable:!0,writable:!0}):t[e]=n,t}function a(t,e){if("function"!=typeof e&&null!==e)throw new TypeError("Super expression must either be null or a function");t.prototype=Object.create(e&&e.prototype,{constructor:{value:t,writable:!0,configurable:!0}}),e&&c(t,e)}function s(t){return(s=Object.setPrototypeOf?Object.getPrototypeOf:function(t){return t.__proto__||Object.getPrototypeOf(t)})(t)}function c(t,e){return(c=Object.setPrototypeOf||function(t,e){return t.__proto__=e,t})(t,e)}function u(t){if(void 0===t)throw new ReferenceError("this hasn't been initialised - super() hasn't been called");return t}function l(t,e){if(e&&("object"==typeof e||"function"==typeof e))return e;if(void 0!==e)throw new TypeError("Derived constructors may only return object or undefined");return u(t)}function h(t){var e=function(){if("undefined"==typeof Reflect||!Reflect.construct)return!1;if(Reflect.construct.sham)return!1;if("function"==typeof Proxy)return!0;try{return Boolean.prototype.valueOf.call(Reflect.construct(Boolean,[],(function(){}))),!0}catch(t){return!1}}();return function(){var n,r=s(t);if(e){var i=s(this).constructor;n=Reflect.construct(r,arguments,i)}else n=r.apply(this,arguments);return l(this,n)}}function f(t,e){for(;!Object.prototype.hasOwnProperty.call(t,e)&&null!==(t=s(t)););return t}function v(){return(v="undefined"!=typeof Reflect&&Reflect.get?Reflect.get:function(t,e,n){var r=f(t,e);if(r){var i=Object.getOwnPropertyDescriptor(r,e);return i.get?i.get.call(arguments.length<3?t:n):i.value}}).apply(this,arguments)}var d=Array.isArray,p="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};function y(t,e){return t(e={exports:{}},e.exports),e.exports}var g="object"==typeof p&&p&&p.Object===Object&&p,b="object"==typeof self&&self&&self.Object===Object&&self,m=g||b||Function("return this")(),x=m.Symbol,w=Object.prototype,O=w.hasOwnProperty,M=w.toString,_=x?x.toStringTag:void 0;var k=function(t){var e=O.call(t,_),n=t[_];try{t[_]=void 0;var r=!0}catch(t){}var i=M.call(t);return r&&(e?t[_]=n:delete t[_]),i},P=Object.prototype.toString;var E=function(t){return P.call(t)},D=x?x.toStringTag:void 0;var j=function(t){return null==t?void 0===t?"[object Undefined]":"[object Null]":D&&D in Object(t)?k(t):E(t)};var S=function(t){return null!=t&&"object"==typeof t};var B=function(t){return"symbol"==typeof t||S(t)&&"[object Symbol]"==j(t)},T=/\.|\[(?:[^[\]]*|(["'])(?:(?!\1)[^\\]|\\.)*?\1)\]/,C=/^\w*$/;var R=function(t,e){if(d(t))return!1;var n=typeof t;return!("number"!=n&&"symbol"!=n&&"boolean"!=n&&null!=t&&!B(t))||(C.test(t)||!T.test(t)||null!=e&&t in Object(e))};var N=function(t){var e=typeof t;return null!=t&&("object"==e||"function"==e)};var H,A=function(t){if(!N(t))return!1;var e=j(t);return"[object Function]"==e||"[object GeneratorFunction]"==e||"[object AsyncFunction]"==e||"[object Proxy]"==e},I=m["__core-js_shared__"],z=(H=/[^.]+$/.exec(I&&I.keys&&I.keys.IE_PROTO||""))?"Symbol(src)_1."+H:"";var L=function(t){return!!z&&z in t},F=Function.prototype.toString;var U=function(t){if(null!=t){try{return F.call(t)}catch(t){}try{return t+""}catch(t){}}return""},Y=/^\[object .+?Constructor\]$/,X=Function.prototype,W=Object.prototype,$=X.toString,q=W.hasOwnProperty,J=RegExp("^"+$.call(q).replace(/[\\^$.*+?()[\]{}|]/g,"\\$&").replace(/hasOwnProperty|(function).*?(?=\\\()| for .+?(?=\\\])/g,"$1.*?")+"$");var V=function(t){return!(!N(t)||L(t))&&(A(t)?J:Y).test(U(t))};var K=function(t,e){return null==t?void 0:t[e]};var G=function(t,e){var n=K(t,e);return V(n)?n:void 0},Q=G(Object,"create");var Z=function(){this.__data__=Q?Q(null):{},this.size=0};var tt=function(t){var e=this.has(t)&&delete this.__data__[t];return this.size-=e?1:0,e},et=Object.prototype.hasOwnProperty;var nt=function(t){var e=this.__data__;if(Q){var n=e[t];return"__lodash_hash_undefined__"===n?void 0:n}return et.call(e,t)?e[t]:void 0},rt=Object.prototype.hasOwnProperty;var it=function(t){var e=this.__data__;return Q?void 0!==e[t]:rt.call(e,t)};var ot=function(t,e){var n=this.__data__;return this.size+=this.has(t)?0:1,n[t]=Q&&void 0===e?"__lodash_hash_undefined__":e,this};function at(t){var e=-1,n=null==t?0:t.length;for(this.clear();++e<n;){var r=t[e];this.set(r[0],r[1])}}at.prototype.clear=Z,at.prototype.delete=tt,at.prototype.get=nt,at.prototype.has=it,at.prototype.set=ot;var st=at;var ct=function(){this.__data__=[],this.size=0};var ut=function(t,e){return t===e||t!=t&&e!=e};var lt=function(t,e){for(var n=t.length;n--;)if(ut(t[n][0],e))return n;return-1},ht=Array.prototype.splice;var ft=function(t){var e=this.__data__,n=lt(e,t);return!(n<0)&&(n==e.length-1?e.pop():ht.call(e,n,1),--this.size,!0)};var vt=function(t){var e=this.__data__,n=lt(e,t);return n<0?void 0:e[n][1]};var dt=function(t){return lt(this.__data__,t)>-1};var pt=function(t,e){var n=this.__data__,r=lt(n,t);return r<0?(++this.size,n.push([t,e])):n[r][1]=e,this};function yt(t){var e=-1,n=null==t?0:t.length;for(this.clear();++e<n;){var r=t[e];this.set(r[0],r[1])}}yt.prototype.clear=ct,yt.prototype.delete=ft,yt.prototype.get=vt,yt.prototype.has=dt,yt.prototype.set=pt;var gt=yt,bt=G(m,"Map");var mt=function(){this.size=0,this.__data__={hash:new st,map:new(bt||gt),string:new st}};var xt=function(t){var e=typeof t;return"string"==e||"number"==e||"symbol"==e||"boolean"==e?"__proto__"!==t:null===t};var wt=function(t,e){var n=t.__data__;return xt(e)?n["string"==typeof e?"string":"hash"]:n.map};var Ot=function(t){var e=wt(this,t).delete(t);return this.size-=e?1:0,e};var Mt=function(t){return wt(this,t).get(t)};var _t=function(t){return wt(this,t).has(t)};var kt=function(t,e){var n=wt(this,t),r=n.size;return n.set(t,e),this.size+=n.size==r?0:1,this};function Pt(t){var e=-1,n=null==t?0:t.length;for(this.clear();++e<n;){var r=t[e];this.set(r[0],r[1])}}Pt.prototype.clear=mt,Pt.prototype.delete=Ot,Pt.prototype.get=Mt,Pt.prototype.has=_t,Pt.prototype.set=kt;var Et=Pt;function Dt(t,e){if("function"!=typeof t||null!=e&&"function"!=typeof e)throw new TypeError("Expected a function");var n=function(){var r=arguments,i=e?e.apply(this,r):r[0],o=n.cache;if(o.has(i))return o.get(i);var a=t.apply(this,r);return n.cache=o.set(i,a)||o,a};return n.cache=new(Dt.Cache||Et),n}Dt.Cache=Et;var jt=Dt;var St=/[^.[\]]+|\[(?:(-?\d+(?:\.\d+)?)|(["'])((?:(?!\2)[^\\]|\\.)*?)\2)\]|(?=(?:\.|\[\])(?:\.|\[\]|$))/g,Bt=/\\(\\)?/g,Tt=function(t){var e=jt(t,(function(t){return 500===n.size&&n.clear(),t})),n=e.cache;return e}((function(t){var e=[];return 46===t.charCodeAt(0)&&e.push(""),t.replace(St,(function(t,n,r,i){e.push(r?i.replace(Bt,"$1"):n||t)})),e}));var Ct=function(t,e){for(var n=-1,r=null==t?0:t.length,i=Array(r);++n<r;)i[n]=e(t[n],n,t);return i},Rt=x?x.prototype:void 0,Nt=Rt?Rt.toString:void 0;var Ht=function t(e){if("string"==typeof e)return e;if(d(e))return Ct(e,t)+"";if(B(e))return Nt?Nt.call(e):"";var n=e+"";return"0"==n&&1/e==-1/0?"-0":n};var At=function(t){return null==t?"":Ht(t)};var It=function(t,e){return d(t)?t:R(t,e)?[t]:Tt(At(t))};var zt=function(t){if("string"==typeof t||B(t))return t;var e=t+"";return"0"==e&&1/t==-1/0?"-0":e};var Lt=function(t,e){for(var n=0,r=(e=It(e,t)).length;null!=t&&n<r;)t=t[zt(e[n++])];return n&&n==r?t:void 0};var Ft=function(t,e,n){var r=null==t?void 0:Lt(t,e);return void 0===r?n:r};var Ut=function(){this.__data__=new gt,this.size=0};var Yt=function(t){var e=this.__data__,n=e.delete(t);return this.size=e.size,n};var Xt=function(t){return this.__data__.get(t)};var Wt=function(t){return this.__data__.has(t)};var $t=function(t,e){var n=this.__data__;if(n instanceof gt){var r=n.__data__;if(!bt||r.length<199)return r.push([t,e]),this.size=++n.size,this;n=this.__data__=new Et(r)}return n.set(t,e),this.size=n.size,this};function qt(t){var e=this.__data__=new gt(t);this.size=e.size}qt.prototype.clear=Ut,qt.prototype.delete=Yt,qt.prototype.get=Xt,qt.prototype.has=Wt,qt.prototype.set=$t;var Jt=qt,Vt=function(){try{var t=G(Object,"defineProperty");return t({},"",{}),t}catch(t){}}();var Kt=function(t,e,n){"__proto__"==e&&Vt?Vt(t,e,{configurable:!0,enumerable:!0,value:n,writable:!0}):t[e]=n};var Gt=function(t,e,n){(void 0!==n&&!ut(t[e],n)||void 0===n&&!(e in t))&&Kt(t,e,n)};var Qt=function(t){return function(e,n,r){for(var i=-1,o=Object(e),a=r(e),s=a.length;s--;){var c=a[t?s:++i];if(!1===n(o[c],c,o))break}return e}}(),Zt=y((function(t,e){var n=e&&!e.nodeType&&e,r=n&&t&&!t.nodeType&&t,i=r&&r.exports===n?m.Buffer:void 0,o=i?i.allocUnsafe:void 0;t.exports=function(t,e){if(e)return t.slice();var n=t.length,r=o?o(n):new t.constructor(n);return t.copy(r),r}})),te=m.Uint8Array;var ee=function(t){var e=new t.constructor(t.byteLength);return new te(e).set(new te(t)),e};var ne=function(t,e){var n=e?ee(t.buffer):t.buffer;return new t.constructor(n,t.byteOffset,t.length)};var re=function(t,e){var n=-1,r=t.length;for(e||(e=Array(r));++n<r;)e[n]=t[n];return e},ie=Object.create,oe=function(){function t(){}return function(e){if(!N(e))return{};if(ie)return ie(e);t.prototype=e;var n=new t;return t.prototype=void 0,n}}();var ae=function(t,e){return function(n){return t(e(n))}}(Object.getPrototypeOf,Object),se=Object.prototype;var ce=function(t){var e=t&&t.constructor;return t===("function"==typeof e&&e.prototype||se)};var ue=function(t){return"function"!=typeof t.constructor||ce(t)?{}:oe(ae(t))};var le=function(t){return S(t)&&"[object Arguments]"==j(t)},he=Object.prototype,fe=he.hasOwnProperty,ve=he.propertyIsEnumerable,de=le(function(){return arguments}())?le:function(t){return S(t)&&fe.call(t,"callee")&&!ve.call(t,"callee")};var pe=function(t){return"number"==typeof t&&t>-1&&t%1==0&&t<=9007199254740991};var ye=function(t){return null!=t&&pe(t.length)&&!A(t)};var ge=function(t){return S(t)&&ye(t)};var be=function(){return!1},me=y((function(t,e){var n=e&&!e.nodeType&&e,r=n&&t&&!t.nodeType&&t,i=r&&r.exports===n?m.Buffer:void 0,o=(i?i.isBuffer:void 0)||be;t.exports=o})),xe=Function.prototype,we=Object.prototype,Oe=xe.toString,Me=we.hasOwnProperty,_e=Oe.call(Object);var ke=function(t){if(!S(t)||"[object Object]"!=j(t))return!1;var e=ae(t);if(null===e)return!0;var n=Me.call(e,"constructor")&&e.constructor;return"function"==typeof n&&n instanceof n&&Oe.call(n)==_e},Pe={};Pe["[object Float32Array]"]=Pe["[object Float64Array]"]=Pe["[object Int8Array]"]=Pe["[object Int16Array]"]=Pe["[object Int32Array]"]=Pe["[object Uint8Array]"]=Pe["[object Uint8ClampedArray]"]=Pe["[object Uint16Array]"]=Pe["[object Uint32Array]"]=!0,Pe["[object Arguments]"]=Pe["[object Array]"]=Pe["[object ArrayBuffer]"]=Pe["[object Boolean]"]=Pe["[object DataView]"]=Pe["[object Date]"]=Pe["[object Error]"]=Pe["[object Function]"]=Pe["[object Map]"]=Pe["[object Number]"]=Pe["[object Object]"]=Pe["[object RegExp]"]=Pe["[object Set]"]=Pe["[object String]"]=Pe["[object WeakMap]"]=!1;var Ee=function(t){return S(t)&&pe(t.length)&&!!Pe[j(t)]};var De=function(t){return function(e){return t(e)}},je=y((function(t,e){var n=e&&!e.nodeType&&e,r=n&&t&&!t.nodeType&&t,i=r&&r.exports===n&&g.process,o=function(){try{var t=r&&r.require&&r.require("util").types;return t||i&&i.binding&&i.binding("util")}catch(t){}}();t.exports=o})),Se=je&&je.isTypedArray,Be=Se?De(Se):Ee;var Te=function(t,e){if(("constructor"!==e||"function"!=typeof t[e])&&"__proto__"!=e)return t[e]},Ce=Object.prototype.hasOwnProperty;var Re=function(t,e,n){var r=t[e];Ce.call(t,e)&&ut(r,n)&&(void 0!==n||e in t)||Kt(t,e,n)};var Ne=function(t,e,n,r){var i=!n;n||(n={});for(var o=-1,a=e.length;++o<a;){var s=e[o],c=r?r(n[s],t[s],s,n,t):void 0;void 0===c&&(c=t[s]),i?Kt(n,s,c):Re(n,s,c)}return n};var He=function(t,e){for(var n=-1,r=Array(t);++n<t;)r[n]=e(n);return r},Ae=/^(?:0|[1-9]\d*)$/;var Ie=function(t,e){var n=typeof t;return!!(e=null==e?9007199254740991:e)&&("number"==n||"symbol"!=n&&Ae.test(t))&&t>-1&&t%1==0&&t<e},ze=Object.prototype.hasOwnProperty;var Le=function(t,e){var n=d(t),r=!n&&de(t),i=!n&&!r&&me(t),o=!n&&!r&&!i&&Be(t),a=n||r||i||o,s=a?He(t.length,String):[],c=s.length;for(var u in t)!e&&!ze.call(t,u)||a&&("length"==u||i&&("offset"==u||"parent"==u)||o&&("buffer"==u||"byteLength"==u||"byteOffset"==u)||Ie(u,c))||s.push(u);return s};var Fe=function(t){var e=[];if(null!=t)for(var n in Object(t))e.push(n);return e},Ue=Object.prototype.hasOwnProperty;var Ye=function(t){if(!N(t))return Fe(t);var e=ce(t),n=[];for(var r in t)("constructor"!=r||!e&&Ue.call(t,r))&&n.push(r);return n};var Xe=function(t){return ye(t)?Le(t,!0):Ye(t)};var We=function(t){return Ne(t,Xe(t))};var $e=function(t,e,n,r,i,o,a){var s=Te(t,n),c=Te(e,n),u=a.get(c);if(u)Gt(t,n,u);else{var l=o?o(s,c,n+"",t,e,a):void 0,h=void 0===l;if(h){var f=d(c),v=!f&&me(c),p=!f&&!v&&Be(c);l=c,f||v||p?d(s)?l=s:ge(s)?l=re(s):v?(h=!1,l=Zt(c,!0)):p?(h=!1,l=ne(c,!0)):l=[]:ke(c)||de(c)?(l=s,de(s)?l=We(s):N(s)&&!A(s)||(l=ue(c))):h=!1}h&&(a.set(c,l),i(l,c,r,o,a),a.delete(c)),Gt(t,n,l)}};var qe=function t(e,n,r,i,o){e!==n&&Qt(n,(function(a,s){if(o||(o=new Jt),N(a))$e(e,n,s,r,t,i,o);else{var c=i?i(Te(e,s),a,s+"",e,n,o):void 0;void 0===c&&(c=a),Gt(e,s,c)}}),Xe)};var Je=function(t){return t};var Ve=function(t,e,n){switch(n.length){case 0:return t.call(e);case 1:return t.call(e,n[0]);case 2:return t.call(e,n[0],n[1]);case 3:return t.call(e,n[0],n[1],n[2])}return t.apply(e,n)},Ke=Math.max;var Ge=function(t,e,n){return e=Ke(void 0===e?t.length-1:e,0),function(){for(var r=arguments,i=-1,o=Ke(r.length-e,0),a=Array(o);++i<o;)a[i]=r[e+i];i=-1;for(var s=Array(e+1);++i<e;)s[i]=r[i];return s[e]=n(a),Ve(t,this,s)}};var Qe=function(t){return function(){return t}},Ze=Vt?function(t,e){return Vt(t,"toString",{configurable:!0,enumerable:!1,value:Qe(e),writable:!0})}:Je,tn=Date.now;var en=function(t){var e=0,n=0;return function(){var r=tn(),i=16-(r-n);if(n=r,i>0){if(++e>=800)return arguments[0]}else e=0;return t.apply(void 0,arguments)}}(Ze);var nn=function(t,e){return en(Ge(t,e,Je),t+"")};var rn=function(t,e,n){if(!N(n))return!1;var r=typeof e;return!!("number"==r?ye(n)&&Ie(e,n.length):"string"==r&&e in n)&&ut(n[e],t)};var on=function(t){return nn((function(e,n){var r=-1,i=n.length,o=i>1?n[i-1]:void 0,a=i>2?n[2]:void 0;for(o=t.length>3&&"function"==typeof o?(i--,o):void 0,a&&rn(n[0],n[1],a)&&(o=i<3?void 0:o,i=1),e=Object(e);++r<i;){var s=n[r];s&&t(e,s,r,o)}return e}))}((function(t,e,n){qe(t,e,n)})),an=window||global,sn=function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};for(var r in n(this,t),o(this,"originalEvent",void 0),o(this,"target",void 0),e)this[r]=e[r]},cn=function(){function t(){n(this,t),o(this,"listeners",{}),o(this,"suspendedEventNames",[])}return i(t,[{key:"on",value:function(t,e){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:an;this.listeners[t]||(this.listeners[t]=[]),this.off(t,e,n),this.listeners[t].push({callback:e,scope:n})}},{key:"off",value:function(t,e){var n=arguments.length>2&&void 0!==arguments[2]?arguments[2]:an,r=this.listeners[t];if(r)for(var i=0;i<r.length;i++){var o=r[i];if(o.callback===e&&o.scope===n)return void this.listeners[t].splice(i,1)}}},{key:"once",value:function(t,e){var n=this,r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:an;this.on(t,(function(r,i){n.off(t,e,i),e.call(i,r)}),r)}},{key:"trigger",value:function(t){var e,n=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;return!!this.listeners[t]&&(!this.suspendedEventNames.includes(t)&&(n?(e=new sn(n)).originalEvent=n:e=new sn({type:t,timeStamp:(new Date).getTime()}),this.listeners[t].forEach((function(t){var n=t.callback,r=t.scope;n.call(r,e)})),!0))}},{key:"suspend",value:function(t,e){t&&!this.suspendedEventNames.includes(t)&&this.suspendedEventNames.push(t),e&&(e.prototype.suspended=!0)}},{key:"resume",value:function(t,e){t&&this.suspendedEventNames.includes(t)&&this.suspendedEventNames.splice(this.suspendedEventNames.findIndex(t),1),e&&(e.prototype.suspended=!1)}},{key:"purge",value:function(){this.listeners={}}}]),t}();cn.prototype.addEventListener=cn.prototype.on,cn.prototype.removeEventListener=cn.prototype.off,cn.prototype.dispatchEvent=cn.prototype.trigger;var un=function(){function t(){throw n(this,t),new Error("GeometryUtil is a static util class.")}return i(t,null,[{key:"containsPoint",value:function(t,e){return!1}},{key:"isIntersect",value:function(t,e){return!1}},{key:"getLength",value:function(t,e,n,r){return Math.sqrt((n-t)*(n-t)+(r-e)*(r-e))}}]),t}(),ln=function(){function t(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:[0,0,0,0,0,0,0,0];n(this,t),o(this,"tl",new DOMPoint),o(this,"tr",new DOMPoint),o(this,"bl",new DOMPoint),o(this,"br",new DOMPoint),this.tl=new DOMPoint(e[0],e[1]),this.tr=new DOMPoint(e[2],e[3]),this.bl=new DOMPoint(e[4],e[5]),this.br=new DOMPoint(e[6],e[7])}return i(t,[{key:"containsPoint",value:function(t){var e=this.getMinAndMaxPoint(),n=e.minX,r=e.minY,i=e.maxX,o=e.maxY;if(t.x<n||t.x>i||t.y<r||t.y>o)return!1;for(var a,s=0,c=this.getBoundingLines(),u=0;u<c.length;u++){var l=c[u];if(!(t.y>l.o.y&&t.y>l.d.y)&&!(t.y<l.o.y&&t.y<l.d.y)){if(l.o.x===l.d.x&&l.o.x>=t.x)a=l.o.x;else{var h=(l.d.y-l.o.y)/(l.d.x-l.o.x);a=l.o.x+(t.y-l.o.y)/h}a>t.x&&s++}}return 0!==s&&s%2==1}},{key:"getBoundingLines",value:function(){return[{o:DOMPoint.fromPoint(this.tl),d:DOMPoint.fromPoint(this.tr)},{o:DOMPoint.fromPoint(this.tr),d:DOMPoint.fromPoint(this.br)},{o:DOMPoint.fromPoint(this.br),d:DOMPoint.fromPoint(this.bl)},{o:DOMPoint.fromPoint(this.bl),d:DOMPoint.fromPoint(this.tl)}]}},{key:"getMinAndMaxPoint",value:function(){var t=this.tl.x,e=this.tl.y,n=this.tl.x,r=this.tl.y;return[this.tr,this.bl,this.br].forEach((function(i){i.x<t&&(t=i.x),i.x>n&&(n=i.x),i.y<e&&(e=i.y),i.y>r&&(r=i.y)})),{minX:t,minY:e,maxX:n,maxY:r}}},{key:"containsBox",value:function(t){return!1}},{key:"isIntersect",value:function(t){return!1}},{key:"transform",value:function(e){var n=DOMPoint.fromPoint(this.tl).matrixTransform(e),r=DOMPoint.fromPoint(this.tr).matrixTransform(e),i=DOMPoint.fromPoint(this.bl).matrixTransform(e),o=DOMPoint.fromPoint(this.br).matrixTransform(e);return new t([n.x,n.y,r.x,r.y,i.x,i.y,o.x,o.y])}},{key:"union",value:function(t){return null}},{key:"width",get:function(){return un.getLength(this.br.x,this.br.y,this.bl.x,this.bl.y)}},{key:"height",get:function(){return un.getLength(this.br.x,this.br.y,this.tr.x,this.tr.y)}},{key:"left",get:function(){return this.tl.x},set:function(t){}},{key:"centerX",get:function(){return this.left+this.width/2}},{key:"centerY",get:function(){return this.top+this.height/2}},{key:"centerPoint",get:function(){return new DOMPoint(this.centerX,this.centerY)}},{key:"top",get:function(){return this.tl.y},set:function(t){}}]),t}(),hn="ICE_FRAME_EVENT",fn="BEFORE_RENDER",vn="AFTER_RENDER",dn=function(t){a(s,t);var r=h(s);function s(){var t,i=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return n(this,s),o(u(t=r.call(this)),"root",null),o(u(t),"ctx",null),o(u(t),"parentNode",null),o(u(t),"isRendering",!1),o(u(t),"props",{id:"ICE_"+Math.floor(1e10*Math.random()),left:0,top:0,width:0,height:0,style:{fillStyle:"red",strokeStyle:"blue",lineWidth:1},animations:{},transform:{translate:[0,0],scale:[1,1],skew:[0,0],rotate:0},translationMatrix:new DOMMatrix,linearMatrix:new DOMMatrix,composedMatrix:new DOMMatrix,origin:new DOMPoint(0,0),zIndex:s.instanceCounter++,draggable:!0,selectable:!0,interactive:!0}),o(u(t),"state",e({},t.props)),t.props=on(t.props,i),t.state=JSON.parse(JSON.stringify(t.props)),t}return i(s,[{key:"setState",value:function(t){on(this.state,t)}},{key:"setPosition",value:function(t,n){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:new sn;this.trigger("before-move",e(e({},r),{},{left:t,top:n})),this.setState({left:t,top:n}),this.trigger("after-move",e(e({},r),{},{left:t,top:n}))}},{key:"movePosition",value:function(t,n){var r=arguments.length>2&&void 0!==arguments[2]?arguments[2]:new sn;this.setPosition(this.state.left+t,this.state.top+n,e(e({},r),{},{tx:t,ty:n}))}},{key:"render",value:function(){this.isRendering=!0,this.trigger(fn),this.applyStyle(),this.calcOriginalDimension(),this.setLocalOrigin("center"),this.applyTransformToCtx(),this.doRender(),this.ctx.setTransform(new DOMMatrix),this.trigger(vn),this.isRendering=!1}},{key:"applyStyle",value:function(){Object.assign(this.ctx,e(e({},this.props.style),this.state.style))}},{key:"calcOriginalDimension",value:function(){return{width:this.state.width,height:this.state.height}}},{key:"setLocalOrigin",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"center",e=new DOMPoint,n=this.state.width/2,r=this.state.height/2;if("center"===t&&(e.x=n,e.y=r),this.parentNode){var i=Ft(this,"state.transform.translate.0")+this.state.left,o=Ft(this,"state.transform.translate.1")+this.state.top;e.x=this.parentNode.state.origin.x-i,e.y=this.parentNode.state.origin.y-o}this.state.origin=e}},{key:"calcTranslationMatrix",value:function(){var t=new DOMMatrix,e=Ft(this,"state.transform.translate.0")+this.state.left,n=Ft(this,"state.transform.translate.1")+this.state.top;return t.translateSelf(e,n),this.state.translationMatrix=t,t}},{key:"calcLinearMatrix",value:function(){var t=new DOMMatrix,e=Ft(this,"state.transform.skew.0"),n=Ft(this,"state.transform.skew.1");t.skewXSelf(e),t.skewYSelf(n);var r=Ft(this,"state.transform.rotate");t.rotateSelf(r);var i=Ft(this,"state.transform.scale.0"),o=Ft(this,"state.transform.scale.1");return t.scaleSelf(i,o),this.state.linearMatrix=t,t}},{key:"calcAbsoluteTranslationMatrix",value:function(){for(var t=this,e=DOMMatrix.fromMatrix(t.calcTranslationMatrix());t.parentNode;)e.multiplySelf(t.parentNode.state.translationMatrix),t=t.parentNode;return this.state.absoluteTranslateMatrix=DOMMatrix.fromMatrix(e),e}},{key:"calcAbsoluteLinearMatrix",value:function(){for(var t=this,e=DOMMatrix.fromMatrix(t.calcLinearMatrix());t.parentNode;)e.multiplySelf(t.parentNode.state.linearMatrix),t=t.parentNode;return this.state.absoluteLinearMatrix=DOMMatrix.fromMatrix(e),e}},{key:"composeMatrix",value:function(){var t=this.calcAbsoluteTranslationMatrix(),e=new DOMMatrix([1,0,0,1,this.state.origin.x,this.state.origin.y]);t.multiplySelf(e);var n=this.calcAbsoluteLinearMatrix(),r=t.multiplySelf(n);return this.state.composedMatrix=DOMMatrix.fromMatrix(r),r}},{key:"applyTransformToCtx",value:function(){this.ctx.setTransform(this.composeMatrix())}},{key:"doRender",value:function(){var t=this.getMinBoundingBox();this.ctx.setTransform(new DOMMatrix),this.ctx.lineWidth=1,this.ctx.strokeStyle="#ff0000",this.ctx.fillStyle="rgba(0,0,0,0)",this.ctx.beginPath(),this.ctx.moveTo(t.tl.x,t.tl.y),this.ctx.lineTo(t.tr.x,t.tr.y),this.ctx.lineTo(t.br.x,t.br.y),this.ctx.lineTo(t.bl.x,t.bl.y),this.ctx.closePath(),this.ctx.stroke(),this.ctx.fill();var e=this.getMaxBoundingBox();this.ctx.setTransform(new DOMMatrix),this.ctx.lineWidth=1,this.ctx.strokeStyle="#0000ff",this.ctx.fillStyle="rgba(0,0,0,0)",this.ctx.beginPath(),this.ctx.moveTo(e.tl.x,e.tl.y),this.ctx.lineTo(e.tr.x,e.tr.y),this.ctx.lineTo(e.br.x,e.br.y),this.ctx.lineTo(e.bl.x,e.bl.y),this.ctx.closePath(),this.ctx.stroke(),this.ctx.fill()}},{key:"getMinBoundingBox",value:function(){var t=this.state.origin.x,e=this.state.origin.y,n=this.state.width,r=this.state.height,i=new ln([0-t,0-e,n-t,0-e,0-t,r-e,n-t,r-e]);return i=i.transform(this.state.composedMatrix)}},{key:"getMaxBoundingBox",value:function(){var t=this.getMinBoundingBox(),e=t.getMinAndMaxPoint(),n=e.minX,r=e.minY,i=e.maxX,o=e.maxY;return t=new ln([n,r,i,r,n,o,i,o])}},{key:"toJSON",value:function(){return"{}"}},{key:"fromJSON",value:function(t){return{}}}]),s}(cn);o(dn,"instanceCounter",0);var pn=function(t){a(r,t);var e=h(r);function r(){var t,i=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return n(this,r),o(u(t=e.call(this,i)),"path2D",new Path2D),t}return i(r,[{key:"doRender",value:function(){this.createPathObject(),this.ctx.beginPath(),this.ctx.stroke(this.path2D),this.ctx.fill(this.path2D),v(s(r.prototype),"doRender",this).call(this)}}]),r}(dn),yn=function(t){a(o,t);var r=h(o);function o(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return n(this,o),r.call(this,e({width:10,height:10},t))}return i(o,[{key:"calcOriginalDots",value:function(){var t=new DOMPoint(0,0),e=new DOMPoint(this.state.width,0),n=new DOMPoint(this.state.width,this.state.height),r=new DOMPoint(0,this.state.height);return this.state.dots=[t,e,n,r],this.state.dots}}]),o}(function(t){a(o,t);var r=h(o);function o(t){return n(this,o),r.call(this,e({dots:[]},t))}return i(o,[{key:"calcOriginalDimension",value:function(){this.calcOriginalDots();var t=this.calc4PointsFromDots(),e=t[1].x-t[0].x,n=t[2].y-t[0].y;return this.state.width=e,this.state.height=n,{width:this.state.width,height:this.state.height}}},{key:"createPathObject",value:function(){this.path2D=new Path2D;for(var t=0;t<this.state.dots.length;t++){var e=this.state.dots[t];0===t?this.path2D.moveTo(e.x,e.y):this.path2D.lineTo(e.x,e.y)}return this.path2D.closePath(),this.path2D}},{key:"calcOriginalDots",value:function(){return this.state.dots=[],this.state.dots}},{key:"setLocalOrigin",value:function(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:"center";v(s(o.prototype),"setLocalOrigin",this).call(this,t);for(var e=0;e<this.state.dots.length;e++){var n=this.state.dots[e];n=n.matrixTransform(new DOMMatrix([1,0,0,1,-this.state.origin.x,-this.state.origin.y])),this.state.dots[e]=n}}},{key:"calc4PointsFromDots",value:function(){for(var t=0,e=0,n=0,r=0,i=0;i<this.state.dots.length;i++){var o=this.state.dots[i];0===i?(t=o.x,n=o.x,e=o.y,r=o.y):(o.x<t&&(t=o.x),o.x>n&&(n=o.x),o.y<e&&(e=o.y),o.y>r&&(r=o.y))}var a=n,s=e,c=t,u=r,l=n,h=r;return[new DOMPoint(t,e),new DOMPoint(a,s),new DOMPoint(c,u),new DOMPoint(l,h)]}}]),o}(pn));var gn=function(t){return"string"==typeof t||!d(t)&&S(t)&&"[object String]"==j(t)},bn="0.0.1";var mn=function(t){return void 0===t},xn={linear:function(t,e,n,r){return t+(e-t)/n*(Date.now()-r)},easeInQuad:function(t,e,n,r){var i=Date.now()-r;return t+(e-t)/n*(i/n)*i}},wn=function(){function t(e){n(this,t),o(this,"animationMap",new Map),o(this,"ice",void 0),this.ice=e}return i(t,[{key:"start",value:function(){var t=this;return this.ice.evtBus.on(hn,(function(e){t.animationMap.forEach((function(e){e.state.interactive=!1,t.tween(e),e.state.interactive=!0}))})),this}},{key:"tween",value:function(t){var n={},r=t.props.animations,i=1;for(var o in r){var a=r[o];if(a.finished){if(++i===Object.keys(r).length){this.remove(t);break}}else{var s=a.from,c=a.to,u=a.duration;mn(a.startTime)&&(a.startTime=Date.now()),mn(a.easing)&&(a.easing="linear");var l=xn[a.easing](s,c,u,a.startTime);l>c&&(l=c,a.finished=!0),n[o]=Math.floor(l)}}return t.setState(e({},n)),t}},{key:"add",value:function(t){this.animationMap.set(t.props.id,t)}},{key:"remove",value:function(t){gn(t)?this.animationMap.delete(t):this.animationMap.delete(t.props.id)}},{key:"stop",value:function(){}}]),t}(),On={evtBuses:[],frameCallback:function(){On.evtBuses.forEach((function(t){t.trigger(hn)})),an.requestAnimationFrame(On.frameCallback)},start:function(){an.requestAnimationFrame(On.frameCallback)},stop:function(){},pause:function(){},resume:function(){},regitserEvtBus:function(t){On.evtBuses.includes(t)||On.evtBuses.push(t)},delEvtBus:function(t){On.evtBuses.includes(t)&&On.evtBuses.splice(On.evtBuses.indexOf(t),1)}},Mn=function(){function t(e){n(this,t),o(this,"ice",void 0),this.ice=e}return i(t,[{key:"mouseDownHandler",value:function(t){this.ice.evtBus.on("mousemove",this.mouseMoveHandler,this),this.ice.evtBus.on("mouseup",this.mouseUpHandler,this)}},{key:"mouseMoveHandler",value:function(t){this.ice.selectionList.forEach((function(e){var n=t.movementX/window.devicePixelRatio,r=t.movementY/window.devicePixelRatio;if(e.parentNode){var i=new DOMPoint(n,r),o=e.state.absoluteLinearMatrix;o=o.inverse(),n=(i=i.matrixTransform(o)).x,r=i.y}return e.movePosition(n,r,t),!0}))}},{key:"mouseUpHandler",value:function(t){this.ice.evtBus.off("mousemove",this.mouseMoveHandler,this),this.ice.evtBus.off("mouseup",this.mouseUpHandler,this)}},{key:"start",value:function(){return this.ice.evtBus.on("mousedown",this.mouseDownHandler,this),this}},{key:"stop",value:function(){}}]),t}(),_n=[["click","ICE_CLICK"],["dbclick","ICE_DBCLICK"],["mousedown","ICE_MOUSEDOWN"],["mouseup","ICE_MOUSEUP"],["mousemove","ICE_MOUSEMOVE"],["mouseenter","ICE_MOUSEENTER"],["mouseleave","ICE_MOUSELEAVE"],["mouseout","ICE_MOUSEOUT"],["mouseover","ICE_MOUSEOVER"],["contextmenu","ICE_CONTEXTMENU"],["mousewheel","ICE_MOUSEWHEEL"]],kn=function(){function t(e){n(this,t),o(this,"selectionCandidates",[]),o(this,"ice",void 0),this.ice=e}return i(t,[{key:"start",value:function(){var t=this;return _n.forEach((function(e){t.ice.evtBus.on(e[1],(function(n){var r=t.findTargetElement(n.clientX,n.clientY);r&&(n.target=r,r.trigger(e[0],n)),t.ice.evtBus.trigger(e[0],n)}))})),this.ice.evtBus.on("mousedown",(function(e){var n=e.target;console.log(n),n.state.interactive&&(e.ctrlKey?t.ice.selectionList.push(n):t.ice.selectionList=[n],t.ice.evtBus.trigger("select",e))})),this}},{key:"findTargetElement",value:function(t,e){for(var n=t-this.ice.canvasBoundingClientRect.left,r=e-this.ice.canvasBoundingClientRect.top,i=Array.from(this.ice.renderMap.values()),o=0;o<i.length;o++){var a=i[o];this.traverse(n,r,a)}this.selectionCandidates.sort((function(t,e){return t.zIndex-e.zIndex}));var s=this.selectionCandidates[0];return this.selectionCandidates=[],s}},{key:"traverse",value:function(t,e,n){var r=this;n.childNodes&&n.childNodes.length&&n.childNodes.forEach((function(n){r.traverse(t,e,n)})),n.getMinBoundingBox().containsPoint(new DOMPoint(t,e))&&n.state.interactive&&this.selectionCandidates.push(n)}}]),t}(),Pn=function(t){a(r,t);var e=h(r);function r(){return n(this,r),e.call(this)}return r}(cn),En={evtBuses:[],start:function(){an&&an.document&&an.document.addEventListener&&En.evtBuses.forEach((function(t){_n.forEach((function(e){an.document.addEventListener(e[0],(function(n){t.trigger(e[1],n)}))}))}))},regitserEvtBus:function(t){En.evtBuses.includes(t)||En.evtBuses.push(t)},delEvtBus:function(t){En.evtBuses.includes(t)&&En.evtBuses.splice(En.evtBuses.indexOf(t),1)}},Dn=function(){function t(e){n(this,t),o(this,"ice",void 0),this.ice=e}return i(t,[{key:"start",value:function(){var t=this;return this.ice.evtBus.on(hn,(function(e){t.ice.ctx.clearRect(0,0,t.ice.canvasWidth,t.ice.canvasHeight),t.ice.renderMap&&t.ice.renderMap.size&&t.ice.renderMap.forEach((function(t){!t.isRendering&&t.render()}))})),this}},{key:"stop",value:function(){throw new Error("Method not implemented.")}}]),t}(),jn=function(t){a(r,t);var e=h(r);function r(t){var i;return n(this,r),o(u(i=e.call(this,t)),"parentNode",null),o(u(i),"childNodes",[]),i}return i(r,[{key:"addChild",value:function(t){t.parentNode=this,this.childNodes.push(t)}},{key:"removeChild",value:function(t){t.parentNode=null,t.ctx=null,t.root=null,this.childNodes.splice(this.childNodes.indexOf(t),1)}},{key:"renderChildren",value:function(){var t=this;this.childNodes.forEach((function(e){e.ctx=t.ctx,e.root=t.root,e.render()}))}},{key:"render",value:function(){v(s(r.prototype),"render",this).call(this),this.renderChildren()}}]),r}(yn),Sn=function(t){a(r,t);var e=h(r);function r(t){var i;return n(this,r),(i=e.call(this,t)).on("after-move",i.rotateEvtHandler,u(i)),i}return i(r,[{key:"rotateEvtHandler",value:function(t){var e=this.props.host.state,n=e.origin,r=e.absoluteTranslateMatrix,i=n.matrixTransform(r),o=t.clientX-i.x,a=t.clientY-i.y,s=o/Math.sqrt(o*o+a*a),c=(a/Math.sqrt(o*o+a*a)<0?-1:1)*Math.acos(s)*180/Math.PI+90;this.props.host.setState({transform:{rotate:c}})}}]),r}(function(t){a(o,t);var r=h(o);function o(){var t=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return n(this,o),r.call(this,e({radius:10},t))}return i(o,[{key:"createPathObject",value:function(){return this.path2D=new Path2D,this.path2D.arc(this.state.radius-this.state.origin.x,this.state.radius-this.state.origin.y,this.state.radius,0,2*Math.PI),this.path2D.closePath(),this.path2D}},{key:"calcOriginalDimension",value:function(){return this.state.width=2*this.props.radius,this.state.height=2*this.props.radius,{width:this.state.width,height:this.state.height}}}]),o}(pn)),Bn=function(t){a(o,t);var r=h(o);function o(t){var i;return n(this,o),(i=r.call(this,e({position:"l"},t))).on("after-move",i.scaleToCenter,u(i)),i}return i(o,[{key:"scaleToCenter",value:function(t){var e=t.movementX/window.devicePixelRatio,n=t.movementY/window.devicePixelRatio,r=this.props.host.state,i=r.left,o=r.top,a=r.width,s=r.height,c=this.props.position,u=new DOMPoint(e,n),l=r.absoluteLinearMatrix;switch(l=l.inverse(),e=(u=u.matrixTransform(l)).x,n=u.y,c){case"tl":i+=e,o+=n,a-=2*e,s-=2*n;break;case"l":i+=e,a-=2*e;break;case"lb":i+=e,o-=n,a-=2*e,s+=2*n;break;case"tr":i-=e,o+=n,a+=2*e,s-=2*n;break;case"r":i-=e,a+=2*e;break;case"rb":i-=e,o-=n,a+=2*e,s+=2*n;break;case"t":o+=n,s-=2*n;break;case"b":o-=n,s+=2*n}this.props.host.setState({top:o,left:i,width:Math.abs(a),height:Math.abs(s)})}}]),o}(yn),Tn=function(t){a(c,t);var r=h(c);function c(t){var i;return n(this,c),o(u(i=r.call(this,e(e({},t),{},{draggable:!1}))),"scaleHandleInstanceCache",[]),o(u(i),"rotateHandleInstance",void 0),o(u(i),"scaleHandleSize",16),o(u(i),"rotateHandleSize",8),o(u(i),"rotateHandleOffsetY",60),o(u(i),"scaleHandleConfig",[{position:"tl"},{position:"t"},{position:"tr"},{position:"r"},{position:"rb"},{position:"b"},{position:"lb"},{position:"l"}]),i.initTransformationHandles(),i}return i(c,[{key:"initTransformationHandles",value:function(){var t=this;this.scaleHandleInstanceCache=[],this.scaleHandleConfig.forEach((function(e){var n=new Bn({host:t,left:0,top:0,width:t.scaleHandleSize,height:t.scaleHandleSize,style:{strokeStyle:"#8b0000",fillStyle:"#CC3300",lineWidth:1},position:e.position});t.addChild(n),t.scaleHandleInstanceCache.push(n)}));var e=new Sn({host:this,left:0,top:0,radius:this.rotateHandleSize,style:{strokeStyle:"#8b0000",fillStyle:"#CC3300",lineWidth:1}});this.addChild(e),this.rotateHandleInstance=e}},{key:"calcScaleHandlePositions",value:function(){var t=this.state.width,e=this.state.height,n=t/2,r=e/2,i=this.scaleHandleSize/2;return{tl:new DOMPoint(-i,-i),t:new DOMPoint(n-i,-i),tr:new DOMPoint(t-i,-i),r:new DOMPoint(t-i,r-i),rb:new DOMPoint(t-i,e-i),b:new DOMPoint(n-i,e-i),lb:new DOMPoint(-i,e-i),l:new DOMPoint(-i,r-i)}}},{key:"calcRotateHandlePosition",value:function(){var t=this.state.width/2-this.rotateHandleSize,e=-this.rotateHandleOffsetY;return new DOMPoint(t,e)}},{key:"calcHandlePosition",value:function(){var t=this.calcScaleHandlePositions();this.scaleHandleInstanceCache.forEach((function(e){var n=t[e.props.position];e.setState({left:n.x,top:n.y})}));var e=this.calcRotateHandlePosition();this.rotateHandleInstance.setState({left:e.x,top:e.y})}},{key:"renderChildren",value:function(){this.calcHandlePosition(),v(s(c.prototype),"renderChildren",this).call(this)}}]),c}(jn),Cn=function(){function t(e){n(this,t),o(this,"ice",void 0),o(this,"transformControl",void 0),this.ice=e,this.transformControl=new Tn({left:400,top:100,width:100,height:100,style:{strokeStyle:"#8b0000",fillStyle:"#99FFFF",lineWidth:1},transform:{rotate:45}}),this.ice.addToRenderMap(this.transformControl)}return i(t,[{key:"start",value:function(){return this.ice.evtBus.on("select",this.selectEvtHandler,this),this}},{key:"selectEvtHandler",value:function(t){console.log("transform manager....",this);var e=this.ice.selectionList[0];console.log(this.transformControl);e.state.absoluteTranslateMatrix,e.getMinBoundingBox(),e.state.transform.rotate}},{key:"stop",value:function(){}}]),t}();On.start();let Rn=(new(function(){function t(){n(this,t),o(this,"version",bn),o(this,"renderMap",new Map),o(this,"evtBus",void 0),o(this,"root",void 0),o(this,"ctx",void 0),o(this,"canvasEl",void 0),o(this,"canvasWidth",0),o(this,"canvasHeight",0),o(this,"canvasBoundingClientRect",void 0),o(this,"selectionList",[]),o(this,"animationManager",void 0),o(this,"eventBridge",void 0),o(this,"ddManager",void 0),o(this,"transformManager",void 0),o(this,"renderer",void 0)}return i(t,[{key:"init",value:function(t){if(!t)throw new Error("init() failed...");if(this.ctx===t)throw new Error("同一个 canvas 实例只能 init 一次...");return this.root=an,gn(t)?(this.canvasEl=this.root.document.getElementById(t),this.canvasEl.oncontextmenu=function(t){t.preventDefault(),t.stopPropagation()},this.canvasWidth=this.canvasEl.width,this.canvasHeight=this.canvasEl.height,this.canvasBoundingClientRect=this.canvasEl.getBoundingClientRect(),this.ctx=this.canvasEl.getContext("2d")):this.ctx=t,this.evtBus=new Pn,On.regitserEvtBus(this.evtBus),En.regitserEvtBus(this.evtBus),En.start(),this.animationManager=new wn(this).start(),this.eventBridge=new kn(this).start(),this.ddManager=new Mn(this).start(),this.transformManager=new Cn(this).start(),this.renderer=new Dn(this).start(),this}},{key:"destory",value:function(){}},{key:"addToRenderMap",value:function(t){t.ctx=this.ctx,t.root=this.root,this.renderMap.set(t.props.id,t),Object.keys(t.props.animations).length&&this.animationManager.add(t)}},{key:"removeFromRenderMap",value:function(t){this.renderMap.delete(t.props.id),t.ctx=null,t.root=null}},{key:"clearRenderMap",value:function(){}},{key:"toJSON",value:function(){return"{}"}},{key:"fromJSON",value:function(t){return{}}}]),t}())).init("canvas-1"),Nn=new yn({left:200,top:200,width:100,height:100,style:{strokeStyle:"#e01414",fillStyle:"#46ca46",lineWidth:3},transform:{rotate:45}});Rn.addToRenderMap(Nn)}));
