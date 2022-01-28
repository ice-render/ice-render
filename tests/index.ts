// import ICEStar from '../src/graphic/shape/ICEStar';
import ICERect from '../src/graphic/shape/ICERect';
// import ICEGroup from '../src/graphic/container/ICEGroup';
// import ICECircle from '../src/graphic/shape/ICECircle';
// import ICEIsogon from '../src/graphic/shape/ICEIsogon';
// import ICEText from '../src/graphic/text/ICEText';
import ICE from '../src/ICE';
import TransformControl from '../src/transformation/TransformControl';

let ice = new ICE().init('canvas-1');

// let rect = new ICERect({
//   left: 0,
//   top: 0,
//   width: 100,
//   height: 100,
//   style: {
//     strokeStyle: '#8b0000',
//     fillStyle: '#008000',
//     lineWidth: 5,
//   },
//   animations: {
//     left: { from: 0, to: 500, duration: 1000, easing: 'easeInQuad' },
//     top: { from: 0, to: 200, duration: 3000 },
//     width: { from: 100, to: 200, duration: 5000 },
//     height: { from: 100, to: 200, duration: 5000 },
//   },
//   transform: {
//     translate: [10, 10],
//     rotate: 10,
//     skew: [20, 0],
//     scale: [1, 1],
//   },
// });
// rect.on('click', (evt) => {
//   console.log('rect');
// });
// ice.addToRenderMap(rect);

// let line = new ICELine({
//   left: 0,
//   top: 0,
//   startPoint: [200, 200],
//   endPoint: [300, 300],
//   style: {
//     strokeStyle: '#8a2be2',
//     fillStyle: '#008000',
//     lineWidth: 5,
//   },
// });
// ice.addToRenderMap(line);

// let img = new ICEImage({
//   left: 10,
//   top: 10,
//   width: 100,
//   height: 100,
//   // transform: {
//   //   translate: [10, 10],
//   //   rotate: 10,
//   //   skew: [20, 0],
//   //   scale: [1, 1],
//   // },
// });
// ice.addToRenderMap(img);

//正三角形
// let isogon3 = new ICEIsogon({
//   left: 600,
//   top: 100,
//   radius: 50,
//   edges: 3,
//   transform: {
//     // translate: [10, -10],
//     scale: [1.5, 1.5],
//     // skew: [50, 0],
//     rotate: 45,
//   },
// });
// ice.addToRenderMap(isogon3);

// //正五边形
// let isogon5 = new ICEIsogon({
//   left: 500,
//   top: 0,
//   radius: 50,
//   edges: 5,
// });
// ice.addToRenderMap(isogon5);

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
// ice.addToRenderMap(isogon15);

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
// ice.addToRenderMap(star1);

// let text = new ICEText({
//   left: 0,
//   top: 200,
//   text: 'Test long long long text...',
//   style: {
//     lineWidth: 5,
//     font: '48px serif',
//     strokeStyle: '#ff3300',
//     fillStyle: '#00ff00',
//   },
// });
// ice.addToRenderMap(text);

// let p1 = new DOMPoint(0, 100);
// let p2 = new DOMPoint(150, 100);
// let p3 = new DOMPoint(150, 200);
// let p4 = new DOMPoint(0, 200);
// let path = new ICEDotPath({ dots: [p1, p2, p3, p4] });
// ice.addToRenderMap(path);

// let g = new ICEGroup({
//   left: 100,
//   top: 100,
//   width: 200,
//   height: 200,
//   style: {
//     strokeStyle: '#fa0404',
//     fillStyle: '#beffff',
//     lineWidth: 1,
//   },
//   transform: {
//     // translate: [10, -10],
//     scale: [2, 2],
//     // skew: [50, 0],
//     rotate: 45,
//   },
// });
// ice.addToRenderMap(g);

// let group1 = new ICEGroup({
//   left: 10,
//   top: 10,
//   width: 150,
//   height: 150,
//   style: {
//     strokeStyle: '#fa0404',
//     fillStyle: '#37dd0d',
//     lineWidth: 1,
//   },
//   transform: {
//     // translate: [10, -10],
//     // scale: [1, 1],
//     // rotate: 5,
//   },
// });
// g.addChild(group1);

// let group2 = new ICEGroup({
//   left: 10,
//   top: 10,
//   width: 100,
//   height: 100,
//   style: {
//     strokeStyle: '#fa0404',
//     fillStyle: '#08b2dd',
//     lineWidth: 1,
//   },
//   transform: {
//     // translate: [10, -10],
//     // scale: [1, 1],
//     // rotate: 45,
//   },
// });
// group1.addChild(group2);

// group2.addChild(
//   new ICECircle({
//     left: 10,
//     top: 10,
//     radius: 20,
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
// ice.addToRenderMap(group1);

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
//   left: 300,
//   top: 100,
//   width: 200,
//   height: 200,
// });
// ice.addToRenderMap(rect6);

// let circle2 = new ICECircle({
//   left: 200,
//   top: 10,
//   radius: 10,
// });
// ice.addToRenderMap(circle2);

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
// ice.addToRenderMap(group2);

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

let rect2 = new ICERect({
  left: 200,
  top: 200,
  width: 100,
  height: 100,
  style: {
    strokeStyle: '#e01414',
    fillStyle: '#46ca46',
    lineWidth: 3,
  },
  transform: {
    // translate: [10, -10],
    // scale: [1, 1],
    rotate: 45,
  },
});
ice.addToRenderMap(rect2);

// let circle3 = new ICECircle({
//   left: 0,
//   top: 0,
//   radius: 10,
// });
// ice.addToRenderMap(circle3);

let th = new TransformControl({
  left: 400,
  top: 100,
  width: 100,
  height: 100,
  style: {
    strokeStyle: '#8b0000',
    fillStyle: '#99FFFF',
    lineWidth: 1,
  },
});
ice.addToRenderMap(th);
