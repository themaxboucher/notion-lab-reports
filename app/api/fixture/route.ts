import { loadFixture } from "@/lib/fixture";

export const runtime = "nodejs";

export async function GET() {
  return Response.json(
    { document: await loadFixture() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
