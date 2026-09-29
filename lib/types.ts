export type RichText = [string, [string, ...unknown[]][]?][];

export interface NotionBlock {
  id: string;
  type: string;
  properties?: Record<string, RichText>;
  content?: string[];
  format?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ReportWarning {
  blockId: string;
  type: string;
  message: string;
}

export interface ReportDocument {
  id: string;
  title: string;
  sourceUrl: string;
  blocks: Record<string, NotionBlock>;
  rootIds: string[];
  assets: Record<string, string>;
  warnings: ReportWarning[];
}

export function plainText(value?: RichText): string {
  return value?.map(([text]) => text).join("") ?? "";
}
