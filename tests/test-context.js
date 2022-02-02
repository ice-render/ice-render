const canvas = document.querySelector('#canvas-1');
const ctx = canvas.getContext('2d');

//测试变换矩阵
// let matrix=new DOMMatrix([0.8, 0, 0, 0.8, 0, 0]);
// console.log(matrix.invertSelf());
// ctx.setTransform(matrix);
// let storedTransform = ctx.getTransform();
// console.log(storedTransform);
// ctx.beginPath();
// ctx.arc(100, 75, 50, 0, 2 * Math.PI);
// ctx.stroke();
// // ctx.fill();
// ctx.restore();

//测试 restore 是否会恢复默认的变换矩阵
// console.log(ctx.getTransform());
// ctx.setTransform(matrix.invertSelf());
// ctx.beginPath();
// ctx.arc(200, 175, 50, 0, 2 * Math.PI);
// ctx.stroke();
// // ctx.fill();
// ctx.restore();//restore 不会恢复默认的 transformMatrix

//恢复默认的变换矩阵
// ctx.setTransform(1,0,0,1,0,0);//默认未经变换的矩阵
// ctx.beginPath();
// ctx.arc(300, 275, 50, 0, 2 * Math.PI);
// ctx.stroke();
// // ctx.fill();
// ctx.restore();//restore 不会恢复默认的 transformMatrix

//测试矩阵的变换顺序

//第一种：先变形再平移
// let matrix2=new DOMMatrix();
// matrix2.translateSelf(100,100);
// matrix2.scaleSelf(0.5,0.5);
// console.log("matrix2",matrix2);
// ctx.setTransform(matrix2);
// ctx.lineWidth=3;
// ctx.strokeStyle="#ff3300";
// ctx.fillStyle="#00ff00";
// ctx.beginPath();
// ctx.arc(400,400,50,0,2*Math.PI);
// ctx.stroke();
// ctx.fill();
// ctx.restore();

//第二种：先平移再变形
// let matrix3=new DOMMatrix();
// matrix3.scaleSelf(0.5,0.5);//先缩放再平移，会导致缩放量被复合运算到了平移量上
// matrix3.translateSelf(100,100);
// console.log("matrix3",matrix3);
// ctx.setTransform(matrix3);
// ctx.lineWidth=3;
// ctx.strokeStyle="#ff0000";
// ctx.fillStyle="#0000ff";
// ctx.beginPath();
// ctx.arc(400,400,50,0,2*Math.PI);
// ctx.stroke();
// ctx.fill();
// ctx.restore();

//测试中心点旋转计算公式
let x = 200;
let y = 100;
let width = 400;
let height = 400;

//第一层容器
ctx.lineWidth = 1;
ctx.strokeStyle = '#ff0000';
ctx.fillStyle = '#5ae00c';

let originX_1 = x + width / 2;
let originY_1 = y + height / 2;

let matrix_1 = new DOMMatrix();
matrix_1 = matrix_1.translateSelf(originX_1, originY_1); //移动原点坐标
matrix_1 = matrix_1.rotate(10);
matrix_1 = matrix_1.scaleSelf(1.5, 1.5);
ctx.setTransform(matrix_1);

ctx.beginPath();
ctx.rect(-width / 2, -height / 2, width, height);
ctx.stroke();
ctx.fill();
ctx.restore();
ctx.setTransform(new DOMMatrix());

//第二层容器
ctx.lineWidth = 1;
ctx.strokeStyle = '#ff0000';
ctx.fillStyle = '#7b7696';

x = 390; //距离第一层容器右侧 10px ，方便测试变换之后的位置
y = 110;
width = 200;
height = 200;

let originX_2 = x + width / 2;
let originY_2 = y + height / 2;

let tempX = originX_2 - originX_1;
let tempY = originY_2 - originY_1;
console.log(tempX, tempY);

let newOrigin = new DOMPoint(tempX, tempY).matrixTransform(matrix_1);
console.log(newOrigin);
originX_2 = newOrigin.x;
originY_2 = newOrigin.y;

let matrix_2 = new DOMMatrix();
matrix_2 = matrix_2.translateSelf(originX_2, originY_2); //移动原点坐标
matrix_2 = matrix_2.rotate(10);
matrix_2 = matrix_2.scaleSelf(1.5, 1.5);
matrix_2 = matrix_2.scaleSelf(1.5, 1.5);

ctx.setTransform(matrix_2);

ctx.beginPath();
ctx.rect(-width / 2, -height / 2, width, height);
ctx.stroke();
ctx.fill();
ctx.restore();
