/**
 * 本示例主要介绍如何从模型文件中读取三维模型的顶点坐标和颜色数据。
 * 程序需要从模型文件中读取数据，并保存在之前使用的那些数组和缓冲区中，具体表现如下：
 * 1.准备`Float32Array`类型的数组`vertices`，从文件中读取模型的顶点坐标数据并存入其中
 * 2.准备`Float32Array`类型的数组`colors`，从文件中读取模型的顶点颜色数据并保存到其中
 * 3.准备`Float32Array`类型的数组`normals`,从文件中读取模型的顶点法线数据并保存到其中
 * 4.准备`Unit16Array`或`Unit8Array`类型的数组`indices`，从文件中读取顶点索引数据并保存到其中，顶点索引数据定义了组成整个模型的三角形序列
 * 
 * 
 * 示例代码主要5个步骤：
 * 1.准备一个空的缓冲区对象
 * 2.读取OBJ文件中的内容
 * 3.解析之
 * 4.将解析出的顶点数据写入缓冲区
 * 5.进行绘制
 */


import { Matrix4 } from '../../utils/gl-matrix';
import OBJDoc from './OBJDoc';

const VSHADER_SOURCE = `
    attribute vec4 a_Position;
    attribute vec4 a_Color;
    attribute vec4 a_Normal;
    uniform mat4 u_MvpMatrix;
    uniform mat4 u_NormalMatrix;
    varying vec4 v_Color;
    void main(){
        vec3 lightDirection = vec3(-0.35,0.35,0.87);
        gl_Position = u_MvpMatrix * a_Position;
        vec3 normal = normalize(vec3(u_NormalMatrix * a_Normal));
        float nDotL = max(dot(normal,lightDirection),0.0);
        v_Color = vec4(a_Color.rgb * nDotL ,a_Color.a);
    }
`;

const FSHADER_SOURCE = `
    precision mediump float;
    varying vec4 v_Color;
    void main(){
        gl_FragColor = v_Color;
    }
`;


// Coordinate transformation matrix
var g_modelMatrix = new Matrix4();
var g_mvpMatrix = new Matrix4();
var g_normalMatrix = new Matrix4();

function main() {
    const canvas = document.getElementById('webgl');
    /**
    * @type { WebGLRenderingContext }
    */
    const gl = canvas.getContext('webgl');

    const program = createProgram(gl, VSHADER_SOURCE, FSHADER_SOURCE);
    if (!program) {
        console.log('Failed to create the program');
        return;
    }

    gl.clearColor(0.2, 0.2, 0.2, 1.0);
    gl.enable(gl.DEPTH_TEST);

    program.a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    program.a_Normal = gl.getAttribLocation(gl.program, 'a_Normal');
    program.a_Color = gl.getAttribLocation(gl.program, 'a_Color');
    program.u_MvpMatrix = gl.getUniformLocation(gl.program, 'u_MvpMatrix');
    program.u_NormalMatrix = gl.getUniformLocation(gl.program, 'u_NormalMatrix');

    if (program.a_Position < 0 || program.a_Normal < 0 || program.a_Color < 0 ||
        !program.u_MvpMatrix || !program.u_NormalMatrix
    ) {
        console.log('attribute,uniform 变量获取失败');
        return;
    }

    const model = initVertexBuffers(gl, program);
    if (!model) {
        console.log('Failed to set the vertex infomation');
        return;
    }

    const viewProjMatrix = new Matrix4();
    viewProjMatrix.setPerspective(30.0, canvas.width / canvas.height, 1.0, 5000.0);
    viewProjMatrix.lookAt(0.0, 500.0, 200.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);

    readOBJFile(require('../../assets/cube.obj'), gl, model, 60, true);

    let currentAngle = 0.0;
    const tick = () => {
        currentAngle = animate(currentAngle);
        draw(gl, gl.program, currentAngle, viewProjMatrix, model);
        requestAnimationFrame(tick, canvas);
    }
    tick();
}
/**
 * @param {WebGLRenderingContext} gl
 */
function createProgram(gl, vshader_source, fshader_source) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

    gl.shaderSource(vertexShader, vshader_source);
    gl.shaderSource(fragmentShader, fshader_source);

    gl.compileShader(vertexShader);
    gl.compileShader(fragmentShader);

    const program = gl.createProgram();
    gl.program = program;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);

    gl.linkProgram(program);
    gl.useProgram(program);

    return program;
}

const ANGLE_STEP = 30;
let last = Date.now();

function animate(angle) {
    const now = Date.now();
    const elapsed = now - last;
    last = now;
    const newAngle = angle + (ANGLE_STEP * elapsed) / 1000.0;
    return newAngle % 360;
}

/**
 *
 *
 * @param {WebGLRenderingContext} gl
 * @param {*} program
 * @param {*} angle
 * @param {*} viewProjMatrix
 * @param {*} model
 * @returns
 */
function draw(gl, program, angle, viewProjMatrix, model) {
    if (g_objDoc != null && g_objDoc.isMTLComplete()) {
        g_drawingInfo = onReadComplete(gl, model, g_objDoc);
        g_objDoc = null;
    }
    if (!g_drawingInfo) return;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    g_modelMatrix.setRotate(angle, 1.0, 0.0, 0.0);
    g_modelMatrix.rotate(angle, 0.0, 1.0, 0.0);
    g_modelMatrix.rotate(angle, 0.0, 0.0, 1.0);

    g_normalMatrix.setInverseOf(g_modelMatrix);
    g_normalMatrix.transpose();
    gl.uniformMatrix4fv(program.u_NormalMatrix, false, g_normalMatrix.elements);

    g_mvpMatrix.set(viewProjMatrix);
    g_mvpMatrix.multiply(g_modelMatrix);
    gl.uniformMatrix4fv(program.u_MvpMatrix, false, g_mvpMatrix.elements);

    gl.drawElements(gl.TRIANGLES, g_drawingInfo.indices.length, gl.UNSIGNED_SHORT, 0);
}

function readOBJFile(fileName, gl, model, scale, reverse) {
    const request = new XMLHttpRequest();
    request.onreadystatechange = function () {
        if (request.readyState === 4 && request.status !== 404) {
            onReadOBJFile(request.responseText, fileName, gl, model, scale, reverse);
        }
    }
    request.open('GET', fileName, true);
    request.send();
}

let g_objDoc = null;
let g_drawingInfo = null;

function onReadOBJFile(fileString, fileName, gl, o, scale, reverse) {
    const objDoc = new OBJDoc(fileName);
    const result = objDoc.parse(fileString, scale, reverse);
    if (!result) {
        g_objDoc = null;
        g_drawingInfo = null;
        console.log('OBJ file parsing error');
        return;
    }
    g_objDoc = objDoc;
}
/**
 * 
 * @param {WebGLRenderingContext} gl 
 * @param {*} program 
 */
function initVertexBuffers(gl, program) {
    const o = new Object();
    o.vertexBuffer = createEmptyArrayBuffer(gl, program.a_Position, 3, gl.FLOAT);
    o.normalBuffer = createEmptyArrayBuffer(gl, program.a_Normal, 3, gl.FLOAT);
    o.colorBuffer = createEmptyArrayBuffer(gl, program.a_Color, 4, gl.FLOAT);
    o.indexBuffer = gl.createBuffer();
    if (!o.vertexBuffer || !o.normalBuffer || !o.colorBuffer || !o.indexBuffer) { return null; }

    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    return o;
}

function onReadComplete(gl, model, objDoc) {
    // Acquire the vertex coordinates and colors from OBJ file
    var drawingInfo = objDoc.getDrawingInfo();
  
    // Write date into the buffer object
    gl.bindBuffer(gl.ARRAY_BUFFER, model.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.vertices, gl.STATIC_DRAW);
  
    gl.bindBuffer(gl.ARRAY_BUFFER, model.normalBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.normals, gl.STATIC_DRAW);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, model.colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, drawingInfo.colors, gl.STATIC_DRAW);
    
    // Write the indices to the buffer object
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, model.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, drawingInfo.indices, gl.STATIC_DRAW);
  
    return drawingInfo;
  }

function createEmptyArrayBuffer(gl, a_attribute, num, type) {
    const buffer = gl.createBuffer();  // Create a buffer object
    if (!buffer) {
        console.log('Failed to create the buffer object');
        return null;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.vertexAttribPointer(a_attribute, num, type, false, 0, 0);  // Assign the buffer object to the attribute variable
    gl.enableVertexAttribArray(a_attribute);  // Enable the assignment

    return buffer;
}

export default main;