import { NotionAPI } from "notion-client";
import sharp from "sharp";
import { fetchPublicBytes } from "./safe-fetch";
import { type NotionBlock, plainText, type ReportDocument } from "./types";

const supportedTypes = new Set([
  "text",
  "header",
  "sub_header",
  "sub_sub_header",
  "bulleted_list",
  "numbered_list",
  "to_do",
  "quote",
  "toggle",
  "divider",
  "code",
  "table",
  "table_row",
  "callout",
  "image",
  "equation",
  "bookmark",
  "link_preview",
  "external_object_instance",
  "column_list",
  "column",
  "page",
  "alias",
  "transclusion_container",
]);

export class NotionError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function parseNotionUrl(input: string): URL {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new NotionError(
      "Enter a complete published Notion link, starting with https://.",
    );
  }
  const host = url.hostname.toLowerCase();
  const allowed = ["notion.site", "notion.so", "notion.com"].some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
  if (
    !allowed ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw new NotionError(
      "Use an https:// link on notion.site, notion.so, or notion.com.",
    );
  }
  return url;
}

function extractPageId(value: string): string | undefined {
  return value
    .match(
      /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i,
    )?.[1]
    .replaceAll("-", "");
}

async function resolvePageId(url: URL, signal: AbortSignal): Promise<string> {
  const direct = extractPageId(url.pathname);
  if (direct) return direct;
  const response = await fetchPublicBytes(url.href, 2 * 1024 * 1024, signal);
  const redirected = extractPageId(new URL(response.url).pathname);
  if (redirected) return redirected;
  const html = response.bytes.toString("utf8");
  const canonical = html.match(
    /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i,
  )?.[1];
  const canonicalId = canonical && extractPageId(canonical);
  if (canonicalId) return canonicalId;
  const embedded = html.match(
    /(?:"pageId"|"page_id"|"blockId")[\s:]+"([0-9a-f-]{32,36})"/i,
  )?.[1];
  if (embedded) return embedded.replaceAll("-", "");
  throw new NotionError(
    "This short link does not include a page ID. Copy the full published page link from Notion’s Share → Publish panel.",
  );
}

export function normalizeRecordMap(
  recordMap: unknown,
  sourceUrl: string,
  rootId?: string,
): ReportDocument {
  const raw = recordMap as { block?: Record<string, { value?: unknown }> };
  const blocks: Record<string, NotionBlock> = {};
  for (const entry of Object.values(raw.block ?? {})) {
    let value = entry.value as Record<string, unknown> | undefined;
    if (value && "value" in value && !value.id)
      value = value.value as Record<string, unknown>;
    if (
      value &&
      typeof value.id === "string" &&
      typeof value.type === "string"
    ) {
      blocks[value.id] = value as NotionBlock;
    }
  }
  const root = Object.values(blocks).find((block) =>
    rootId
      ? block.id.replaceAll("-", "") === rootId.replaceAll("-", "")
      : block.type === "page",
  );
  if (!root)
    throw new NotionError(
      "This page is private, unpublished, or no longer available. In Notion, choose Share → Publish → Publish to web.",
      404,
    );
  const document: ReportDocument = {
    id: root.id,
    title: plainText(root.properties?.title) || "Untitled report",
    sourceUrl,
    blocks,
    rootIds: root.content ?? [],
    assets: {},
    warnings: [],
  };
  const visited = new Set<string>();
  function visit(ids: string[], depth = 0) {
    if (depth > 30 || visited.size > 1500)
      throw new NotionError(
        "This page is too large. Try a report with fewer than 1,500 blocks and 30 nesting levels.",
      );
    for (const id of ids) {
      if (visited.has(id)) continue;
      visited.add(id);
      const block = blocks[id];
      if (!block) {
        document.warnings.push({
          blockId: id,
          type: "missing",
          message: "A block is not publicly accessible.",
        });
        continue;
      }
      if (!supportedTypes.has(block.type))
        document.warnings.push({
          blockId: id,
          type: block.type,
          message: `Unsupported ${block.type.replaceAll("_", " ")} block shown as a placeholder.`,
        });
      if (block.type !== "page") visit(block.content ?? [], depth + 1);
    }
  }
  visit(document.rootIds);
  document.blocks = Object.fromEntries(
    [root.id, ...visited]
      .filter((id) => blocks[id])
      .map((id) => [id, blocks[id]]),
  );
  return document;
}

async function embedImages(
  document: ReportDocument,
  signedUrls: Record<string, string>,
  deadline: number,
) {
  const signal = AbortSignal.timeout(Math.max(0, deadline - Date.now()));
  const tasks: { key: string; url: string; blockId: string }[] = [];
  for (const block of Object.values(document.blocks)) {
    if (block.type === "image") {
      const source =
        signedUrls[block.id] ||
        plainText(block.properties?.source) ||
        String(block.format?.display_source ?? "");
      if (source) tasks.push({ key: block.id, url: source, blockId: block.id });
    }
    const icon = block.format?.page_icon;
    if (
      block.type === "callout" &&
      typeof icon === "string" &&
      /^https:\/\//.test(icon)
    )
      tasks.push({ key: `${block.id}:icon`, url: icon, blockId: block.id });
  }
  let totalBytes = 0;
  // Sequential downloads put a strict bound on both memory and upstream traffic.
  for (const task of tasks) {
    if (Date.now() >= deadline) {
      document.warnings.push({
        blockId: task.blockId,
        type: "image",
        message:
          "Image was skipped because the page reached the image-download time limit. Try parsing again, or reduce the number of images.",
      });
      continue;
    }
    try {
      const resource = await fetchPublicBytes(
        task.url,
        8 * 1024 * 1024,
        signal,
      );
      if (
        ![
          "image/png",
          "image/jpeg",
          "image/webp",
          "image/gif",
          "image/avif",
          "image/svg+xml",
        ].includes(resource.contentType)
      )
        throw new Error("The downloaded resource is not a supported image.");
      signal.throwIfAborted();
      const normalized = await sharp(resource.bytes, {
        limitInputPixels: 40_000_000,
      })
        .timeout({
          seconds: Math.max(1, Math.floor((deadline - Date.now()) / 1000)),
        })
        .rotate()
        .resize({
          width: 1800,
          height: 2200,
          fit: "inside",
          withoutEnlargement: true,
        })
        .flatten({ background: "#fff" })
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer();
      if (totalBytes + normalized.length > 2 * 1024 * 1024)
        throw new Error(
          "The report's images exceed the 2 MB embedded-image limit.",
        );
      totalBytes += normalized.length;
      document.assets[task.key] =
        `data:image/jpeg;base64,${normalized.toString("base64")}`;
    } catch (error) {
      document.warnings.push({
        blockId: task.blockId,
        type: "image",
        message: signal.aborted
          ? "Image could not be embedded before the page's image-download time limit. Try parsing again."
          : `Image could not be embedded: ${error instanceof Error ? error.message : "download failed"}`,
      });
    }
  }
}

export async function fetchNotionPage(input: string): Promise<ReportDocument> {
  const deadline = Date.now() + 50_000;
  const signal = AbortSignal.timeout(50_000);
  const url = parseNotionUrl(input);
  try {
    const pageId = await resolvePageId(url, signal);
    const client = new NotionAPI({
      ofetchOptions: {
        timeout: 20_000,
        retry: 0,
        signal: AbortSignal.any([signal, AbortSignal.timeout(40_000)]),
      },
    });
    const map = await client.getPage(pageId, {
      fetchCollections: false,
      fetchMissingBlocks: true,
    });
    const document = normalizeRecordMap(map, url.href, pageId);
    await embedImages(document, map.signed_urls ?? {}, deadline - 2_000);
    return document;
  } catch (error) {
    if (error instanceof NotionError) throw error;
    const message =
      error instanceof Error ? error.message : "Unknown fetch failure";
    if (/not found|400|401|403/i.test(message))
      throw new NotionError(
        "This page could not be read publicly. In Notion, choose Share → Publish → Publish to web, then copy the published link.",
        404,
      );
    throw new NotionError(
      "Notion did not respond. Check your connection and try again in a moment.",
      502,
    );
  }
}
