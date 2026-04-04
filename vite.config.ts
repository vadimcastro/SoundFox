import { defineConfig } from "vite";
import webExtension, { readJsonFile } from "vite-plugin-web-extension";

const target = process.env.BROWSER_TARGET || "chrome";

function generateManifest() {
  const manifest = readJsonFile("manifest.json");
  
  // Transform manifest for Firefox Add-ons
  if (target === "firefox") {
    if (manifest.background && manifest.background.service_worker) {
      manifest.background.scripts = [manifest.background.service_worker];
      delete manifest.background.service_worker;
    }
    // Firefox also sometimes requires browser_specific_settings for ID
    manifest.browser_specific_settings = {
      gecko: {
        id: "soundfox@westen.dev",
        strict_min_version: "109.0"
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
