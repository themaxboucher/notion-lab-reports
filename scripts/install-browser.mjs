import {
  Browser,
  detectBrowserPlatform,
  install,
  resolveBuildId,
} from "@puppeteer/browsers";

const platform = detectBrowserPlatform();
if (!platform)
  throw new Error("No supported Chromium build exists for this platform.");
const buildId = await resolveBuildId(
  Browser.CHROMEHEADLESSSHELL,
  platform,
  "stable",
);
const installed = await install({
  browser: Browser.CHROMEHEADLESSSHELL,
  buildId,
  platform,
  cacheDir: ".cache/chromium",
});
console.log(`Chromium installed: ${installed.executablePath}`);
