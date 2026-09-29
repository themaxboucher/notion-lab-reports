import { mkdir, writeFile } from "node:fs/promises";
import { NotionAPI } from "notion-client";

const pageId = process.argv[2] ?? "067dd719a912471ea9a3ac10710e7fdf";
const startedAt = new Date().toISOString();
const notion = new NotionAPI();

try {
  const recordMap = await notion.getPage(pageId, {
    fetchCollections: false,
    fetchMissingBlocks: true,
  });
  await mkdir("output", { recursive: true });
  await writeFile(
    "output/live-record-map.json",
    JSON.stringify(recordMap, null, 2),
  );
  const blocks = Object.values(recordMap.block ?? {}).map(
    (entry) => entry.value?.value ?? entry.value,
  );
  const root = blocks.find(
    (block) => block?.id?.replaceAll("-", "") === pageId.replaceAll("-", ""),
  );
  if (!root?.content?.length) {
    throw new Error(
      "The response did not contain a readable page with child blocks.",
    );
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        startedAt,
        pageId,
        title: root.properties?.title?.map((part) => part[0]).join(""),
        blockCount: blocks.length,
        blockTypes: [...new Set(blocks.map((block) => block?.type))].sort(),
        authenticated: false,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        startedAt,
        pageId,
        name: error.name,
        message: error.message,
        cause: error.cause?.message,
        authenticated: false,
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
