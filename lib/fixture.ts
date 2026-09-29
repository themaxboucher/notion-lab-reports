import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeRecordMap } from "./notion";
import { plainText, type ReportDocument } from "./types";

export async function loadFixture(): Promise<ReportDocument> {
  const map = JSON.parse(
    await readFile(
      path.join(process.cwd(), "fixtures/lab-report.json"),
      "utf8",
    ),
  );
  const document = normalizeRecordMap(map, "fixture:lab-report");
  for (const block of Object.values(document.blocks)) {
    const source = plainText(block.properties?.source);
    if (block.type === "image" && source.startsWith("data:image/"))
      document.assets[block.id] = source;
  }
  return document;
}
