import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadFixture } from "../lib/fixture";
import { renderPdf } from "../lib/pdf";
import { renderDocumentHtml } from "../lib/render/html";
import { defaultSettings, validateSettings } from "../lib/settings";

const output = path.resolve(process.argv[2] ?? "output/pdf/lab-report.pdf");
const settings = process.argv[3]
  ? validateSettings(JSON.parse(process.argv[3]))
  : defaultSettings;
const document = await loadFixture();
await mkdir(path.dirname(output), { recursive: true });
await writeFile(
  output.replace(/\.pdf$/i, ".html"),
  await renderDocumentHtml(document, settings),
);
const pdf = await renderPdf(document, settings);
await writeFile(output, pdf);
console.log(
  `Rendered ${document.title}\n${output}\n${pdf.byteLength.toLocaleString()} bytes`,
);
for (const warning of document.warnings)
  console.log(`Notice: ${warning.message}`);
