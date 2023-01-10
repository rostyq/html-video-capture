precision highp float;
uniform sampler2D u_texture;
varying vec2 v_texCoord;
const vec3 convert = vec3(0.299, 0.587, 0.114);

void main() {
   vec4 pixel = texture2D(u_texture, v_texCoord);
   float lum = dot(pixel.rgb, convert);
   gl_FragColor = vec4(lum, lum, lum, 1.0);
}
