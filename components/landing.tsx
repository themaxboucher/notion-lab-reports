"use client";

import {
  ArrowRight,
  FileText,
  Info,
  Link as LinkIcon,
  LoaderCircle,
  Scissors,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useReport } from "./report-provider";
import { ThemeToggle } from "./theme-toggle";

export function Landing() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { setReport } = useReport();
  const router = useRouter();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function parse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    let source: URL;
    try {
      source = new URL(url.trim());
      if (
        source.protocol !== "https:" ||
        !["notion.site", "notion.so", "notion.com"].some(
          (domain) =>
            source.hostname === domain ||
            source.hostname.endsWith(`.${domain}`),
        ) ||
        source.username ||
        source.password ||
        source.port
      )
        throw new Error("Invalid Notion URL");
    } catch {
      setError(
        "Enter a published Notion link starting with https://, such as your-workspace.notion.site/page-id.",
      );
      return;
    }
    setBusy(true);
    pending.current?.abort();
    pending.current = new AbortController();
    try {
      const response = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: source.href }),
        signal: pending.current.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "The page could not be read. Please try again.",
        );
      setReport(data.document);
      router.push(`/settings?source=${encodeURIComponent(source.href)}`);
    } catch (reason) {
      if (reason instanceof Error && reason.name !== "AbortError")
        setError(
          reason.message === "Failed to fetch"
            ? "We couldn’t reach the server. Check your connection and try again."
            : reason.message,
        );
      setBusy(false);
    }
  }

  return (
    <div className="landing">
      <header className="app-header landing-header">
        <Link href="/" className="brand">
          <span className="brand-mark">n</span>Notion Labs
        </Link>
        <ThemeToggle />
      </header>
      <main className="landing-main">
        <div className="landing-card">
          <div className="document-symbol">
            <FileText size={29} strokeWidth={1.4} />
          </div>
          <h1>
            Your lab report,
            <br />
            ready to submit.
          </h1>
          <p className="landing-description">
            Turn a published Notion page into a polished PDF, with a cover page
            and formatting that’s yours.
          </p>
          <form onSubmit={parse} noValidate>
            <label htmlFor="notion-url">Published Notion page</label>
            <div className={`url-field ${error ? "has-error" : ""}`}>
              <LinkIcon size={17} />
              <input
                id="notion-url"
                name="url"
                type="url"
                autoComplete="url"
                placeholder="https://your-workspace.notion.site/…"
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (error) setError("");
                }}
                maxLength={2048}
                disabled={busy}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "parse-error" : "publish-hint"}
              />
              <button className="primary" type="submit" disabled={busy}>
                {busy ? (
                  <>
                    <LoaderCircle size={16} className="spin" />
                    Parsing
                  </>
                ) : (
                  <>
                    Parse
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
            {error && (
              <div id="parse-error" className="parse-error" role="alert">
                <Info size={15} />
                <p>{error}</p>
              </div>
            )}
            <p id="publish-hint" className="publish-hint">
              In Notion: <span>Share → Publish → Publish to web</span>
            </p>
            <p className="parse-status" aria-live="polite">
              {busy ? "Reading your page and embedding its images…" : ""}
            </p>
          </form>
          <div className="separator-tip">
            <Scissors size={17} strokeWidth={1.5} />
            <div>
              <h2>A divider is a fresh page.</h2>
              <p>
                Put your cover content before the first divider. Each divider
                after that starts a new page.
              </p>
            </div>
          </div>
          <Link href="/settings?source=fixture" className="sample-link">
            Try a sample report <ArrowRight size={13} />
          </Link>
        </div>
        <p className="landing-privacy">
          No account. No API token. No stored documents.
        </p>
      </main>
      <footer className="landing-footer">
        <span>Made for the work behind the report.</span>
        <span>Not affiliated with Notion</span>
      </footer>
    </div>
  );
}
