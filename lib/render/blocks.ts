import { type BundledLanguage, bundledLanguages, codeToHtml } from "shiki";
import type { NotionBlock, ReportDocument } from "../types";
import {
  colorClass,
  escapeHtml,
  plainText,
  renderEquation,
  renderRichText,
  safeUrl,
} from "./rich-text";

const languageAliases: Record<string, string> = {
  "c++": "cpp",
  "c#": "csharp",
  "f#": "fsharp",
  "objective-c": "objective-c",
  "plain text": "text",
  plaintext: "text",
  shell: "bash",
  "shell script": "bash",
  "visual basic": "vb",
  assembly: "asm",
  markup: "html",
  docker: "dockerfile",
};

export const supportedBlockTypes = new Set([
  "text",
  "paragraph",
  "header",
  "sub_header",
  "sub_sub_header",
  "header_4",
  "heading_1",
  "heading_2",
  "heading_3",
  "bulleted_list",
  "numbered_list",
  "to_do",
  "quote",
  "toggle",
  "divider",
  "image",
  "equation",
  "callout",
  "column_list",
  "column",
  "code",
  "table",
  "table_row",
  "bookmark",
  "link_preview",
  "external_object_instance",
  "page",
  "alias",
  "transclusion_container",
]);

interface RenderContext {
  document: ReportDocument;
  ancestors: Set<string>;
}

function blockAttributes(block: NotionBlock, className: string): string {
  const color = colorClass(block.format?.block_color);
  return `id="block-${escapeHtml(block.id)}" data-block-id="${escapeHtml(block.id)}" class="${className}${color}"`;
}

function placeholder(
  block: NotionBlock,
  context: RenderContext,
  reason?: string,
): string {
  const message =
    reason ??
    `The ${block.type.replaceAll("_", " ")} block is not supported in PDF output.`;
  if (
    !context.document.warnings.some((warning) => warning.blockId === block.id)
  ) {
    context.document.warnings.push({
      blockId: block.id,
      type: block.type,
      message,
    });
  }
  return `<aside ${blockAttributes(block, "report-placeholder")} data-unsupported-type="${escapeHtml(block.type)}"><strong>${escapeHtml(block.type.replaceAll("_", " "))}</strong><span>${escapeHtml(message)}</span></aside>`;
}

function embeddedImage(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[a-z\d+/=\s]+$/i.test(
      value,
    )
    ? value
    : undefined;
}

function caption(block: NotionBlock, document: ReportDocument): string {
  const html = renderRichText(block.properties?.caption, document);
  return html ? `<figcaption class="report-caption">${html}</figcaption>` : "";
}

async function renderCode(
  block: NotionBlock,
  document: ReportDocument,
): Promise<string> {
  const code = plainText(block.properties?.title);
  const label = plainText(block.properties?.language) || "Plain text";
  const normalized = label.toLowerCase().trim();
  const language = languageAliases[normalized] ?? normalized;
  const supported = language in bundledLanguages;
  let highlighted: string;
  try {
    highlighted = await codeToHtml(code, {
      lang: supported ? (language as BundledLanguage) : "text",
      theme: "github-light",
    });
  } catch {
    highlighted = `<pre><code>${escapeHtml(code)}</code></pre>`;
  }
  const short = code.split("\n").length < 25 ? " report-code-short" : "";
  return `<figure ${blockAttributes(block, `report-code${short}`)}><div class="report-code-label">${escapeHtml(label)}</div>${highlighted}${caption(block, document)}</figure>`;
}

async function renderTable(
  block: NotionBlock,
  context: RenderContext,
): Promise<string> {
  const { document } = context;
  const rows = (block.content ?? [])
    .map((id) => document.blocks[id])
    .filter((row): row is NotionBlock => Boolean(row));
  const definedOrder = block.format?.table_block_column_order;
  const columns = Array.isArray(definedOrder)
    ? definedOrder.filter(
        (column): column is string => typeof column === "string",
      )
    : [...new Set(rows.flatMap((row) => Object.keys(row.properties ?? {})))];
  if (!rows.length || !columns.length) {
    return `<div ${blockAttributes(block, "report-empty-table")}>Empty table</div>`;
  }

  const headerRow = block.format?.table_block_column_header === true;
  const headerColumn = block.format?.table_block_row_header === true;
  const renderedRows = rows.map((row, rowIndex) => {
    const cells = columns
      .map((column, columnIndex) => {
        const isColumnHeading = headerRow && rowIndex === 0;
        const isRowHeading = headerColumn && columnIndex === 0;
        const tag = isColumnHeading || isRowHeading ? "th" : "td";
        const scope = isColumnHeading
          ? ' scope="col"'
          : isRowHeading
            ? ' scope="row"'
            : "";
        return `<${tag}${scope}>${renderRichText(row.properties?.[column], document) || "&#8203;"}</${tag}>`;
      })
      .join("");
    return `<tr id="block-${escapeHtml(row.id)}">${cells}</tr>`;
  });
  const head = headerRow ? `<thead>${renderedRows.shift()}</thead>` : "";
  return `<table ${blockAttributes(block, "report-table")}>${head}<tbody>${renderedRows.join("")}</tbody></table>`;
}

async function children(
  block: NotionBlock,
  context: RenderContext,
): Promise<string> {
  return renderSequence(block.content ?? [], context);
}

async function renderBlock(
  block: NotionBlock,
  context: RenderContext,
): Promise<string> {
  const { document } = context;
  if (context.ancestors.has(block.id) || context.ancestors.size >= 50) {
    return placeholder(
      block,
      context,
      "This block contains a circular or excessively nested reference.",
    );
  }
  const nestedContext = {
    ...context,
    ancestors: new Set([...context.ancestors, block.id]),
  };
  const title = renderRichText(block.properties?.title, document);
  const attributes = (className: string) => blockAttributes(block, className);

  switch (block.type) {
    case "text":
    case "paragraph":
      return `<div ${attributes("report-text-block")}><p>${title || "<br>"}</p>${await children(block, nestedContext)}</div>`;
    case "header":
    case "heading_1":
    case "sub_header":
    case "heading_2":
    case "sub_sub_header":
    case "heading_3":
    case "header_4": {
      const levels: Record<string, number> = {
        header: 1,
        heading_1: 1,
        sub_header: 2,
        heading_2: 2,
        sub_sub_header: 3,
        heading_3: 3,
        header_4: 3,
      };
      const level = levels[block.type];
      return `<h${level} ${attributes(`report-heading report-h${level}`)}>${title}</h${level}>${await children(block, nestedContext)}`;
    }
    case "bulleted_list":
    case "numbered_list":
      return `<li ${attributes("report-list-item")}><div class="report-list-text">${title}</div>${await children(block, nestedContext)}</li>`;
    case "to_do": {
      const checked = plainText(block.properties?.checked) === "Yes";
      return `<div ${attributes(`report-todo${checked ? " report-todo-checked" : ""}`)}><div class="report-todo-line"><span class="report-checkbox" role="img" aria-label="${checked ? "Checked" : "Unchecked"}">${checked ? "☑" : "☐"}</span><span>${title}</span></div>${await children(block, nestedContext)}</div>`;
    }
    case "quote":
      return `<blockquote ${attributes("report-quote")}><p>${title}</p>${await children(block, nestedContext)}</blockquote>`;
    case "toggle":
      return `<section ${attributes("report-toggle")}><div class="report-toggle-title"><span class="report-toggle-marker" aria-hidden="true">▾</span>${title}</div><div class="report-toggle-content">${await children(block, nestedContext)}</div></section>`;
    case "divider":
      return `<hr ${attributes("report-divider")} data-divider>`;
    case "code":
      return renderCode(block, document);
    case "equation":
      return `<div ${attributes("report-equation")}>${renderEquation(plainText(block.properties?.title), true)}</div>`;
    case "image": {
      const source = embeddedImage(document.assets[block.id]);
      if (!source)
        return placeholder(
          block,
          context,
          "The image could not be downloaded for this report.",
        );
      const alt =
        plainText(block.properties?.alt_text) ||
        plainText(block.properties?.caption) ||
        "Report image";
      return `<figure ${attributes("report-image")}><img src="${escapeHtml(source)}" alt="${escapeHtml(alt)}">${caption(block, document)}</figure>`;
    }
    case "callout": {
      const iconImage = embeddedImage(document.assets[`${block.id}:icon`]);
      const rawIcon = block.format?.page_icon;
      const emoji =
        typeof rawIcon === "string" &&
        !rawIcon.includes(":") &&
        rawIcon.length <= 24
          ? rawIcon
          : "";
      const icon = iconImage
        ? `<img src="${escapeHtml(iconImage)}" alt="" class="report-callout-icon-image">`
        : escapeHtml(emoji || "●");
      return `<aside ${attributes("report-callout")}><span class="report-callout-icon" aria-hidden="true">${icon}</span><div class="report-callout-content"><p>${title}</p>${await children(block, nestedContext)}</div></aside>`;
    }
    case "column_list":
      return `<div ${attributes("report-columns")}>${await children(block, nestedContext)}</div>`;
    case "column": {
      const ratio = block.format?.column_ratio;
      const width =
        typeof ratio === "number" && Number.isFinite(ratio) && ratio > 0
          ? Math.min(ratio, 1)
          : 1;
      return `<div ${attributes("report-column")} style="flex-grow:${width}">${await children(block, nestedContext)}</div>`;
    }
    case "table":
      return renderTable(block, nestedContext);
    case "bookmark":
    case "link_preview":
    case "external_object_instance": {
      const url = safeUrl(
        plainText(block.properties?.link) ||
          plainText(block.properties?.source) ||
          block.format?.original_url,
      );
      if (!url)
        return placeholder(
          block,
          context,
          "This link preview has no printable URL.",
        );
      const description = renderRichText(
        block.properties?.description,
        document,
      );
      return `<aside ${attributes("report-bookmark")}><a class="report-bookmark-title" href="${escapeHtml(url)}" rel="noreferrer">${title || escapeHtml(url)}</a>${description ? `<p>${description}</p>` : ""}<span class="report-bookmark-url">${escapeHtml(url)}</span></aside>`;
    }
    case "page":
      return `<p ${attributes("report-page-link")}><a href="https://www.notion.so/${escapeHtml(block.id.replaceAll("-", ""))}" rel="noreferrer">${title || "Untitled page"}</a></p>`;
    case "alias": {
      const pointer = block.format?.alias_pointer;
      const id =
        pointer && typeof pointer === "object" && "id" in pointer
          ? pointer.id
          : undefined;
      if (typeof id !== "string" || !/^[a-f\d-]{32,36}$/i.test(id))
        return placeholder(block, context);
      const target = document.blocks[id];
      const label = target
        ? renderRichText(target.properties?.title, document)
        : title;
      return `<p ${attributes("report-page-link")}><a href="https://www.notion.so/${escapeHtml(id.replaceAll("-", ""))}" rel="noreferrer">${label || "Linked page"}</a></p>`;
    }
    case "transclusion_container":
      return `<div ${attributes("report-synced-block")}>${await children(block, nestedContext)}</div>`;
    default:
      return `${placeholder(block, context)}${await children(block, nestedContext)}`;
  }
}

async function renderSequence(
  ids: string[],
  context: RenderContext,
): Promise<string> {
  const result: string[] = [];
  let listType: "ul" | "ol" | undefined;
  for (const id of ids) {
    const block = context.document.blocks[id] ?? { id, type: "missing" };
    const type =
      block.type === "bulleted_list"
        ? "ul"
        : block.type === "numbered_list"
          ? "ol"
          : undefined;
    const requestedStart = block.format?.list_start_index;
    const startsNewList = type === "ol" && typeof requestedStart === "number";
    if (listType && (listType !== type || startsNewList)) {
      result.push(`</${listType}>`);
      listType = undefined;
    }
    if (type && !listType) {
      const start =
        type === "ol" &&
        typeof requestedStart === "number" &&
        Number.isInteger(requestedStart)
          ? ` start="${Math.max(1, Math.min(10000, requestedStart))}"`
          : "";
      result.push(`<${type} class="report-list"${start}>`);
      listType = type;
    }
    result.push(await renderBlock(block, context));
  }
  if (listType) result.push(`</${listType}>`);
  return result.join("");
}

export async function renderBlocks(
  ids: string[],
  document: ReportDocument,
): Promise<string> {
  return renderSequence(ids, { document, ancestors: new Set() });
}
