import { resolve } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import glsl from "vite-plugin-glsl";

export default defineConfig(env => {
  return {
    build: {
      lib: {
        // Could also be a dictionary or array of multiple entry points
        entry: resolve(__dirname, "lib/html-video-capture.ts"),
        name: "HTMLVideoCapture",
        // the proper extensions will be added
        fileName: "html-video-capture",
      },
    },
    plugins: [
      glsl({
        compress: env.mode === "production" ? true : false,
      }),
      dts({ include: ["lib"] }),
    ]

  }
})