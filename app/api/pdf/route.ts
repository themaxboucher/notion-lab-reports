import { BrowserUnavailableError, renderPdf } from "@/lib/pdf";
import { InputError, readJsonBody, validateDocument } from "@/lib/request";
import { safeFilename, validateSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const maxDuration = 60;
let activeRenders = 0;

export async function POST(request: Request) {
  if (activeRenders >= 2)
    return Response.json(
      { error: "The renderer is busy. Please try again in a moment." },
      { status: 429, headers: { "Retry-After": "3" } },
    );
  activeRenders++;
  try {
    const body = await readJsonBody(request);
    const document = validateDocument(body.document);
    const settings = validateSettings(body.settings);
    const pdf = await renderPdf(document, settings);
    if (pdf.byteLength > 4_000_000)
      throw new InputError(
        "The PDF is too large for export. Reduce the size or number of images.",
      );
    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeFilename(settings.filename || document.title))}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      "PDF render failed:",
      error instanceof Error ? error.message : "Unknown failure",
    );
    return Response.json(
      {
        error:
          error instanceof InputError ||
          error instanceof BrowserUnavailableError
            ? error.message
            : "The PDF could not be rendered. Try again, or check that Chromium is installed on the server.",
      },
      { status: error instanceof InputError ? 400 : 500 },
    );
  } finally {
    activeRenders--;
  }
}
