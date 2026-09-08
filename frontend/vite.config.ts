import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// SINGLE_FILE=1  -> emit one self-contained dist/index.html (works as an
// Artifact and offline). Default multi-asset build is used for GitHub Pages.
const singleFile = process.env.SINGLE_FILE === "1";

export default defineConfig({
  // repo-name base so asset URLs resolve on project Pages
  base: process.env.PAGES_BASE ?? "/canine-pyometra-ml/",
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  build: {
    target: "es2020",
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 100_000_000 : 4096,
  },
});
