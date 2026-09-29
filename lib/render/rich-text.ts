import katex from "katex";
import type { ReportDocument, RichText } from "../types";

const notionColors = new Set([
  "gray",
  "brown",
  "orange",
  "yellow",
  "green",
  "teal",
  "blue",
  "purple",
  "pink",
  "red",
]);

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export function plainText(value: RichText | undefined): string {
  return (value ?? []).map((segment) => segment[0]).join("");
}

export function safeUrl(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    [...value].some((character) => character.charCodeAt(0) < 32)
  ) {
    return undefined;
  }
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function colorClass(value: unknown): string {
  if (typeof value !== "string") return "";
  const color = value.replace(/_background$/, "");
  return notionColors.has(color) ? ` report-color-${value}` : "";
}

export function renderEquation(
  expression: string,
  displayMode = false,
): string {
  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
      trust: false,
      strict: "ignore",
      maxExpand: 500,
      maxSize: 20,
      output: "htmlAndMathml",
    });
  } catch {
    return `<code class="report-equation-fallback">${escapeHtml(expression)}</code>`;
  }
}

function pageLink(id: unknown, document?: ReportDocument): string | undefined {
  if (typeof id !== "string" || !/^[a-f\d-]{32,36}$/i.test(id)) {
    return undefined;
  }
  if (document?.blocks[id]) return `#block-${id}`;
  return `https://www.notion.so/${id.replaceAll("-", "")}`;
}

export function renderRichText(
  value: RichText | undefined,
  document?: ReportDocument,
): string {
  return (value ?? [])
    .map(([text, decorations]) => {
      const equation = decorations?.find(([type]) => type === "e");
      let html =
        equation && typeof equation[1] === "string"
          ? renderEquation(equation[1])
          : escapeHtml(text).replaceAll("\n", "<br>");
      let link: string | undefined;

      for (const [type, argument] of decorations ?? []) {
        switch (type) {
          case "b":
            html = `<strong>${html}</strong>`;
            break;
          case "i":
            html = `<em>${html}</em>`;
            break;
          case "_":
            html = `<u>${html}</u>`;
            break;
          case "s":
            html = `<s>${html}</s>`;
            break;
          case "c":
            html = `<code class="report-inline-code">${html}</code>`;
            break;
          case "h": {
            const className = colorClass(argument).trim();
            if (className) html = `<span class="${className}">${html}</span>`;
            break;
          }
          case "a":
          case "lm":
            link = safeUrl(argument);
            break;
          case "p": {
            link = pageLink(argument, document);
            const referenced =
              typeof argument === "string"
                ? document?.blocks[argument]
                : undefined;
            if (referenced && (text === "‣" || !text.trim())) {
              html = escapeHtml(
                plainText(referenced.properties?.title) || "Untitled page",
              );
            }
            break;
          }
          case "‣":
            if (Array.isArray(argument)) {
              link =
                argument[0] === "p"
                  ? pageLink(argument[1], document)
                  : safeUrl(argument[1]);
            }
            break;
          case "d":
            if (
              argument &&
              typeof argument === "object" &&
              "start_date" in argument
            ) {
              const date = argument as {
                start_date?: unknown;
                end_date?: unknown;
              };
              if (typeof date.start_date === "string") {
                const range =
                  typeof date.end_date === "string"
                    ? ` – ${date.end_date}`
                    : "";
                html = escapeHtml(`${date.start_date}${range}`);
              }
            }
            break;
        }
      }

      return link
        ? `<a href="${escapeHtml(link)}" rel="noreferrer">${html}</a>`
        : html;
    })
    .join("");
}
