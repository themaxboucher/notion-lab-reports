import { readFile } from "node:fs/promises";
import path from "node:path";

let cachedCss: Promise<string> | undefined;

export function embeddedFontCss(): Promise<string> {
  cachedCss ??= loadFonts();
  return cachedCss;
}

async function loadFonts(): Promise<string> {
  const definitions = [
    ["Report Serif", "source-serif-4", 400, "normal"],
    ["Report Serif", "source-serif-4", 600, "normal"],
    ["Report Serif", "source-serif-4", 700, "normal"],
    ["Report Serif", "source-serif-4", 400, "italic"],
    ["Report Serif", "source-serif-4", 700, "italic"],
    ["Report Sans", "inter", 400, "normal"],
    ["Report Sans", "inter", 600, "normal"],
    ["Report Sans", "inter", 700, "normal"],
    ["Report Sans", "inter", 400, "italic"],
    ["Report Sans", "inter", 700, "italic"],
    ["Report Mono", "jetbrains-mono", 400, "normal"],
  ] as const;
  const fonts = await Promise.all(
    definitions.map(async ([family, pkg, weight, style]) => {
      const bytes = await readFile(
        path.join(
          process.cwd(),
          "node_modules",
          "@fontsource",
          pkg,
          "files",
          `${pkg}-latin-${weight}-${style}.woff2`,
        ),
      );
      return `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};src:url(data:font/woff2;base64,${bytes.toString("base64")}) format("woff2");font-display:block;}`;
    }),
  );
  const katexDirectory = path.join(process.cwd(), "node_modules/katex/dist");
  let katexCss = await readFile(
    path.join(katexDirectory, "katex.min.css"),
    "utf8",
  );
  const urls = [
    ...new Set(
      [...katexCss.matchAll(/url\((fonts\/[^)]+\.woff2)\)/g)].map(
        (match) => match[1],
      ),
    ),
  ];
  for (const url of urls) {
    const bytes = await readFile(path.join(katexDirectory, url));
    katexCss = katexCss.replaceAll(
      `url(${url})`,
      `url(data:font/woff2;base64,${bytes.toString("base64")})`,
    );
  }
  // Keep only the embedded WOFF2 source; the fallbacks would otherwise request relative URLs.
  katexCss = katexCss.replace(
    /,url\(fonts\/[^)]+\) format\("(?:woff|truetype)"\)/g,
    "",
  );
  const emojiDirectory = path.join(
    process.cwd(),
    "node_modules/@fontsource/noto-emoji",
  );
  let emojiCss = await readFile(path.join(emojiDirectory, "400.css"), "utf8");
  const emojiUrls = [
    ...emojiCss.matchAll(/url\(\.\/(files\/[^)]+\.woff2)\)/g),
  ].map((match) => match[1]);
  for (const url of emojiUrls) {
    const bytes = await readFile(path.join(emojiDirectory, url));
    emojiCss = emojiCss.replaceAll(
      `url(./${url})`,
      `url(data:font/woff2;base64,${bytes.toString("base64")})`,
    );
  }
  emojiCss = emojiCss.replace(
    /, url\(\.\/files\/[^)]+\.woff\) format\('woff'\)/g,
    "",
  );
  return fonts.join("\n") + katexCss + emojiCss;
}
