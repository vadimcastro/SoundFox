import { defineConfig } from "vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";

const target = process.env.BROWSER_TARGET || "chrome";

function generateManifest() {
  const manifest = readJsonFile("manifest.json");

  if (target === "firefox") {
    // 1. Fix Background for Firefox MV3
    if (manifest.background) {
      // Vite-plugin-web-extension converts src/background.ts to src/background.js in dist
      manifest.background.scripts = ["src/background.js"];
      delete manifest.background.service_worker;
      delete manifest.background.type;
    }

    // 2. Add required Firefox properties
    manifest.browser_specific_settings = {
      gecko: {
        id: "soundfox@vadimcastro.github.io",
        strict_min_version: "140.0",
        data_collection_permissions: {
          required: ["none"]
        }
      },
      gecko_android: {
        strict_min_version: "142.0"
      }
    };
  }

  return manifest;
}

export default defineConfig({
  build: {
    outDir: `dist/${target}`
  },
  plugins: [
    webExtension({
      manifest: generateManifest,
    }),
  ],
});
