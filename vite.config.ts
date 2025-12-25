import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, "index.ts"),
      fileName: "index",
      formats: ["cjs"],
    },
    rollupOptions: {
      external: ["siyuan"],
      output: {
        entryFileNames: "[name].js",
        exports: "named" // 或者 "default"？Siyuan 插件通常 export default class
      },
    },
    outDir: "./",
    emptyOutDir: false,
    sourcemap: false,
    minify: false,
  },
});
