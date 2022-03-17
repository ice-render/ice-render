// import ICEStar from '../src/graphic/shape/ICEStar';
import ICEGroup from '../src/graphic/container/ICEGroup';
// import ICEImage from '../src/graphic/ICEImage';
// import ICEPolyLine from '../src/graphic/line/ICEPolyLine';
import ICEVisioLink from '../src/graphic/linkable/ICEVisioLink';
import ICECircle from '../src/graphic/shape/ICECircle';
// import ICEHeart from '../src/graphic/shape/ICEHeart';
// import ICEIsogon from '../src/graphic/shape/ICEIsogon';
// import ICERose from '../src/graphic/shape/ICERose';
import ICERect from '../src/graphic/shape/ICERect';
import ICE from '../src/ICE';

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
  ice.clearAll();
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

let g = new ICEGroup({
  left: 100,
  top: 100,
  width: 300,
  height: 200,
  style: {
    strokeStyle: '#fa0404',
    fillStyle: '#beffff',
    lineWidth: 1,
  },
  transform: {
    // translate: [10, -10],
    scale: [1.5, 1.5],
    // skew: [50, 0],
    rotate: 45,
  },
});
ice.addChild(g);
g.setState({
  transform: {
    scale: [1.3, 1.3],
  },
});

let group1 = new ICEGroup({
  left: 10,
  top: 10,
  width: 200,
  height: 100,
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
  height: 50,
  style: {
    strokeStyle: '#fa0404',
    fillStyle: '#08b2dd',
    lineWidth: 1,
  },
  transform: {
    // translate: [10, -10],
    // scale: [1, 1],
    rotate: 10,
  },
});
group1.addChild(group2);

group2.addChild(
  new ICECircle({
    left: 20,
    top: 10,
    radius: 10,
    transform: {
      rotate: 45,
    },
  })
);

group2.addChild(
  new ICERect({
    left: 60,
    top: 10,
    width: 30,
    height: 20,
    transform: {
      rotate: 0,
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
