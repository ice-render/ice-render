1. TS 开发、构建、文档环境
2. 帧频控制
3. 事件总线
4. 动画机制
5. 仿射变换机制
6. canvas 形状封装
7. 统一可定制的皮肤机制
8. 多 layer 、多 canvas 实例机制
9. 基于引导线的动画
10. 点选、框选、Ctrl 键,选中之后的变换
11. 拖拽机制
12. 连线机制
13. 序列化&反序列化
14. 容器型组件

- TODO:变换操作需要切换成3步完成：setLocalOrigin/calcTranslationMatrix/calcLinearMatrix/composeMatrix ，为了完成下一条，需要先完成这一条【已解决】
- TODO:叠加所有父层节点的 translate/linear 变换【已解决】
- TODO:transform 矩阵需要改成围绕组件的几何中心点进行【已解决】
- TODO:多层叠放情况下按照 z-index 大小决定选中哪个对象【已解决】
- TODO:拖拽移动时，位置计算有问题，子层组件出现了加速移动的情况，某个参数不断被重复计算进了偏移量【已解决】 
- TODO:旋转手柄的参数计算不太对【已解决】
- TODO:旋转之后，缩放手柄的参数计算不太对【已解决】
- TODO:实现拖拽式 transform【已解决】
- TODO:解决事件回调函数的 scope 问题【已解决】
- TODO:实现 N 层重叠形式的组件【已解决】
- FIXME:ICEIsogon 在绘制三角形时计算方式不正确。        <------------
- TODO:TransformControl 挂到组件上，实现组件的变换。
- TODO:围绕中心点变换、围绕左侧、右侧、上边、下边、指定任意坐标点变换。（先跳过，后面补）
- TODO:变换手柄支持对象翻转（先跳过，后面补）
- TODO:修改计算尺寸和位置的逻辑，把 lineWidth 参数计算进去。
- TODO:实现连接线 &Visio 形态的连接线
- TODO:优化编译和测试环境参数配置
- TODO:ICE 全局单例重构
- TODO:补用例，跑测试。

## Shape
矩形 x/y/width/height
圆形 x/y/r
椭圆
三角形
星形

## 容器

TODO:实现容器

## Line
直线
曲线

## Text

Canvas 对文本的处理比较特殊：

- 文本是基于 y 轴坐标向上绘制的
- 没有内置的方法计算文本的高度

## Style

@see https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Properties_Reference

style 定义：与 CSS 进行映射

期待的传参方式：

style:{
  storke:'',
  fill:'',
  shadow:{
    color:'',
    blur:'',
    offsetX:'',
    offsetY:'',
  },
  line:{
    cap:'',
    dashOffset:'',
    join:'',
    width:'',
  },
  text:{
    fontFamily:'',
    fontSize:48,
    fontWeight:400,
  },
}

Canvas 内部定义的方式：

fillStyle
lineCap
lineDashOffset
lineJoin
lineWidth
miterLimit
shadowBlur
shadowColor
shadowOffsetX
shadowOffsetY
strokeStyle
textAlign
textBaseline

TODO:十六进制颜色编码映射成 rgba 数值，并且可以计算渐变。


## Animation

动画是独立的机制，不能渗透到代码逻辑里面。

animation 定义：与 CSS keyframes 进行映射??? https://developer.mozilla.org/en-US/docs/Web/CSS/@keyframes


@keyframes identifier {
  0% { top: 0; }
  50% { top: 30px; left: 20px; }
  50% { top: 10px; }
  100% { top: 0; }
}

动画补间算法？？？(reverse反向动画)

animation 期待的传参方式：

{propertyKey:{from:???,to:???,duration:???,easing:'linear'}}

animations:{
  x:{
    from:100,
    to:500,
    duration:100, //ms, default 100ms
    easing:'linear', //default 'linear'
    loop:false, //默认不进行无限循环，TODO:需要实现无限循环的情况
  },
  y:{
    from:100,
    to:500,
    duration:100,//ms
    easing:'linear',
  },
  width:{
    from:300,
    to:600,
    duration:100,//ms
    easing:'linear',
  },
  height:{
    from:300,
    to:600,
    duration:100,//ms
    easing:'linear',
  },
  stroke:{
    from:'',
    to:'',
    duration:100,//ms
    easing:'linear',
  },
  fill:{
    from:'',
    to:'',
    duration:100,//ms
    easing:'linear',
  },
  shadow:{
    from:'',
    to:'',
    duration:100,//ms
    easing:'linear',
  },
}

TODO:引导线动画
TODO:动画过程中的事件回调函数
TODO:难点：对 transformation 过程进行补间动画

- 在底层，transformation 机制也是利用动画机制实现的。
- 当 animations 配置项中包含了 transformation 配置项时，其它位置的 transformation 配置型均无效。

## Transformation

仿射变换是独立的机制，不能渗透到代码里面。

期待的传参方式：

transformation：{
  translate:[10,10],
  scale:[2,2],
  skew:[1,1],
  rotate:60,
}

底层全部使用矩阵变换进行计算，自然顺序：

skew/scale/rotate/translate

translate/rotate/scale/skew

## HTML 坐标点计算方法
clientX: 60
clientY: 66
layerX: 52
layerY: 58
offsetX: 52
offsetY: 58
pageX: 60
pageY: 66
screenX: 60
screenY: 137
tiltX: 0
tiltY: 0
x: 60
y: 66

https://segmentfault.com/a/1190000002405897

## Line

直线
折线
曲线（贝塞尔曲线）
带箭头的线（单端点/双端点）


## 处理高分屏问题

var canvas = document.getElementById('canvas');
var ctx = canvas.getContext('2d');

// Set display size (css pixels).
var size = 200;
canvas.style.width = size + "px";
canvas.style.height = size + "px";

// Set actual size in memory (scaled to account for extra pixel density).
var scale = window.devicePixelRatio; // Change to 1 on retina screens to see blurry canvas.
canvas.width = Math.floor(size * scale);
canvas.height = Math.floor(size * scale);

// Normalize coordinate system to use css pixels.
ctx.scale(scale, scale);

ctx.fillStyle = "#bada55";
ctx.fillRect(10, 10, 300, 300);
ctx.fillStyle = "#ffffff";
ctx.font = '18px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';

var x = size / 2;
var y = size / 2;

var textString = "I love MDN";
ctx.fillText(textString, x, y);

## Selection

单选模式、多选模式、选中状态


选中、变换手柄、拖拽，这3个操作互相之间有关联，处理方式是：

1、如果 mousedown 的时候点到了 canvas 本身，则进行框选；

2、否则，进行点选：
  按下了 ctrl 键，则表示多选
  否则表示单选

不可交互的对象不能被设置为选中。

农历年前完成第一个版本。