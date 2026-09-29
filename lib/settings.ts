export interface ReportSettings {
  paper: "letter" | "a4";
  margins: "narrow" | "normal" | "wide";
  font: "serif" | "sans" | "system";
  fontSize: number;
  lineHeight: number;
  headingColor: string;
  h1PageBreak: boolean;
  pageNumbers: boolean;
  pageNumberPosition: "center" | "right";
  runningHeader: string;
  calloutColors: "notion" | "grayscale";
  codeTheme: "light" | "grayscale";
  generatedCover: boolean;
  filename: string;
}

export const defaultSettings: ReportSettings = {
  paper: "letter",
  margins: "normal",
  font: "serif",
  fontSize: 11,
  lineHeight: 1.55,
  headingColor: "#000000",
  h1PageBreak: false,
  pageNumbers: true,
  pageNumberPosition: "center",
  runningHeader: "",
  calloutColors: "notion",
  codeTheme: "light",
  generatedCover: false,
  filename: "",
};

export function validateSettings(input: unknown): ReportSettings {
  const source =
    input && typeof input === "object"
      ? (input as Record<string, unknown>)
      : {};
  const result = { ...defaultSettings };
  const choices = {
    paper: ["letter", "a4"],
    margins: ["narrow", "normal", "wide"],
    font: ["serif", "sans", "system"],
    pageNumberPosition: ["center", "right"],
    calloutColors: ["notion", "grayscale"],
    codeTheme: ["light", "grayscale"],
  };
  for (const [key, allowed] of Object.entries(choices)) {
    const value = source[key];
    if (typeof value === "string" && allowed.includes(value))
      Object.assign(result, { [key]: value });
  }
  for (const key of ["h1PageBreak", "pageNumbers", "generatedCover"] as const) {
    if (typeof source[key] === "boolean") result[key] = source[key];
  }
  if (typeof source.fontSize === "number" && Number.isFinite(source.fontSize))
    result.fontSize = Math.min(13, Math.max(10, source.fontSize));
  if (
    typeof source.lineHeight === "number" &&
    Number.isFinite(source.lineHeight)
  )
    result.lineHeight = Math.min(2, Math.max(1.2, source.lineHeight));
  if (
    typeof source.headingColor === "string" &&
    /^#[0-9a-f]{6}$/i.test(source.headingColor)
  )
    result.headingColor = source.headingColor;
  if (typeof source.runningHeader === "string")
    result.runningHeader = source.runningHeader.slice(0, 100);
  if (typeof source.filename === "string")
    result.filename = source.filename.slice(0, 160);
  return result;
}

export function safeFilename(value: string): string {
  const cleaned = [...value]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join("");
  const name =
    cleaned
      .replace(/\.pdf$/i, "")
      .replace(/[<>:"/\\|?*]/g, "")
      .trim()
      .slice(0, 140) || "Lab report";
  return `${name}.pdf`;
}

export function paperGeometry(settings: ReportSettings) {
  return {
    width: settings.paper === "letter" ? 8.5 : 210 / 25.4,
    height: settings.paper === "letter" ? 11 : 297 / 25.4,
    margin: { narrow: 0.6, normal: 1, wide: 1.25 }[settings.margins],
  };
}
