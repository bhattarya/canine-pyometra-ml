import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// SINGLE_FILE=1  -> emit one self-contained dist/index.html (Artifact / offline).
const singleFile = process.env.SINGLE_FILE === "1";

// Base URL:
//   Vercel / any root-domain host -> "/" (the default)
//   GitHub Pages project site     -> the workflow sets PAGES_BASE=/canine-pyometra-ml/
const base = process.env.PAGES_BASE ?? "/";

export default defineConfig({
  base,
  plugins: [react(), ...(singleFile ? [viteSingleFile()] : [])],
  build: {
    target: "es2020",
    cssCodeSplit: !singleFile,
    assetsInlineLimit: singleFile ? 100_000_000 : 4096,
  },
});
