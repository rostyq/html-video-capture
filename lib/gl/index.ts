import vertexShaderSource from "./clip.vert";
import lumFragmentShaderSource from "./lum.frag";
import rgblumfragmentShaderSource from "./rgblum.frag";
import rgbaFragmentShaderSource from "./rgba.frag";

export const shaders = {
  lum: lumFragmentShaderSource,
  rgba: rgbaFragmentShaderSource,
  rgblum: rgblumfragmentShaderSource,
};

export const clip = vertexShaderSource;
