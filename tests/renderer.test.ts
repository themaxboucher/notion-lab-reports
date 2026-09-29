import assert from "node:assert/strict";
import test from "node:test";
import { loadFixture } from "../lib/fixture";
import { normalizeRecordMap, parseNotionUrl } from "../lib/notion";
import { renderBlocks } from "../lib/render/blocks";
import { renderDocumentHtml } from "../lib/render/html";
import { renderRichText } from "../lib/render/rich-text";
import { validateDocument } from "../lib/request";
import { fetchPublicBytes } from "../lib/safe-fetch";
import {
  defaultSettings,
  safeFilename,
  validateSettings,
} from "../lib/settings";

test("fixture renders all supported content with no external image or font dependencies", async () => {
  const document = await loadFixture();
  const html = await renderDocumentHtml(document);
  assert.match(html, /report-cover-content/);
  assert.doesNotMatch(html, /<hr /);
  assert.match(html, /class="report-code report-code-short"/);
  assert.match(html, /class="shiki github-light"/);
  assert.match(html, /<thead><tr/);
  assert.match(html, /scope="row"/);
  assert.equal((html.match(/<tr /g) ?? []).length, 61);
  assert.equal((html.match(/<img src="data:image\/png/g) ?? []).length, 2);
  assert.match(html, /katex-display/);
  assert.match(html, /report-toggle-content/);
  assert.match(html, /report-columns/);
  assert.match(html, /data-unsupported-type="collection_view"/);
  assert.match(html, /data-unsupported-type="embed"/);
  assert.doesNotMatch(html, /<img[^>]+src="https?:/);
  assert.doesNotMatch(html, /url\((?:fonts|\.\/files)/);
});

test("rich text escapes HTML, suppresses dangerous links, and retains semantic marks", () => {
  const html = renderRichText([
    ["<script>alert(1)</script>", [["b"], ["a", "javascript:alert(1)"]]],
    ["ok", [["i"], ["_"], ["s"], ["a", 'https://example.com/?q="test"']]],
  ]);
  assert.doesNotMatch(html, /<script|javascript:/);
  assert.match(html, /<strong>&lt;script&gt;/);
  assert.match(html, /<s><u><em>ok<\/em><\/u><\/s>/);
  assert.match(html, /href="https:\/\/example.com/);
});

test("a missing referenced block is a visible placeholder", async () => {
  const document = await loadFixture();
  const html = await renderBlocks(["missing-id"], document);
  assert.match(html, /data-unsupported-type="missing"/);
  assert.equal(document.warnings.at(-1)?.type, "missing");
});

test("Notion URL validation only permits published Notion HTTPS origins", () => {
  assert.equal(
    parseNotionUrl("https://example.notion.site/abc").hostname,
    "example.notion.site",
  );
  for (const url of [
    "http://example.notion.site/abc",
    "https://notion.site.evil.example/",
    "https://notion.site@127.0.0.1/",
    "https://example.notion.site:8080/",
    "not a link",
  ])
    assert.throws(() => parseNotionUrl(url));
});

test("normalization supports both Notion record versions and prunes unrendered subpages", () => {
  const root = {
    id: "root",
    type: "page",
    content: ["a", "child"],
    properties: { title: [["Report"]] },
  };
  const a = { id: "a", type: "text", properties: { title: [["Body"]] } };
  const child = { id: "child", type: "page", content: ["private"] };
  const privateBlock = { id: "private", type: "image" };
  for (const nested of [false, true]) {
    const map = {
      block: Object.fromEntries(
        [root, a, child, privateBlock].map((block) => [
          block.id,
          { value: nested ? { value: block } : block },
        ]),
      ),
    };
    const result = normalizeRecordMap(map, "fixture:test", "root");
    assert.equal(result.title, "Report");
    assert.equal(result.blocks.private, undefined);
    assert.deepEqual(result.rootIds, ["a", "child"]);
  }
});

test("server input validation rejects malformed assets and cyclic blocks", async () => {
  const document = await loadFixture();
  assert.equal(validateDocument(document).title, document.title);
  const broken = structuredClone(document);
  broken.assets.bad = "https://127.0.0.1/secrets";
  assert.throws(() => validateDocument(broken), /invalid embedded image/);
  const cyclic = structuredClone(document);
  const first = cyclic.rootIds[0];
  cyclic.blocks[first].content = [first];
  assert.throws(() => validateDocument(cyclic), /cyclic/);
  assert.throws(() => validateDocument({ blocks: [] }));
});

test("resource downloader rejects private network addresses before making HTTP requests", async () => {
  await assert.rejects(
    fetchPublicBytes("https://127.0.0.1/internal"),
    /public address/,
  );
  await assert.rejects(
    fetchPublicBytes("http://example.com/image.png"),
    /public HTTPS/,
  );
});

test("settings enforce printable ranges and cannot inject CSS", () => {
  const settings = validateSettings({
    fontSize: 900,
    lineHeight: -10,
    paper: "invalid",
    headingColor: "</style><script>alert(1)</script>",
  });
  assert.equal(settings.fontSize, 13);
  assert.equal(settings.lineHeight, 1.2);
  assert.equal(settings.paper, defaultSettings.paper);
  assert.equal(settings.headingColor, "#000000");
  assert.equal(safeFilename("../../Lab:3.pdf"), "....Lab3.pdf");
});
