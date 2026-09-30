import { access, readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getInstalledBrowsers } from "@puppeteer/browsers";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { renderDocumentHtml } from "./render/html";
import { paperGeometry, type ReportSettings } from "./settings";
import type { ReportDocument } from "./types";

export class BrowserUnavailableError extends Error {}

async function localChromium(): Promise<string> {
  if (process.env.CHROMIUM_EXECUTABLE_PATH)
    return process.env.CHROMIUM_EXECUTABLE_PATH;
  const installed = await getInstalledBrowsers({
    cacheDir: path.join(process.cwd(), ".cache/chromium"),
  });
  if (installed.length) return installed[installed.length - 1].executablePath;
  const candidates =
    process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ]
      : process.platform === "win32"
        ? ["C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"]
        : [
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/google-chrome",
          ];
  if (process.platform === "darwin") {
    const cache = path.join(os.homedir(), "Library/Caches/ms-playwright");
    const versions = await readdir(cache).catch(() => []);
    for (const version of versions
      .filter((item) => item.startsWith("chromium_headless_shell-"))
      .sort()
      .reverse()) {
      candidates.push(
        path.join(
          cache,
          version,
          `chrome-headless-shell-mac-${process.arch === "arm64" ? "arm64" : "x64"}`,
          "chrome-headless-shell",
        ),
      );
    }
  }
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      /* Try the next installed browser. */
    }
  }
  throw new BrowserUnavailableError(
    "Chromium is not installed. Run npm run setup:browser, or set CHROMIUM_EXECUTABLE_PATH.",
  );
}

export async function renderPdf(
  report: ReportDocument,
  settings: ReportSettings,
): Promise<Uint8Array> {
  const html = await renderDocumentHtml(report, settings);
  const serverless = Boolean(
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
  );
  chromium.setGraphicsMode = false;
  const browser = await puppeteer.launch({
    executablePath: serverless
      ? await chromium.executablePath()
      : await localChromium(),
    args: serverless
      ? chromium.args
      : process.env.CHROMIUM_NO_SANDBOX === "1"
        ? ["--no-sandbox"]
        : [],
    headless: "shell",
    defaultViewport: { width: 1200, height: 1000 },
    timeout: 25_000,
  });
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      if (request.url().startsWith("data:") || request.url() === "about:blank")
        void request.continue();
      else void request.abort();
    });
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "load", timeout: 20_000 });
    const { height, margin } = paperGeometry(settings);
    await page.evaluate(
      async (availableHeight) => {
        // Chromium does not wait for fonts used only in @page margin boxes.
        await document.fonts.load('9pt "Report Sans"');
        await document.fonts.ready;
        await Promise.all(
          Array.from(document.images).map((image) =>
            image.decode().catch(() => undefined),
          ),
        );
        const cover = document.querySelector<HTMLElement>(
          ".report-cover-content",
        );
        if (cover && cover.scrollHeight > availableHeight)
          cover.style.zoom = String((availableHeight - 2) / cover.scrollHeight);
        for (const callout of document.querySelectorAll<HTMLElement>(
          ".report-callout",
        )) {
          if (callout.scrollHeight > availableHeight)
            callout.style.zoom = String(
              (availableHeight - 2) / callout.scrollHeight,
            );
        }
        if (
          Array.from(document.images).some(
            (image) => !image.complete || image.naturalWidth === 0,
          )
        )
          throw new Error("An embedded image failed to decode.");
      },
      (height - margin * 2) * 96,
    );
    return await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      displayHeaderFooter: false,
      tagged: true,
      timeout: 25_000,
    });
  } finally {
    await browser.close();
  }
}
