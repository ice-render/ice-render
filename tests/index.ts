// import ICEStar from '../src/graphic/shape/ICEStar';
// import ICELine from '../src/graphic/line/ICELine';
// import ICERect from '../src/graphic/shape/ICERect';
import ICEGroup from '../src/graphic/container/ICEGroup';
// import ICEImage from '../src/graphic/ICEImage';
import ICECircle from '../src/graphic/shape/ICECircle';
// import ICEText from '../src/graphic/text/ICEText';
import ICE from '../src/ICE';

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
// ice.addToDisplayMap(rect);

// let line = new ICELine({
//   left: 0,
//   top: 0,
//   startPoint: [100, 100],
//   endPoint: [400, 200],
//   style: {
//     strokeStyle: '#8a2be2',
//     fillStyle: '#008000',
//     lineWidth: 5,
//   },
//   transform: {
//     // translate: [10, -10],
//     // scale: [1, 1],
//     rotate: 20,
//   },
// });
// ice.addToDisplayMap(line);

// let img = new ICEImage({
//   left: 10,
//   top: 10,
//   width: 100,
//   height: 100,
//   transform: {
//     // translate: [10, 10],
//     rotate: 45,
//     // skew: [20, 0],
//     scale: [1, 2],
//   },
// });
// ice.addToDisplayMap(img);

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
// ice.addToDisplayMap(isogon3);

// //正五边形
// let isogon5 = new ICEIsogon({
//   left: 500,
//   top: 0,
//   radius: 50,
//   edges: 5,
// });
// ice.addToDisplayMap(isogon5);

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
// ice.addToDisplayMap(isogon15);

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
// ice.addToDisplayMap(star1);

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
// ice.addToDisplayMap(text);

// let p1 = new DOMPoint(0, 100);
// let p2 = new DOMPoint(150, 100);
// let p3 = new DOMPoint(150, 200);
// let p4 = new DOMPoint(0, 200);
// let path = new ICEDotPath({ dots: [p1, p2, p3, p4] });
// ice.addToDisplayMap(path);

let g = new ICEGroup({
  left: 100,
  top: 100,
  width: 200,
  height: 200,
  style: {
    strokeStyle: '#fa0404',
    fillStyle: '#beffff',
    lineWidth: 1,
  },
  transform: {
    // translate: [10, -10],
    scale: [1, 1],
    // skew: [50, 0],
    rotate: 45,
  },
});
ice.addToDisplayMap(g);

let group1 = new ICEGroup({
  left: 10,
  top: 10,
  width: 150,
  height: 150,
  style: {
    strokeStyle: '#fa0404',
    fillStyle: '#37dd0d',
    lineWidth: 1,
  },
  transform: {
    // translate: [10, -10],
    // scale: [1, 1],
    rotate: 0,
  },
});
g.addChild(group1);

let group2 = new ICEGroup({
  left: 10,
  top: 10,
  width: 100,
  height: 100,
  style: {
    strokeStyle: '#fa0404',
    fillStyle: '#08b2dd',
    lineWidth: 1,
  },
  transform: {
    // translate: [10, -10],
    // scale: [1, 1],
    rotate: 0,
  },
});
group1.addChild(group2);

group2.addChild(
  new ICECircle({
    left: 10,
    top: 10,
    radius: 20,
    transform: {
      rotate: 180,
    },
  })
);

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
// ice.addToDisplayMap(group1);

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
// ice.addToDisplayMap(rect6);

// let circle2 = new ICECircle({
//   left: 200,
//   top: 10,
//   radius: 10,
// });
// ice.addToDisplayMap(circle2);

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
// ice.addToDisplayMap(group2);

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
// ice.addToDisplayMap(rect2);

// let circle3 = new ICECircle({
//   left: 0,
//   top: 0,
//   radius: 10,
// });
// ice.addToDisplayMap(circle3);

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
// ice.addToDisplayMap(th);
