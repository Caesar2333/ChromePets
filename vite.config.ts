import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  preview: {
    open: "/player.html"
  },
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
        const nestedImportPage = resolve(projectRoot, "dist/src/import/import.html");
        if (existsSync(nestedImportPage)) {
          copyFileSync(nestedImportPage, resolve(projectRoot, "dist/import.html"));
        }
        const nestedPlayerPage = resolve(projectRoot, "dist/src/player/player.html");
        if (existsSync(nestedPlayerPage)) {
          copyFileSync(nestedPlayerPage, resolve(projectRoot, "dist/player.html"));
        }
        const petsRoot = resolve(projectRoot, "public/pets");
        const catalog = readdirSync(petsRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => {
            const petJsonPath = resolve(petsRoot, entry.name, "pet.json");
            const config = JSON.parse(readFileSync(petJsonPath, "utf-8").replace(/^\uFEFF/, "")) as {
              displayName?: string;
              description?: string;
              spritesheetPath?: string;
            };
            return {
              id: entry.name,
              displayName: config.displayName || entry.name,
              description: config.description,
              source: "built-in",
              config: {
                id: entry.name,
                displayName: config.displayName || entry.name,
                description: config.description,
                spritesheetPath: config.spritesheetPath || "spritesheet.webp"
              }
            };
          });
        mkdirSync(resolve(projectRoot, "dist/pets"), { recursive: true });
        writeFileSync(resolve(projectRoot, "dist/pets/catalog.json"), JSON.stringify(catalog, null, 2));
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
        popup: resolve(projectRoot, "src/popup/popup.html"),
        importPage: resolve(projectRoot, "src/import/import.html"),
        playerPage: resolve(projectRoot, "src/player/player.html")
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
