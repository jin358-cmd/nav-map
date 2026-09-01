import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

const ALLOWED = new Set([
  "maplibre-gl-worker.mjs",
  "maplibre-gl-shared.mjs",
]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const { file } = await context.params;
  if (!ALLOWED.has(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const path = join(process.cwd(), "node_modules/maplibre-gl/dist", file);
  const body = await readFile(path);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
