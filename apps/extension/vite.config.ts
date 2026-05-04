import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import svgr from "vite-plugin-svgr";
import webExtension from "vite-plugin-web-extension";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// When PLAYWRIGHT=true the content script is also injected into localhost pages
// so that Playwright tests can exercise the extension against a local fixture
// page without needing real Gmail or Google Calendar.
const isPlaywrightBuild = process.env["PLAYWRIGHT"] === "true";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    svgr(),
    webExtension({
      manifest: "./manifest.json",
      additionalInputs: [],
      transformManifest(manifest) {
        if (!isPlaywrightBuild) return manifest;
        const cs = manifest.content_scripts;
        if (Array.isArray(cs)) {
          for (const entry of cs) {
            if (Array.isArray(entry.matches)) {
              entry.matches.push("http://localhost/*");
            }
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
