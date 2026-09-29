import { fetchNotionPage, NotionError } from "@/lib/notion";
import { InputError, readJsonBody } from "@/lib/request";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await readJsonBody(request);
    if (typeof body.url !== "string" || body.url.length > 2048)
      return Response.json(
        { error: "Enter a valid published Notion link." },
        { status: 400 },
      );
    const document = await fetchNotionPage(body.url);
    return Response.json(
      { document },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof NotionError || error instanceof InputError
            ? error.message
            : "The page could not be parsed. Check the link and try again.",
      },
      {
        status:
          error instanceof NotionError
            ? error.status
            : error instanceof InputError
              ? 400
              : 500,
      },
    );
  }
}
