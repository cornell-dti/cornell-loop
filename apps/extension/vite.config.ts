import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import webExtension from "vite-plugin-web-extension";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// PLAYWRIGHT is set by the package script (`PLAYWRIGHT=true vite build`), not .env.
function isPlaywrightBuild(): boolean {
  return process.env["PLAYWRIGHT"] === "true";
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    svgr(),
    webExtension({
      manifest: "./manifest.json",
      transformManifest(manifest) {
        if (!isPlaywrightBuild()) return manifest;
        const cs = manifest.content_scripts;
        if (!Array.isArray(cs)) return manifest;
        for (const entry of cs) {
          if (!Array.isArray(entry.matches)) continue;
          if (!entry.matches.includes("http://localhost/*")) {
            entry.matches.push("http://localhost/*");
          }
        }
        return manifest;
      },
    }),
  ],
  build: {
    cssCodeSplit: false,
  },
  resolve: {
    alias: {
      "@app/ui": path.resolve(__dirname, "../../shared/ui/src"),
      "@app/convex": path.resolve(__dirname, "../dashboard/convex"),
    },
    dedupe: ["react", "react-dom"],
  },
});
