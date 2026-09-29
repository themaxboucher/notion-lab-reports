import assert from "node:assert/strict";
import test from "node:test";
import { splitSections } from "../lib/render/sections";
import type { NotionBlock, ReportDocument } from "../lib/types";

function text(id: string, title = id): NotionBlock {
  return { id, type: "text", properties: { title: [[title]] } };
}

function divider(id: string): NotionBlock {
  return { id, type: "divider" };
}

function fixture(rootIds: string[], entries: NotionBlock[]): ReportDocument {
  return {
    id: "test",
    title: "Test report",
    sourceUrl: "https://example.notion.site/test",
    rootIds,
    blocks: Object.fromEntries(entries.map((block) => [block.id, block])),
    assets: {},
    warnings: [],
  };
}

function titles(ids: string[], document: ReportDocument): string[] {
  return ids.flatMap((id) => {
    const block = document.blocks[id];
    assert.notEqual(block.type, "divider");
    const title = block.properties?.title?.map(([value]) => value).join("");
    return [
      ...(title ? [title] : []),
      ...titles(block.content ?? [], document),
    ];
  });
}

test("first root divider separates cover from each body section", () => {
  const document = fixture(
    ["cover", "first", "body", "second", "end"],
    [
      text("cover"),
      divider("first"),
      text("body"),
      divider("second"),
      text("end"),
    ],
  );
  const before = structuredClone(document);
  const result = splitSections(document);
  assert.equal(result.hasSeparator, true);
  assert.deepEqual(result.coverIds, ["cover"]);
  assert.deepEqual(result.bodySections, [["body"], ["end"]]);
  assert.deepEqual(result.document.rootIds, ["cover", "body", "end"]);
  assert.deepEqual(document, before);
});

test("a document without a divider remains entirely body content", () => {
  const document = fixture(["a", "b"], [text("a"), text("b")]);
  const result = splitSections(document);
  assert.equal(result.hasSeparator, false);
  assert.deepEqual(result.coverIds, []);
  assert.deepEqual(result.bodySections, [["a", "b"]]);
  assert.equal(result.document, document);
});

test("nested toggle and list wrappers continue without repeating their text", () => {
  const document = fixture(
    ["toggle", "after"],
    [
      {
        id: "toggle",
        type: "toggle",
        properties: { title: [["Observations"]] },
        content: ["list"],
        format: { block_color: "blue_background" },
      },
      {
        id: "list",
        type: "bulleted_list",
        properties: { title: [["Measurement"]] },
        content: ["a", "divider", "b"],
      },
      text("a"),
      divider("divider"),
      text("b"),
      text("after"),
      text("toggle--section-1", "Existing ID"),
    ],
  );
  const before = structuredClone(document);
  const result = splitSections(document);
  assert.deepEqual(titles(result.coverIds, result.document), [
    "Observations",
    "Measurement",
    "a",
  ]);
  assert.deepEqual(titles(result.bodySections[0], result.document), [
    "b",
    "after",
  ]);
  const firstToggle = result.document.blocks[result.coverIds[0]];
  const nextToggle = result.document.blocks[result.bodySections[0][0]];
  assert.equal(firstToggle.type, "toggle");
  assert.equal(nextToggle.type, "toggle");
  assert.notEqual(firstToggle.id, nextToggle.id);
  assert.equal(nextToggle.properties?.title, undefined);
  assert.deepEqual(nextToggle.format, { block_color: "blue_background" });
  assert.equal(
    result.document.blocks["toggle--section-1"].properties?.title?.[0][0],
    "Existing ID",
  );
  assert.deepEqual(document, before);
});

test("dividers in columns preserve all content and column metadata in source order", () => {
  const document = fixture(
    ["columns"],
    [
      { id: "columns", type: "column_list", content: ["left", "right"] },
      {
        id: "left",
        type: "column",
        format: { column_ratio: 0.4 },
        content: ["a", "divider", "b"],
      },
      {
        id: "right",
        type: "column",
        format: { column_ratio: 0.6 },
        content: ["c"],
      },
      text("a"),
      divider("divider"),
      text("b"),
      text("c"),
    ],
  );
  const result = splitSections(document);
  assert.deepEqual(titles(result.coverIds, result.document), ["a"]);
  assert.deepEqual(titles(result.bodySections[0], result.document), ["b", "c"]);
  const continuedColumns = result.document.blocks[result.bodySections[0][0]];
  assert.equal(continuedColumns.type, "column_list");
  assert.equal(continuedColumns.content?.length, 2);
  const continuedLeft =
    result.document.blocks[continuedColumns.content?.[0] ?? ""];
  assert.deepEqual(continuedLeft.format, { column_ratio: 0.4 });
});

test("consecutive dividers intentionally preserve an empty body section", () => {
  const document = fixture(
    ["cover", "d1", "d2", "body"],
    [text("cover"), divider("d1"), divider("d2"), text("body")],
  );
  const result = splitSections(document);
  assert.deepEqual(result.coverIds, ["cover"]);
  assert.deepEqual(result.bodySections, [[], ["body"]]);
});

test("a trailing divider closes content without an accidental final blank section", () => {
  const document = fixture(
    ["cover", "d1", "body", "d2"],
    [text("cover"), divider("d1"), text("body"), divider("d2")],
  );
  const result = splitSections(document);
  assert.deepEqual(result.bodySections, [["body"]]);
  assert.deepEqual(
    splitSections(fixture(["cover", "d1"], [text("cover"), divider("d1")]))
      .bodySections,
    [],
  );
});

test("empty continuation wrappers do not manufacture content after a trailing divider", () => {
  const document = fixture(
    ["toggle"],
    [
      {
        id: "toggle",
        type: "toggle",
        properties: { title: [["Cover"]] },
        content: ["body", "d1", "d2"],
      },
      text("body"),
      divider("d1"),
      divider("d2"),
    ],
  );
  const result = splitSections(document);
  assert.deepEqual(titles(result.coverIds, result.document), ["Cover", "body"]);
  assert.deepEqual(result.bodySections, [[]]);
});

test("linked page descendants are not part of the rendered document", () => {
  const document = fixture(
    ["page", "body"],
    [
      {
        id: "page",
        type: "page",
        content: ["divider"],
        properties: { title: [["Linked page"]] },
      },
      divider("divider"),
      text("body"),
    ],
  );
  const result = splitSections(document);
  assert.equal(result.hasSeparator, false);
  assert.deepEqual(result.bodySections, [["page", "body"]]);
});

test("callout continuation clones retain embedded icon assets", () => {
  const document = fixture(
    ["callout"],
    [
      {
        id: "callout",
        type: "callout",
        properties: { title: [["Note"]] },
        content: ["a", "d", "b"],
        format: {
          page_icon: "https://example.com/icon.png",
          block_color: "yellow_background",
        },
      },
      text("a"),
      divider("d"),
      text("b"),
    ],
  );
  document.assets["callout:icon"] = "data:image/png;base64,AAAA";
  const result = splitSections(document);
  for (const id of [result.coverIds[0], result.bodySections[0][0]]) {
    assert.equal(
      result.document.assets[`${id}:icon`],
      document.assets["callout:icon"],
    );
  }
});
