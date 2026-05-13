import { copyFileSync, existsSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    {
      name: "copy-extension-manifest",
      closeBundle() {
        copyFileSync(resolve(projectRoot, "manifest.json"), resolve(projectRoot, "dist/manifest.json"));
        const nestedPopup = resolve(projectRoot, "dist/src/popup/popup.html");
        if (existsSync(nestedPopup)) {
          copyFileSync(nestedPopup, resolve(projectRoot, "dist/popup.html"));
        }
      }
    }
  ],
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rollupOptions: {
      input: {
        content: resolve(projectRoot, "src/content/content.ts"),
        serviceWorker: resolve(projectRoot, "src/background/service-worker.ts"),
        popup: resolve(projectRoot, "src/popup/popup.html")
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "content") return "content/content.js";
          if (chunk.name === "serviceWorker") return "background/service-worker.js";
          return "assets/[name].js";
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]"
      }
    }
  }
});
