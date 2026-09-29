"use client";

import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  TextLayer as PdfTextLayer,
  RenderTask,
} from "pdfjs-dist";
import { useEffect, useRef, useState } from "react";

function PdfSheet({
  pdf,
  number,
  width,
  hasCover,
}: {
  pdf: PDFDocumentProxy;
  number: number;
  width: number;
  hasCover: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(11 / 8.5);
  const [error, setError] = useState("");
  const isCover = hasCover && number === 1;
  useEffect(() => {
    let stopped = false;
    let task: RenderTask | undefined;
    let layer: PdfTextLayer | undefined;
    let page: PDFPageProxy | undefined;
    async function render() {
      setError("");
      const { TextLayer } = await import("pdfjs-dist");
      page = await pdf.getPage(number);
      if (stopped || !canvas.current || !text.current) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      setRatio(base.height / base.width);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const element = canvas.current;
      element.width = Math.round(viewport.width * pixelRatio);
      element.height = Math.round(viewport.height * pixelRatio);
      element.style.width = `${viewport.width}px`;
      element.style.height = `${viewport.height}px`;
      const context = element.getContext("2d");
      if (!context) return;
      task = page.render({
        canvas: element,
        canvasContext: context,
        viewport,
        transform: [pixelRatio, 0, 0, pixelRatio, 0, 0],
      });
      await task.promise;
      if (stopped || !text.current) return;
      text.current.replaceChildren();
      text.current.style.setProperty(
        "--total-scale-factor",
        String(viewport.scale),
      );
      layer = new TextLayer({
        textContentSource: await page.getTextContent(),
        container: text.current,
        viewport,
      });
      await layer.render();
    }
    void render().catch((reason) => {
      if (!stopped && reason?.name !== "RenderingCancelledException")
        setError("This page could not be displayed.");
    });
    return () => {
      stopped = true;
      task?.cancel();
      layer?.cancel();
    };
  }, [pdf, number, width]);
  return (
    <figure className="pdf-page-group">
      <figcaption className="page-label">
        {isCover ? "Cover page" : `Page ${hasCover ? number - 1 : number}`}
        <span>
          {number} / {pdf.numPages}
        </span>
      </figcaption>
      <div className="pdf-sheet" style={{ width, minHeight: width * ratio }}>
        <canvas
          ref={canvas}
          aria-label={isCover ? "Cover page" : `PDF page ${number}`}
        />
        <div ref={text} className="textLayer" />
        {error && <p className="pdf-page-error">{error}</p>}
      </div>
    </figure>
  );
}

export function PdfPreview({
  blob,
  hasCover,
  zoom,
  onPageCount,
  onError,
}: {
  blob: Blob;
  hasCover: boolean;
  zoom: string;
  onPageCount: (count: number) => void;
  onError: (error: string) => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [availableWidth, setAvailableWidth] = useState(720);
  const [baseWidth, setBaseWidth] = useState(816);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) =>
      setAvailableWidth(Math.max(220, entry.contentRect.width - 56)),
    );
    resize.observe(element);
    return () => resize.disconnect();
  }, []);
  useEffect(() => {
    let stopped = false;
    let task: PDFDocumentLoadingTask | undefined;
    const load = async () => {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdf.worker.min.mjs";
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (stopped) return;
      task = pdfjs.getDocument({
        data: bytes,
        cMapUrl: "/vendor/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/vendor/standard_fonts/",
        wasmUrl: "/vendor/wasm/",
      });
      const document = await task.promise;
      if (stopped) return;
      const first = await document.getPage(1);
      setBaseWidth(first.getViewport({ scale: 96 / 72 }).width);
      setPdf(document);
      onPageCount(document.numPages);
    };
    void load().catch(() => {
      if (!stopped)
        onError("The PDF preview could not be loaded. Try rendering it again.");
    });
    return () => {
      stopped = true;
      if (task) void task.destroy();
    };
  }, [blob, onPageCount, onError]);
  const width =
    zoom === "fit"
      ? Math.min(availableWidth, baseWidth)
      : baseWidth * Number(zoom);
  return (
    <div className="pdf-pages" ref={container}>
      {pdf &&
        Array.from({ length: pdf.numPages }, (_, index) => index + 1).map(
          (number) => (
            <PdfSheet
              key={`${number}-${width}`}
              pdf={pdf}
              number={number}
              width={width}
              hasCover={hasCover}
            />
          ),
        )}
    </div>
  );
}
