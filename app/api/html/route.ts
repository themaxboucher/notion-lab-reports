import { loadFixture } from "@/lib/fixture";
import { renderDocumentHtml } from "@/lib/render/html";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return new Response(
    await renderDocumentHtml(
      await loadFixture(),
      undefined,
      new URL(request.url).searchParams.get("stage") === "1",
    ),
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; frame-ancestors 'self'",
        "Cache-Control": "no-store",
      },
    },
  );
}
