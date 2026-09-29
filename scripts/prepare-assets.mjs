import { cp, mkdir } from "node:fs/promises";

await mkdir("public/vendor", { recursive: true });
for (const asset of [
  "build/pdf.worker.min.mjs",
  "cmaps",
  "standard_fonts",
  "wasm",
]) {
  const destination = asset.split("/").at(-1);
  await cp(`node_modules/pdfjs-dist/${asset}`, `public/vendor/${destination}`, {
    recursive: true,
  });
}
