import assert from "node:assert/strict";
import test from "node:test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { loadFixture } from "../lib/fixture";
import { renderPdf } from "../lib/pdf";
import { defaultSettings } from "../lib/settings";
import type { ReportDocument } from "../lib/types";

async function inspect(bytes: Uint8Array) {
  const loading = getDocument({ data: bytes });
  const pdf = await loading.promise;
  const pages = [];
  for (let index = 1; index <= pdf.numPages; index++) {
    const page = await pdf.getPage(index);
    const text = await page.getTextContent();
    const items = text.items.filter((item): item is TextItem => "str" in item);
    pages.push({
      items,
      text: items.map((item) => item.str).join(" "),
      viewport: page.getViewport({ scale: 1 }),
    });
  }
  await loading.destroy();
  return pages;
}

test("full fixture PDF has cover, exact body numbering, repeated table headers and all content", {
  timeout: 60_000,
}, async () => {
  const pages = await inspect(
    await renderPdf(await loadFixture(), {
      ...defaultSettings,
      runningHeader: "ENSF QA",
    }),
  );
  assert.ok(pages.length > 6);
  assert.match(pages[0].text, /Frequency Response/);
  assert.doesNotMatch(pages[0].text, /ENSF QA|1\. Objective/);
  assert.equal(
    pages[0].items.filter((item) => item.transform[5] < 50).length,
    0,
  );
  for (let index = 1; index < pages.length; index++) {
    assert.match(pages[index].text, /ENSF QA/);
    assert.ok(
      pages[index].items.some(
        (item) => item.str === String(index) && item.transform[5] < 50,
      ),
    );
  }
  assert.match(pages[1].text, /1\. Objective and Method/);
  const tablePages = pages.filter((page) =>
    page.text.includes("Measured gain"),
  );
  assert.ok(tablePages.length >= 2);
  for (const page of tablePages)
    assert.match(
      page.text,
      /Sample.*Frequency.*Model gain.*Measured gain.*Phase/,
    );
  for (let sample = 1; sample <= 60; sample++) {
    assert.equal(
      tablePages
        .flatMap((page) => page.items)
        .filter((item) => item.str === String(sample).padStart(2, "0")).length,
      1,
      `Table sample ${sample} is retained once`,
    );
  }
  assert.match(pages.at(-1)?.text ?? "", /End of report/);
  assert.ok(pages.some((page) => page.text.includes("Listing 1.")));
  assert.match(
    pages.map((page) => page.text).join(" "),
    /from\s+math\s+import\s+pi, sqrt/,
  );
  assert.equal(pages[0].viewport.width, 612);
  assert.equal(pages[0].viewport.height, 792);
});

test("no-divider A4 documents can generate a title cover and change numbering position", {
  timeout: 60_000,
}, async () => {
  const document: ReportDocument = {
    id: "root",
    title: "Generated cover",
    sourceUrl: "fixture:test",
    rootIds: ["a", "b"],
    blocks: {
      a: {
        id: "a",
        type: "header",
        properties: { title: [["First body heading"]] },
      },
      b: {
        id: "b",
        type: "text",
        properties: { title: [["Selectable paragraph in the body."]] },
      },
    },
    assets: {},
    warnings: [],
  };
  const settings = {
    ...defaultSettings,
    paper: "a4" as const,
    generatedCover: true,
    pageNumberPosition: "right" as const,
    runningHeader: "A4 report",
  };
  const pages = await inspect(await renderPdf(document, settings));
  assert.equal(pages.length, 2);
  assert.match(pages[0].text, /Generated cover/);
  assert.doesNotMatch(pages[0].text, /A4 report/);
  assert.match(pages[1].text, /First body heading/);
  assert.match(pages[1].text, /A4 report/);
  assert.ok(
    pages[1].items.some(
      (item) =>
        item.str === "1" && item.transform[4] > 450 && item.transform[5] < 50,
    ),
  );
  assert.ok(Math.abs(pages[0].viewport.width - 595.28) < 1);
  const noCover = await inspect(
    await renderPdf(document, {
      ...settings,
      generatedCover: false,
      pageNumbers: false,
      runningHeader: "",
    }),
  );
  assert.equal(noCover.length, 1);
  assert.doesNotMatch(noCover[0].text, /Generated cover|A4 report/);
  assert.equal(
    noCover[0].items.filter((item) => item.transform[5] < 50).length,
    0,
  );
});
