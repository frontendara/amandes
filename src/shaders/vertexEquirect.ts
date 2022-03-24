export default [
'attribute vec3 aVertexPosition;',

'uniform float uDepth;',
'uniform mat4 uViewportMatrix;',
'uniform mat4 uInvProjMatrix;',

'varying vec4 vRay;',

'void main(void) {',
'  vRay = uInvProjMatrix * vec4(aVertexPosition.xy, 1.0, 1.0);',
'  gl_Position = uViewportMatrix * vec4(aVertexPosition.xy, uDepth, 1.0);',
'}'
].join('\n');
