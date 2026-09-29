import type { NotionBlock, ReportDocument } from "../types";

interface BlockSections {
  segments: string[][];
  hasSeparator: boolean;
}

export interface ReportSections {
  hasSeparator: boolean;
  coverIds: string[];
  bodySections: string[][];
  document: ReportDocument;
}

const leafTypes = new Set([
  "page",
  "alias",
  "code",
  "image",
  "equation",
  "bookmark",
  "link_preview",
  "external_object_instance",
  "table",
  "table_row",
]);

const contentOnlyTypes = new Set([
  "column_list",
  "column",
  "transclusion_container",
]);

export function splitSections(document: ReportDocument): ReportSections {
  const blocks = { ...document.blocks };
  const assets = { ...document.assets };
  let cloneIndex = 0;

  function cloneWrapper(
    block: NotionBlock,
    content: string[],
    continuation: boolean,
  ): string {
    let id: string;
    do {
      id = `${block.id}--section-${++cloneIndex}`;
    } while (blocks[id]);

    const properties = block.properties ? { ...block.properties } : undefined;
    if (continuation && properties) delete properties.title;
    blocks[id] = { ...block, id, content, properties };
    const icon = assets[`${block.id}:icon`];
    if (icon) assets[`${id}:icon`] = icon;
    return id;
  }

  function splitBlock(id: string, ancestors: Set<string>): BlockSections {
    const block = document.blocks[id];
    if (!block || ancestors.has(id) || ancestors.size >= 50) {
      return { segments: [[id]], hasSeparator: false };
    }
    if (block.type === "divider") {
      return { segments: [[], []], hasSeparator: true };
    }
    if (leafTypes.has(block.type) || !block.content?.length) {
      return { segments: [[id]], hasSeparator: false };
    }

    const nested = splitSequence(
      block.content,
      new Set([...ancestors, block.id]),
    );
    if (!nested.hasSeparator) {
      return { segments: [[id]], hasSeparator: false };
    }

    return {
      hasSeparator: true,
      segments: nested.segments.map((content, index) => {
        const hasOwnContent = index === 0 && !contentOnlyTypes.has(block.type);
        if (!content.length && !hasOwnContent) return [];
        return [cloneWrapper(block, content, index > 0)];
      }),
    };
  }

  function splitSequence(ids: string[], ancestors: Set<string>): BlockSections {
    const segments: string[][] = [[]];
    let hasSeparator = false;
    for (const id of ids) {
      const blockSections = splitBlock(id, ancestors);
      const [first = [], ...following] = blockSections.segments;
      segments[segments.length - 1].push(...first);
      segments.push(...following);
      hasSeparator ||= blockSections.hasSeparator;
    }
    return { segments, hasSeparator };
  }

  const { segments, hasSeparator } = splitSequence(document.rootIds, new Set());
  if (!hasSeparator) {
    return {
      hasSeparator: false,
      coverIds: [],
      bodySections: [document.rootIds],
      document,
    };
  }

  // Each additional adjacent divider requests an empty section; a final
  // divider only closes its preceding section and does not add a last page.
  if (segments[segments.length - 1].length === 0) segments.pop();
  const [coverIds = [], ...bodySections] = segments;
  return {
    hasSeparator: true,
    coverIds,
    bodySections,
    document: {
      ...document,
      blocks,
      assets,
      rootIds: segments.flat(),
      warnings: [...document.warnings],
    },
  };
}
