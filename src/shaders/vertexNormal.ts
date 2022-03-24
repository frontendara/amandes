export default [
'attribute vec3 aVertexPosition;',
'attribute vec2 aTextureCoord;',

'uniform float uDepth;',
'uniform mat4 uViewportMatrix;',
'uniform mat4 uProjMatrix;',

'varying vec2 vTextureCoord;',

'void main(void) {',
'  gl_Position = uViewportMatrix * uProjMatrix * vec4(aVertexPosition.xy, 0.0, 1.0);',
'  gl_Position.z = uDepth * gl_Position.w;',
'  vTextureCoord = aTextureCoord;',
'}'
].join('\n');
