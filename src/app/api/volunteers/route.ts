import { NextResponse } from "next/server";

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Authorization, Cookie",
};

export async function GET() {
  return NextResponse.json(
    {
      error: "VOLUNTEER_PRIVATE_SOURCE_NOT_CONFIGURED",
      message: "Private volunteer data is unavailable in this synthetic preview.",
    },
    { status: 503, headers: PRIVATE_HEADERS },
  );
}
