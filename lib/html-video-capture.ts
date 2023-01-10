import * as glSources from "./gl";

export interface Options<T> {
  canvas: HTMLCanvasElement,
  context?: T
}

export interface VideoCapture {
  get width(): number;
  get height(): number;
  get channels(): number;

  pixels(): number;
  size(): number;

  grab(): void;
  retrieve(array: Uint8Array): void;
  read(): Uint8Array;
  release(): void;
}


abstract class HTMLVideoCaptureBase implements VideoCapture {
  public video: HTMLVideoElement;

  constructor(video: HTMLVideoElement) {
    this.video = video;
  }

  get width(): number {
    return this.video.videoWidth;
  }

  get height(): number {
    return this.video.videoHeight;
  }

  public pixels(): number {
    return this.width * this.height;
  }

  public size(): number {
    return this.pixels() * this.channels;
  }

  get channels(): number {
    return 4;
  }

  public abstract grab(): void;

  public abstract retrieve(array: Uint8Array): void;

  public read(): Uint8Array {
    this.grab();
    const array = new Uint8Array(this.size());
    this.retrieve(array);
    return array;
  }

  public abstract release(): void;
}

abstract class HTMLVideoCaptureCanvasBase extends HTMLVideoCaptureBase {
  public canvas: HTMLCanvasElement;

  constructor(video: HTMLVideoElement, canvas?: HTMLCanvasElement) {
    super(video);
    this.canvas = canvas || document.createElement("canvas");
    this.adjustCanvasSize();
  }

  protected adjustCanvasSize(): void {
    if (this.canvas.width != this.video.videoWidth) {
      this.canvas.width = this.video.videoWidth;
    }
    if (this.canvas.height != this.video.videoHeight) {
      this.canvas.height = this.video.videoHeight;
    }
  }
}

export class HTMLVideoCapture2D extends HTMLVideoCaptureCanvasBase {
  public context: CanvasRenderingContext2D;

  constructor(video: HTMLVideoElement, options?: Options<CanvasRenderingContext2DSettings>) {
    super(video, options?.canvas);
    const context = this.canvas.getContext("2d", options?.context);
    if (context === null) {
      throw new Error("Cannot get a 2D context from the canvas.");
    }
    this.context = context;
  }

  public getImageData() {
    return this.context.getImageData(0, 0, this.width, this.height);
  }

  public grab(): void {
    this.context.save();
    this.adjustCanvasSize();
    this.context.drawImage(this.video, 0, 0, this.width, this.height);
    this.context.restore();
  }

  public retrieve(buffer: Uint8Array): void {
    const imageData = this.getImageData();
    buffer.set(imageData.data);
  }

  public read(): Uint8Array {
    this.grab();
    return new Uint8Array(this.getImageData().data.buffer);
  }

  public release(): void {
    this.context.clearRect(0, 0, this.width, this.height);
  }
}

interface OptionsGL extends Options<WebGLContextAttributes> {
  shader?: keyof typeof glSources.shaders,
}

export class HTMLVideoCaptureGL extends HTMLVideoCaptureCanvasBase {
  public context: WebGLRenderingContext;

  private program: WebGLProgram;
  private texture: WebGLTexture;
  private vertex: WebGLShader;
  private fragment: WebGLShader;

  private coordBuffer: WebGLBuffer;
  private indexBuffer: WebGLBuffer;

  private coordArray: Float32Array;
  private indexArray: Int16Array;

  private uTexture: WebGLUniformLocation;
  private aTexCoord: number;

  constructor(video: HTMLVideoElement, options?: OptionsGL) {
    super(video, options?.canvas);
    const gl = this.canvas.getContext("webgl", options?.context)!;
    if (gl === null) {
      throw new Error("Cannot get a WebGL context from the canvas.");
    }
    this.context = gl;

    this.vertex = createShader(gl, gl.VERTEX_SHADER, glSources.clip);
    this.fragment = createShader(gl, gl.FRAGMENT_SHADER, glSources.shaders[options?.shader || "rgba"]);

    try {
      this.program = createProgram(gl, this.vertex, this.fragment);
    } catch (err) {
      gl.deleteShader(this.vertex);
      gl.deleteShader(this.fragment);
      throw err;
    }

    const texture = gl.createTexture();

    if (texture === null) {
      throw new Error("Cannot create a texture from WebGL context.");
    }

    this.texture = texture;

    const coordBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();

    if (coordBuffer === null || indexBuffer === null) {
      gl.deleteBuffer(coordBuffer);
      gl.deleteBuffer(indexBuffer);
      throw new Error("Cannot create a buffer from WebGL context.");
    }

    this.coordBuffer = coordBuffer;
    this.indexBuffer = indexBuffer;

    this.coordArray = new Float32Array([
      -1.0, -1.0,
      1.0, -1.0,
      1.0, 1.0,
      -1.0, 1.0
    ]);
    this.indexArray = new Int16Array([0, 1, 2, 0, 2, 3]);

    const uTexture = gl.getUniformLocation(this.program, "u_texture");

    if (uTexture === null) {
      this.release();
      throw new Error("Cannot get uniform location.");
    }

    this.uTexture = uTexture;
    this.aTexCoord = gl.getAttribLocation(this.program, "a_texCoord");
  }

  public grab(): void {
    this.adjustCanvasSize();
    const gl = this.context;
    gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(this.uTexture, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.coordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.coordArray, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexArray, gl.STATIC_DRAW);

    gl.vertexAttribPointer(this.aTexCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.aTexCoord);

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.video);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.useProgram(null);
  }

  public retrieve(buffer: Uint8Array): void {
    const gl = this.context;
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, buffer);
  }

  public release(): void {
    const gl = this.context;
    gl.deleteBuffer(this.coordBuffer);
    gl.deleteBuffer(this.indexBuffer);

    gl.deleteTexture(this.texture);
    
    gl.deleteProgram(this.program);

    gl.deleteShader(this.vertex);
    gl.deleteShader(this.fragment);

    gl.clear(gl.COLOR_BUFFER_BIT);
  }
}

function createProgram(gl: WebGLRenderingContextBase, vertex: WebGLShader, fragment: WebGLShader): WebGLProgram {
  const program = gl.createProgram();

  if (program === null) {
    throw new Error("Cannot create a program from a WebGL context.");
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);

  gl.linkProgram(program);

  if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return program;
  } else {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(info || "Cannot link a WebGL program.")
  }
}

function createShader(gl: WebGLRenderingContextBase, type: GLenum, source: string): WebGLShader {
  const shader = gl.createShader(type);

  if (shader === null) {
    throw new Error("Cannot create a shader from a WebGL context.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader;
  } else {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(info || "Unknown error during compiling shader.");
  }
}