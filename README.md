# Notion Labs

Turn a publicly published Notion page into a typeset lab report with a centered cover, real page breaks, and selectable text. Next.js App Router, TypeScript, Tailwind CSS, and Biome. No accounts or database; the report and settings stay in browser memory. The source URL is in the settings page URL, so reloading fetches it again. Reloading resets formatting preferences.

## Setup

Use Node.js 22.19+ (Node 22 LTS recommended).

```sh
npm ci
npm run setup:browser
npm run dev
```

Open [localhost:3000](http://localhost:3000). The browser installer downloads an isolated Chrome Headless Shell to `.cache/chromium`. You can instead set `CHROMIUM_EXECUTABLE_PATH` in `.env.local` to an existing Chromium executable. Desktop Chrome and local Playwright Chromium caches are also detected on macOS. No Notion token is used.

## Publish your Notion page

1. Open the page in Notion and choose **Share → Publish → Publish to web**.
2. Copy its published `https://…notion.site/…` link and paste it into Notion Labs.
3. Click **Parse**, adjust the report settings, and click **Export PDF**.

Public `notion.so` and `notion.com` links also work. Private pages and workspace-only sharing do not. Short links without a page ID are resolved from the published page where possible; if Notion supplies no ID, the app asks for the full published link. Custom domains are not accepted.

## The separator rule

A Notion divider (`---`) is a forced page break and is not printed. Content before the first divider becomes the cover, centered horizontally and vertically. Each following section starts on a fresh page and continues onto more pages when necessary. Nested dividers are processed in source order, preserving their surrounding content.

Without a divider, the entire page is body content. The settings panel displays a notice and lets you generate a cover from the page title. Consecutive dividers intentionally produce an empty section; a trailing divider does not add an extra final page. Cover pages have no running header or page number; body numbering starts at 1.

## Rendering and preview

- `lib/notion.ts` is the only Notion fetching adapter. It uses `notion-client` **8.0.8** without credentials and normalizes both legacy and current nested record-map formats. The package was verified against the public Notion Kit Test Suite on September 28, 2026. Run `npm run verify:notion` to repeat the live check.
- `lib/render/` converts blocks to escaped semantic HTML with Shiki, KaTeX, print styles, and embedded fonts. Downloaded images are checked against public network addresses, resized, and embedded before rendering. Unsupported or unavailable content produces a visible placeholder and a settings notice.
- `lib/pdf.ts` prints that HTML with headless Chromium. External network requests and document scripts are blocked in the PDF browser. Source Serif, Inter, JetBrains Mono, Noto Emoji, and KaTeX fonts are bundled; the System option uses the server's available sans-serif fallback.
- The preview uses **PDF.js to display the actual generated PDF**, including its selectable text layer. Settings changes are debounced and rendered serially. Export downloads the very same in-memory PDF blob, with no second layout pass. That makes page breaks, fonts, and layout match exactly, even when the viewing browser differs from Chromium.
- The PDF always stays light, independently of the light/dark/system UI theme.

For predictable serverless resource use: maximum 1,500 blocks, 30 nesting levels, 8 MB per source image, 2 MB total optimized embedded image bytes, and 4 MB per request/PDF. Image failures are listed explicitly. Very large covers and callouts are scaled to fit one printable page. Very large documents should be split into smaller reports.

## Fixture and checks

`fixtures/lab-report.json` is a self-contained saved Notion record map with 141 blocks: cover, dividers, rich text, nested lists, checkboxes, toggle headings, columns, equations, PNG figures, five callouts, a 61-row table, short and 93-line code listings, bookmarks/link previews, and unsupported blocks. It contains synthetic measurements, not real experimental results.

```sh
npm run fixture          # Regenerate the record map and PNG charts
npm run render:fixture   # output/pdf/lab-report.pdf + matching HTML
npm run test             # Separator, renderer, input, and URL checks
npm run test:pdf         # Chromium + PDF text/page regression checks
npm run check            # Biome lint + formatting
npm run typecheck
npm run build
```

Pass an output path and settings JSON to compare variants:

```sh
npm run render:fixture -- output/pdf/a4.pdf '{"paper":"a4","runningHeader":"ENSF 462 — Lab 3"}'
```

The landing page also links to the sample report. `/api/html?stage=1` shows the unpaginated fixture HTML; `/api/html` shows its print structure.

## Deploy to Vercel

1. Push this project to a Git repository and import it in Vercel with the **Next.js** preset.
2. Select **Node.js 22.x**, use `npm ci` for installation and `npm run build` for the build. `postinstall` copies the pinned PDF.js worker and support files to `public/vendor`.
3. Deploy. Do **not** set a local `CHROMIUM_EXECUTABLE_PATH` on Vercel. The PDF route automatically uses bundled `@sparticuz/chromium` on Vercel's Node runtime. No browser download is needed during the Vercel build.
4. The included configuration sets a 60-second render timeout and 2 GB memory. Ensure your Vercel plan permits these limits. Keep `@sparticuz/chromium` in production dependencies; `next.config.ts` traces its binaries and the embedded fonts.
5. After deployment, open the sample report, change paper size, and export a PDF as a deployment smoke check. The local app is verified separately; deploying to a Vercel account is not part of the local build.

The unofficial Notion endpoint may change or rate-limit requests. To migrate to the official API later, replace the implementation of `fetchNotionPage` while preserving `ReportDocument`; the renderer and UI do not depend on the Notion client.
