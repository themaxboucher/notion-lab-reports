import assert from "node:assert/strict";
import test from "node:test";
import { NotionAPI } from "notion-client";
import { fetchNotionPage } from "../lib/notion";
import { fetchPublicBytes } from "../lib/safe-fetch";

test("an expired parse budget preserves text and reports every skipped image", async (context) => {
  const rootId = "0123456789abcdef0123456789abcdef";
  const images = ["first-image", "second-image", "third-image"];
  const blocks = [
    {
      id: rootId,
      type: "page",
      content: ["text", ...images],
      properties: { title: [["Slow image report"]] },
    },
    { id: "text", type: "text", properties: { title: [["Keep this body."]] } },
    ...images.map((id) => ({
      id,
      type: "image",
      properties: { source: [[`https://example.com/${id}.png`]] },
    })),
  ];
  let now = Date.now();
  context.mock.method(Date, "now", () => now);
  context.mock.method(NotionAPI.prototype, "getPage", async () => {
    now += 49_000;
    return {
      block: Object.fromEntries(
        blocks.map((block) => [block.id, { value: block }]),
      ),
      signed_urls: {},
    };
  });

  const document = await fetchNotionPage(
    `https://example.notion.site/${rootId}`,
  );
  assert.equal(document.title, "Slow image report");
  assert.ok(document.blocks.text);
  assert.deepEqual(document.assets, {});
  assert.deepEqual(
    document.warnings.map((warning) => warning.blockId),
    images,
  );
  assert.ok(
    document.warnings.every((warning) => /time limit/.test(warning.message)),
  );
});

test("the downloader honors an expired caller budget before resolving a host", async () => {
  const error = new Error("The shared parse budget expired.");
  await assert.rejects(
    fetchPublicBytes(
      "https://example.com/image.png",
      1024,
      AbortSignal.abort(error),
    ),
    (actual) => actual === error,
  );
});
