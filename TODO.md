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
- TODO: TransformPanel 挂到组件上，实现组件的变换。【已解决】
- TODO:重构拖拽的实现方式，拖拽过程也通过  TransformPanel 实现，组件自身实际上不能拖动。【已解决】
- TODO: TransformPanel 关联到组件上之后，需要立即响应 mousemove 事件，不需要抬起鼠标再次按下才能拖动。【已解决】
- TODO:重构  TransformPanel 与组件之间的 zIndex 关系，TransformPanel 永远绘制在关联的组件上一层？Number.MAX_VALUE？【已解决】

- TODO: TransformPanel 的外观可配置，可以选择不展示缩放手柄、旋转手柄。（先跳过，后面补）
- TODO: TransformPanel 可以隐藏起来，而不是一直放在画布上。（先跳过，后面补）
- TODO: TransformPanel 支持对象翻转（先跳过，后面补）
- TODO:围绕中心点变换、围绕左侧、右侧、上边、下边、指定任意坐标点变换。（先跳过，后面补）
- FIXME:ICEIsogon 在绘制三角形时计算方式不正确。（先跳过，后面补）
- TODO:修改计算尺寸和位置的逻辑，把 lineWidth 参数计算进去。（先跳过，后面补）
 
- TODO:测试  TransformPanel 对图片的变换是否正确。【已解决】
- TODO:测试宽高不等的一般矩形在  TransformPanel 下的变换是否正确。（ FIXME: 宽高不等的一般矩形，  TransformPanel 位置有偏移）【已解决】
- TODO:测试  TransformPanel 对线条的变换是否正确。(边界盒子、变换有问题，看起来计算方法不太对)【已解决】
- TODO:测试  TransformPanel 对 ICEText 的变换是否正确。【已解决】
- TODO:测试 N 层重叠情况下，以及 ICEGroup 组件  TransformPanel 的处理流程。【已解决】
- TODO:所有连接线不能进行 transform ，只能拖动两端端点进行拉长缩短【已解决】
- TODO:重构 DDManager 和 TransformPanelManager【已完成】
- TODO:重构 LineControlPanel 的实现，把 ICELinkHook 相关的逻辑移动到组件中，不采用全局管理的模式【已解决】 
- TODO:实现连接线 & Visio 形态的连接线【已解决】
- TODO:所有连接线的 TransformControl 都同时具有2种功能：拖动修改长度、吸附到组件上产生连接效果。【已解决】
- TODO:解决 mixin 机制问题【需要继续重构，不能直接使用TS官方提供的实现】【已解决】  
- TODO:所有组件默认都是 linkable 的，需要重构 mixin 机制来实现这个特性。【已解决】
- TODO:删掉 ICECompositeComponent ，ICESlot 和组件之间的采用逻辑关联，不采用可见组件的容纳关系。【已解决】
- TODO:重构容器型组件 ICEGroup 和 ICECompositeComponent 【已解决】
- TODO:用容器型组件机制重构 transform 和 linkable 机制【已解决】
- TODO:Animation 机制改出了 bug ，需要 fix 。【已解决】
- TODO:重构渲染机制，只有当组件的 state 发生变化的时候，才重新渲染，如果 state 没有变，不调用 render() 方法？？？ 【已解决】
- TODO:ICEGroup 需要重构，所有组件的 render 方法都交给 Renderer 统一进行调度。【已解决】
- TODO:工程名、包名都改成 ice-render【已解决】
- TODO:解决 uuid 无效的问题【已解决】
- TODO:ICE 本身也需要一个 uuid【已解决】
- FIXME:LinkHook 会出现无法拖动的现象，LinkHook 有时候没有跟随移动。【已解决】
- FIXME:连接钩子离开之后，LinkSlot 没有恢复默认的外观。【已解决】
- FIXME:需要测试多条连接线连接在同一个插槽上的情况，是否有 bug 【已测试OK】。
- TODO:线条型的组件点击判断需要特殊处理，不能用边界盒子计算，需要用 isPointInPath() 进行判断。 【已解决】
- FIXME:连续快速点击两次加载，会被重复反序列化【已解决】
- TODO:重构 addChild() 机制，全部从 ICE 入口走，重构整体数据结构【已解决】
- 
- FIXME:连接插槽的位置计算有错误，不在 minBoundingBox 上面。（先跳过，后面补）
- FIXME:ICEVisioLink 会出现闪烁的情况。（先跳过，后面补）
- 
- FIXME:连接线的序列化和反序列化  <---------
- TODO:添加快捷键支持，实现删除功能
- TODO:序列化和反序列化（可能需要整理一下整体的数据结构） 
- TODO:清理 TransformControlPanel， LinkHook， LinkSlot 相关的机制，点击之后才展示出来，并且不能影响序列化和反序列化。
- 
- TODO:整理现有图形类的代码，扩展缺失的图形类型。
- TODO:线条的两端需要绘制箭头或者其它形状。
- TODO:ICEText 需要进一步精确的计算。
- TODO:实现 GuideLine ， 增加磁吸效果
- TODO:优化编译和测试环境参数配置
- TODO:ICE 全局单例重构
- TODO:补用例，跑测试。
- 
- TODO:增量渲染机制
- TODO:碰撞检测和局部渲染机制
- 
- TODO:Entity Designer 与 TypeORM 整合案例。
- TODO:BPMN Designer 与流程引擎对接。
- TODO:PageFlow 案例。

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