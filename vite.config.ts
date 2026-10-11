import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dirname = path.dirname(fileURLToPath(import.meta.url));

// @designcodeio/threeui resolves to the exact registered source copied
// byte-for-byte into src/shaders/, so the configured
// `import { MengToSketchbookLandingPage } from "@designcodeio/threeui"`
// runs the authored component rather than a recreation.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "@designcodeio/threeui/style.css",
        replacement: path.resolve(dirname, "src/shaders/threeui.css"),
      },
      {
        find: "@designcodeio/threeui",
        replacement: path.resolve(dirname, "src/shaders/threeui-entry.ts"),
      },
    ],
  },
  assetsInclude: ["**/*.woff2"],
  server: {
    port: 5173,
  },
});
