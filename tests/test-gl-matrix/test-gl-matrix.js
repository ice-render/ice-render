const canvas = document.querySelector('#canvas-1');
const ctx = canvas.getContext('2d');

//矩阵测试
const mat = glMatrix.mat2d.identity([]);
console.log(mat);

//矩阵变换
//平移
const translated = glMatrix.mat2d.translate([], mat, [100, 100]);
console.log(translated);
//扭曲
//!gl-matrix 目前没有 skew 函数，需要自己 patch 进去 https://github.com/toji/gl-matrix/pull/293
//旋转
const rotated = glMatrix.mat2d.rotate([], mat, Math.PI);
console.log(rotated);
//缩放
const scaled = glMatrix.mat2d.scale([], mat, [1.5, 2]);
console.log(scaled);

//矩阵乘法
const mat1 = glMatrix.mat2d.fromValues(3, 3, 2, 1, 1, 1);
const mat2 = glMatrix.mat2d.fromValues(2, 1, 1, 2, 5, 5);
console.log(glMatrix.mat2d.mul([], mat1, mat2));
console.log(glMatrix.mat2d.mul([], mat2, mat1));

//逆矩阵
console.log(glMatrix.mat2d.invert([], mat1));

//向量变换
const v1 = [2, 2];
const transformed = glMatrix.vec2.transformMat2d([], v1, mat1);
console.log(transformed);

ctx.strokeStyle = '#ff0000';
ctx.fillStyle = '#0000ff';
const mat3 = glMatrix.mat2d.fromValues(2, 0, 0, 2, 0, 0);
const mat4 = glMatrix.mat2d.fromValues(1, 0, 0, 1, 10, 10);
const mat5 = glMatrix.mat2d.mul([], mat4, mat3);
console.log(glMatrix.mat2d.mul([], mat4, mat3)); //! 平移矩阵是第一个参数，缩放矩阵是第二个参数，后做的操作放在第一个参数中。
console.log(glMatrix.mat2d.mul([], mat3, mat4));
ctx.setTransform(...mat5);
ctx.rect(100, 100, 100, 100);
ctx.stroke();
ctx.fill();

//测试矩阵运算时间
let startTime = Date.now();
for (let i = 0; i < 50000; i++) {
  glMatrix.mat2d.mul([], mat3, mat4);
}
let endTime = Date.now();
console.log(`gl-matrix time> ${endTime - startTime} ms.`);

startTime = Date.now();
for (let i = 0; i < 50000; i++) {
  let matrix = new DOMMatrix([1, 0, 0, 1, 0, 0]);
  matrix.multiply(matrix);
}
endTime = Date.now();
console.log(`DOMMatrix time> ${endTime - startTime} ms.`);
