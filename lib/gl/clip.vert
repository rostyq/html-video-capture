precision highp float;
attribute vec2 a_texCoord;
varying vec2 v_texCoord;

void main() {
  gl_Position = vec4(a_texCoord, 0., 1.);
  v_texCoord = a_texCoord * vec2(0.5, -0.5) + 0.5;
}
