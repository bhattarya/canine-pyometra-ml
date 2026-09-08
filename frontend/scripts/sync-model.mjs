// Copy the single source of truth (../models/final_model.json, produced by
// src/analysis/11_finalize_model.py) into the bundle. No numbers are authored here.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "../../models/final_model.json");
const dst = resolve(here, "../src/data/model.json");

if (!existsSync(src)) {
  console.error(`\n  missing ${src}\n  run:  python src/analysis/11_finalize_model.py\n`);
  process.exit(1);
}
mkdirSync(dirname(dst), { recursive: true });
copyFileSync(src, dst);
console.log(`sync-model: ${src} -> ${dst}`);
