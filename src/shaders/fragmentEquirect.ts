export default [
'#ifdef GL_FRAGMENT_PRECISION_HIGH',
'precision highp float;',
'#else',
'precision mediump float',
'#endif',

'uniform sampler2D uSampler;',
'uniform float uOpacity;',
'uniform float uTextureX;',
'uniform float uTextureY;',
'uniform float uTextureWidth;',
'uniform float uTextureHeight;',
'uniform vec4 uColorOffset;',
'uniform mat4 uColorMatrix;',

'varying vec4 vRay;',

'const float PI = 3.14159265358979323846264;',

'void main(void) {',
'  float r = inversesqrt(vRay.x * vRay.x + vRay.y * vRay.y + vRay.z * vRay.z);',
'  float phi  = acos(vRay.y * r);',
'  float theta = atan(vRay.x, -1.0*vRay.z);',
'  float s = 0.5 + 0.5 * theta / PI;',
'  float t = 1.0 - phi / PI;',

'  s = s * uTextureWidth + uTextureX;',
'  t = t * uTextureHeight + uTextureY;',

'  vec4 color = texture2D(uSampler, vec2(s, t)) * uColorMatrix + uColorOffset;',
'  gl_FragColor = vec4(color.rgba * uOpacity);',
'}'
].join('\n');
