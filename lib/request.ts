import type { ReportDocument, RichText } from "./types";

export class InputError extends Error {}

export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown>> {
  const maxSize = 4_000_000;
  if (Number(request.headers.get("content-length")) > maxSize)
    throw new InputError(
      "This report is too large. Reduce the number or size of images.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("No report was provided.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxSize) {
        await reader.cancel();
        throw new InputError(
          "This report is too large. Reduce the number or size of images.",
        );
      }
      chunks.push(value);
    }
    const result: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!result || typeof result !== "object" || Array.isArray(result))
      throw new Error("Invalid JSON object.");
    return result as Record<string, unknown>;
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("The report request is not valid JSON.");
  }
}

function isRichText(value: unknown): value is RichText {
  return (
    Array.isArray(value) &&
    value.every(
      (part) =>
        Array.isArray(part) &&
        typeof part[0] === "string" &&
        (part[1] === undefined ||
          (Array.isArray(part[1]) &&
            part[1].every(
              (mark: unknown) =>
                Array.isArray(mark) && typeof mark[0] === "string",
            ))),
    )
  );
}

export function validateDocument(input: unknown): ReportDocument {
  if (!input || typeof input !== "object")
    throw new InputError("Parse a Notion page before exporting.");
  const document = input as ReportDocument;
  if (
    typeof document.title !== "string" ||
    typeof document.id !== "string" ||
    typeof document.sourceUrl !== "string" ||
    !Array.isArray(document.rootIds) ||
    !document.rootIds.every((id) => typeof id === "string") ||
    !document.blocks ||
    typeof document.blocks !== "object" ||
    !document.assets ||
    typeof document.assets !== "object"
  )
    throw new InputError(
      "The report data is incomplete. Parse the page again.",
    );
  const blocks = Object.entries(document.blocks);
  if (blocks.length > 1500)
    throw new InputError(
      "This report contains too many blocks (maximum 1,500).",
    );
  for (const [id, block] of blocks) {
    if (
      !block ||
      block.id !== id ||
      typeof block.type !== "string" ||
      !/^[a-z0-9_-]{1,120}$/i.test(id) ||
      ["__proto__", "constructor", "prototype"].includes(id) ||
      (block.content !== undefined &&
        (!Array.isArray(block.content) ||
          !block.content.every((item) => typeof item === "string"))) ||
      (block.properties !== undefined &&
        (!block.properties ||
          typeof block.properties !== "object" ||
          !Object.values(block.properties).every(isRichText)))
    )
      throw new InputError(
        "The report contains an invalid block. Parse the page again.",
      );
  }
  const visit = (
    ids: string[],
    ancestors: Set<string>,
    count: { value: number },
  ) => {
    if (ancestors.size > 30)
      throw new InputError("This report is nested too deeply.");
    for (const id of ids) {
      if (ancestors.has(id) || ++count.value > 3000)
        throw new InputError(
          "This report contains cyclic or excessively repeated blocks.",
        );
      const block = document.blocks[id];
      if (block && block.type !== "page")
        visit(block.content ?? [], new Set([...ancestors, id]), count);
    }
  };
  visit(document.rootIds, new Set(), { value: 0 });
  for (const asset of Object.values(document.assets)) {
    if (
      typeof asset !== "string" ||
      !/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(asset)
    )
      throw new InputError("The report contains an invalid embedded image.");
  }
  return { ...document, title: document.title.slice(0, 300), warnings: [] };
}
