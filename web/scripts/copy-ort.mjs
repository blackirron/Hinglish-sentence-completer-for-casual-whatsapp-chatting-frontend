// Copies the ONNX Runtime WebAssembly files next to the site so nothing is loaded from a third party CDN.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "onnxruntime-web", "dist");
const to = join(root, "public", "ort");
const files = ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"];

if (!existsSync(from)) {
  console.warn("copy-ort: onnxruntime-web is not installed yet, skipping");
  process.exit(0);
}
mkdirSync(to, { recursive: true });
for (const f of files) copyFileSync(join(from, f), join(to, f));
console.log("copy-ort: copied", files.join(", "));
