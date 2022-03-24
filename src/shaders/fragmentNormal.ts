export default [
'#ifdef GL_FRAGMENT_PRECISION_HIGH',
'precision highp float;',
'#else',
'precision mediump float;',
'#endif',

'uniform sampler2D uSampler;',
'uniform float uOpacity;',
'uniform vec4 uColorOffset;',
'uniform mat4 uColorMatrix;',

'varying vec2 vTextureCoord;',

'void main(void) {',
'  vec4 color = texture2D(uSampler, vTextureCoord) * uColorMatrix + uColorOffset;',
'  gl_FragColor = vec4(color.rgba * uOpacity);',
'}'
].join('\n');
