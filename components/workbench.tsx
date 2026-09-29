"use client";

import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  FileText,
  Info,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  defaultSettings,
  type ReportSettings,
  safeFilename,
} from "@/lib/settings";
import type { ReportDocument } from "@/lib/types";
import { LabLogo } from "./lab-logo";
import { PdfPreview } from "./pdf-preview";
import { useReport } from "./report-provider";
import { ThemeToggle } from "./theme-toggle";

function Setting({
  label,
  children,
  htmlFor,
}: {
  label: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="setting">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="switch-field">
      <span>{label}</span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch-track" aria-hidden="true" />
    </label>
  );
}

export function Workbench({ source }: { source: string }) {
  const { report, setReport, settings, setSettings } = useReport();
  const [loadError, setLoadError] = useState("");
  const [renderError, setRenderError] = useState("");
  const [busy, setBusy] = useState(true);
  const [pdf, setPdf] = useState<{ blob: Blob; key: string } | null>(null);
  const [pages, setPages] = useState(0);
  const [zoom, setZoom] = useState("fit");
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const queue = useRef(Promise.resolve());
  const activeSource = useRef("");
  const readyDocument =
    report &&
    (source === "fixture"
      ? report.sourceUrl === "fixture:lab-report"
      : report.sourceUrl === source)
      ? report
      : null;
  const renderingSettings = { ...settings, filename: "" };
  const renderKey = JSON.stringify({
    id: readyDocument?.id,
    settings: renderingSettings,
    retry,
  });
  const hasSeparator = readyDocument
    ? Object.values(readyDocument.blocks).some(
        (block) => block.type === "divider",
      )
    : false;
  const hasCover = hasSeparator || settings.generatedCover;

  useEffect(() => {
    if (readyDocument || activeSource.current === source) return;
    activeSource.current = source;
    const controller = new AbortController();
    async function load() {
      const response = await fetch(
        source === "fixture" ? "/api/fixture" : "/api/parse",
        source === "fixture"
          ? { signal: controller.signal }
          : {
              method: "POST",
              signal: controller.signal,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url: source }),
            },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The page could not be loaded.");
      setReport(data.document as ReportDocument);
    }
    void load().catch((error) => {
      if (error.name !== "AbortError") setLoadError(error.message);
    });
    return () => {
      controller.abort();
      activeSource.current = "";
    };
  }, [source, readyDocument, setReport]);

  useEffect(() => {
    if (!readyDocument) return;
    const current = ++generation.current;
    setBusy(true);
    setRenderError("");
    const timer = setTimeout(() => {
      queue.current = queue.current
        .catch(() => undefined)
        .then(async () => {
          if (current !== generation.current) return;
          try {
            const response = await fetch("/api/pdf", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                document: readyDocument,
                settings: JSON.parse(renderKey).settings,
              }),
            });
            if (!response.ok) {
              const data = await response.json();
              throw new Error(data.error || "The PDF could not be rendered.");
            }
            const blob = await response.blob();
            if (current === generation.current)
              setPdf({ blob, key: renderKey });
          } catch (error) {
            if (current === generation.current)
              setRenderError(
                error instanceof Error
                  ? error.message
                  : "The PDF could not be rendered.",
              );
          } finally {
            if (current === generation.current) setBusy(false);
          }
        });
    }, 400);
    return () => {
      clearTimeout(timer);
      generation.current++;
    };
  }, [readyDocument, renderKey]);

  const update = <K extends keyof ReportSettings>(
    key: K,
    value: ReportSettings[K],
  ) => setSettings((previous) => ({ ...previous, [key]: value }));
  const onPageCount = useCallback((count: number) => setPages(count), []);
  const onPreviewError = useCallback(
    (message: string) => setRenderError(message),
    [],
  );
  function download() {
    if (!pdf || pdf.key !== renderKey || busy) return;
    const url = URL.createObjectURL(pdf.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = safeFilename(
      settings.filename || readyDocument?.title || "Lab report",
    );
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
  if (loadError)
    return (
      <main className="empty-state">
        <FileText size={32} />
        <h1>This page couldn’t be opened.</h1>
        <p>{loadError}</p>
        <Link href="/" className="primary">
          Try another link
        </Link>
      </main>
    );

  return (
    <div className="workbench">
      <header className="app-header">
        <Link href="/" className="brand">
          <LabLogo className="brand-mark" size={38} />
          Notion Lab Reports
        </Link>
        <div className="header-right">
          <span className="header-caption">Your notes. Ready to submit.</span>
          <ThemeToggle />
        </div>
      </header>
      <div className="workbench-content">
        <aside className="settings-panel" aria-label="Report settings">
          <div className="sidebar-actions">
            <Link href="/" className="back-link">
              <ArrowLeft size={14} /> Back
            </Link>
            <button
              type="button"
              className="primary export-button"
              disabled={
                busy || !pdf || pdf.key !== renderKey || Boolean(renderError)
              }
              onClick={download}
            >
              <Download size={16} />
              Export PDF
            </button>
            <p className="export-note">
              {busy
                ? "Updating your preview…"
                : "Exports exactly what you see."}
            </p>
          </div>
          <div className="settings-scroll">
            <div className="settings-title">
              <h1>Report settings</h1>
              <button
                type="button"
                className="icon-button"
                title="Reset settings"
                aria-label="Reset settings"
                onClick={() =>
                  setSettings({
                    ...defaultSettings,
                    filename: readyDocument?.title ?? "",
                  })
                }
              >
                <RotateCcw size={14} />
              </button>
            </div>
            {readyDocument && !hasSeparator && (
              <div className="sidebar-notice">
                <Info size={16} />
                <div>
                  No separator found — the whole document will be treated as
                  body content.
                  <Switch
                    label="Use title as cover"
                    checked={settings.generatedCover}
                    onChange={(value) => update("generatedCover", value)}
                  />
                </div>
              </div>
            )}
            <section className="settings-group">
              <h2>Page layout</h2>
              <Setting label="Paper size" htmlFor="paper">
                <div className="select-wrap">
                  <select
                    id="paper"
                    value={settings.paper}
                    onChange={(event) =>
                      update(
                        "paper",
                        event.target.value as ReportSettings["paper"],
                      )
                    }
                  >
                    <option value="letter">Letter · 8.5 × 11 in</option>
                    <option value="a4">A4 · 210 × 297 mm</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </Setting>
              <fieldset className="setting margin-field">
                <legend>Margins</legend>
                <div className="segmented">
                  {(["narrow", "normal", "wide"] as const).map((margin) => (
                    <label
                      key={margin}
                      className={settings.margins === margin ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="margins"
                        value={margin}
                        checked={settings.margins === margin}
                        onChange={() => update("margins", margin)}
                      />
                      <span>{margin[0].toUpperCase() + margin.slice(1)}</span>
                    </label>
                  ))}
                </div>
                <p className="field-hint">
                  {settings.margins === "normal"
                    ? "1 inch on every side"
                    : settings.margins === "narrow"
                      ? "0.6 inch on every side"
                      : "1.25 inches on every side"}
                </p>
              </fieldset>
            </section>
            <section className="settings-group">
              <h2>Typography</h2>
              <Setting label="Body font" htmlFor="font">
                <div className="select-wrap">
                  <select
                    id="font"
                    value={settings.font}
                    onChange={(event) =>
                      update(
                        "font",
                        event.target.value as ReportSettings["font"],
                      )
                    }
                  >
                    <option value="serif">Source Serif · Serif</option>
                    <option value="sans">Inter · Sans serif</option>
                    <option value="system">System · Arial / Helvetica</option>
                  </select>
                  <ChevronDown size={14} />
                </div>
              </Setting>
              <div className="field-grid">
                <Setting label="Font size" htmlFor="font-size">
                  <div className="number-field">
                    <input
                      id="font-size"
                      type="number"
                      min="10"
                      max="13"
                      step="0.5"
                      value={settings.fontSize}
                      onChange={(event) => {
                        const value = event.target.valueAsNumber;
                        if (value >= 10 && value <= 13)
                          update("fontSize", value);
                      }}
                    />
                    <span>pt</span>
                  </div>
                </Setting>
                <Setting label="Line height" htmlFor="line-height">
                  <select
                    id="line-height"
                    value={settings.lineHeight}
                    onChange={(event) =>
                      update("lineHeight", Number(event.target.value))
                    }
                  >
                    <option value="1.2">1.2</option>
                    <option value="1.4">1.4</option>
                    <option value="1.55">1.55</option>
                    <option value="1.7">1.7</option>
                    <option value="2">2.0</option>
                  </select>
                </Setting>
              </div>
              <Setting label="Heading colour" htmlFor="heading-color">
                <div className="color-field">
                  <input
                    id="heading-color"
                    type="color"
                    value={settings.headingColor}
                    onChange={(event) =>
                      update("headingColor", event.target.value)
                    }
                  />
                  <span>{settings.headingColor.toUpperCase()}</span>
                  <span className="muted">Accent</span>
                </div>
              </Setting>
              <Switch
                label="Start H1s on a new page"
                checked={settings.h1PageBreak}
                onChange={(value) => update("h1PageBreak", value)}
              />
            </section>
            <section className="settings-group">
              <h2>Headers & numbering</h2>
              <Switch
                label="Page numbers"
                checked={settings.pageNumbers}
                onChange={(value) => update("pageNumbers", value)}
              />
              {settings.pageNumbers && (
                <Setting label="Number position" htmlFor="page-number">
                  <select
                    id="page-number"
                    value={settings.pageNumberPosition}
                    onChange={(event) =>
                      update(
                        "pageNumberPosition",
                        event.target
                          .value as ReportSettings["pageNumberPosition"],
                      )
                    }
                  >
                    <option value="center">Bottom centre</option>
                    <option value="right">Bottom right</option>
                  </select>
                </Setting>
              )}
              <Setting label="Running header" htmlFor="running-header">
                <input
                  id="running-header"
                  placeholder="e.g. ENSF 462 — Lab 3"
                  maxLength={100}
                  value={settings.runningHeader}
                  onChange={(event) =>
                    update("runningHeader", event.target.value)
                  }
                />
                <p className="field-hint">
                  Body pages only. The cover stays clean.
                </p>
              </Setting>
            </section>
            <section className="settings-group">
              <h2>Content style</h2>
              <Setting label="Callout colours" htmlFor="callouts">
                <select
                  id="callouts"
                  value={settings.calloutColors}
                  onChange={(event) =>
                    update(
                      "calloutColors",
                      event.target.value as ReportSettings["calloutColors"],
                    )
                  }
                >
                  <option value="notion">Keep Notion colours</option>
                  <option value="grayscale">Grayscale</option>
                </select>
              </Setting>
              <Setting label="Code theme" htmlFor="code-theme">
                <select
                  id="code-theme"
                  value={settings.codeTheme}
                  onChange={(event) =>
                    update(
                      "codeTheme",
                      event.target.value as ReportSettings["codeTheme"],
                    )
                  }
                >
                  <option value="light">Light · Syntax highlighting</option>
                  <option value="grayscale">Grayscale</option>
                </select>
              </Setting>
            </section>
            <section className="settings-group">
              <h2>Export</h2>
              <Setting label="File name" htmlFor="filename">
                <input
                  id="filename"
                  value={settings.filename}
                  maxLength={140}
                  onChange={(event) => update("filename", event.target.value)}
                />
                <p className="field-hint">.pdf is added automatically</p>
              </Setting>
            </section>
            {readyDocument && readyDocument.warnings.length > 0 && (
              <details className="warnings">
                <summary>
                  {readyDocument.warnings.length} content notices
                </summary>
                <ul>
                  {readyDocument.warnings.map((warning) => (
                    <li key={`${warning.blockId}-${warning.type}`}>
                      {warning.message}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <p className="sidebar-footnote">No account. No saved documents.</p>
          </div>
        </aside>
        <main className="preview-panel" aria-label="PDF preview">
          <div className="preview-toolbar">
            <div className="preview-title">
              <FileText size={16} />
              <span title={readyDocument?.title}>
                {readyDocument?.title ?? "Opening your page…"}
              </span>
            </div>
            <label className="zoom-control">
              <span className="sr-only">Preview zoom</span>
              <select
                value={zoom}
                onChange={(event) => setZoom(event.target.value)}
              >
                <option value="fit">Fit to width</option>
                <option value="0.75">75%</option>
                <option value="1">100%</option>
                <option value="1.25">125%</option>
              </select>
            </label>
          </div>
          <div className="preview-status" aria-live="polite">
            <span>
              {pages ? `${pages} pages` : "Preparing pages"}{" "}
              <span className="status-dot">·</span>{" "}
              {settings.paper === "letter" ? "US Letter" : "A4"}
              {hasCover && (
                <>
                  {" "}
                  <span className="status-dot">·</span> Includes cover
                </>
              )}
            </span>
            <span className="render-status">
              {busy ? (
                <>
                  <LoaderCircle size={13} className="spin" /> Updating
                </>
              ) : renderError ? (
                "Preview needs attention"
              ) : (
                <>
                  <Check size={13} /> Preview up to date
                </>
              )}
            </span>
          </div>
          {renderError && (
            <div className="preview-error" role="alert">
              <Info size={17} />
              <p>{renderError}</p>
              <button
                type="button"
                className="text-button"
                onClick={() => setRetry((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          )}
          <div className="preview-scroll" aria-busy={busy}>
            {pdf ? (
              <PdfPreview
                blob={pdf.blob}
                hasCover={hasCover}
                zoom={zoom}
                onPageCount={onPageCount}
                onError={onPreviewError}
              />
            ) : (
              <div className="preview-loading">
                <LoaderCircle className="spin" size={24} />
                <h2>
                  {readyDocument
                    ? "Laying out your report"
                    : "Reading your Notion page"}
                </h2>
                <p>Fonts, figures, and page breaks — all in place.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
