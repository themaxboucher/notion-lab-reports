import { defaultSettings, type ReportSettings } from "../settings";
import type { ReportDocument } from "../types";
import { renderBlocks } from "./blocks";
import { embeddedFontCss } from "./fonts";
import { escapeHtml } from "./rich-text";
import { splitSections } from "./sections";
import { blockStyles, printStyles } from "./styles";

export async function renderDocumentHtml(
  document: ReportDocument,
  settings: ReportSettings = defaultSettings,
  stageOne = false,
): Promise<string> {
  let content: string;
  if (stageOne) {
    content = await renderBlocks(document.rootIds, document);
  } else {
    const sections = splitSections(document);
    const hasCover = sections.hasSeparator || settings.generatedCover;
    const cover = sections.hasSeparator
      ? await renderBlocks(sections.coverIds, sections.document)
      : `<h1>${escapeHtml(document.title)}</h1>`;
    const body = await Promise.all(
      sections.bodySections.map(
        async (ids) =>
          `<section class="report-section">${(await renderBlocks(ids, sections.document)) || '<span aria-hidden="true">&#8203;</span>'}</section>`,
      ),
    );
    content = `${hasCover ? `<section class="report-cover"><div class="report-cover-content">${cover}</div></section>` : ""}${body.join("")}`;
    for (const warning of sections.document.warnings) {
      if (
        !document.warnings.some(
          (existing) => existing.blockId === warning.blockId,
        )
      )
        document.warnings.push(warning);
    }
  }
  const fonts = await embeddedFontCss();
  const layout = stageOne
    ? "body{padding:48px}.report{max-width:660px;margin:auto}"
    : printStyles(settings);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(document.title)}</title><style>${fonts}${blockStyles}${layout}</style></head><body><main class="report">${content}</main></body></html>`;
}
