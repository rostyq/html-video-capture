import "rvfc-polyfill";
// @ts-ignore
import { HTMLVideoCapture2D, HTMLVideoCaptureGL, type VideoCapture } from "../lib/html-video-capture";

const containerDiv = document.querySelector<HTMLDivElement>('#media-container')!;
let videoElement: HTMLVideoElement | undefined;
let canvasElement: HTMLCanvasElement | undefined;
let mediaStream: MediaStream | undefined;
let capture: VideoCapture | undefined;
let videoFrameCallbackRequest: number;

document.querySelector<HTMLButtonElement>("#open-button")!.onclick = async () => {
  mediaStream = await navigator.mediaDevices.getUserMedia({
    video: {
      frameRate: { exact: 30 },
      width: { exact: 320 },
      height: { exact: 240 },
    }
  });

  videoElement = document.createElement("video");
  canvasElement = document.createElement("canvas");
  containerDiv.append(videoElement, canvasElement);

  // @ts-ignore
  window.video = videoElement;
  // @ts-ignore
  window.canvas = canvasElement;

  videoElement.srcObject = mediaStream;
  await videoElement.play();

  // const capture = new HTMLVideoCapture2D(videoElement, {
  //   element: canvasElement,
  //   options: {
  //     // desynchronized: true,
  //     willReadFrequently: true,
  //   }
  // });

  capture = new HTMLVideoCaptureGL(videoElement, {
    canvas: canvasElement,
    shader: "rgba",
    // context: {
    //   desynchronized: true,
    // }
  });

  let t0 = performance.now();
  let t1 = performance.now();

  const update = () => {
    t1 = performance.now();
    const dt = t1 - t0;
    capture!.grab();

    t0 = performance.now();
    videoFrameCallbackRequest = videoElement!.requestVideoFrameCallback(update);

    const array = new Uint8Array(capture!.size() * 4);

    capture!.retrieve(array);

    // @ts-ignore
    window.output = array;
    console.debug(dt);
  }

  update();
};

document.querySelector<HTMLButtonElement>("#close-button")!.onclick = async () => {
  videoElement?.cancelVideoFrameCallback(videoFrameCallbackRequest);
  mediaStream?.getTracks().forEach(track => track.stop());
  capture?.release();

  videoElement?.remove();
  canvasElement?.remove();

  videoElement = undefined;
  canvasElement = undefined;
  mediaStream = undefined;
};
