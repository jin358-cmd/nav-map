import "server-only";

export const runtime = "nodejs";

const OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech";

export async function POST(request: Request) {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return Response.json({ fallback: true, engine: "system" }, { status: 204 });
  }

  let text = "";
  try {
    const body = (await request.json()) as { text?: unknown };
    text = typeof body.text === "string" ? body.text.trim() : "";
  } catch {
    return Response.json({ error: "語音內容無效" }, { status: 400 });
  }

  if (!text || text.length > 180) {
    return Response.json({ error: "語音內容無效" }, { status: 400 });
  }

  try {
    const response = await fetch(OPENAI_TTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini-tts",
        voice: "nova",
        input: text,
        instructions:
          "以台灣國語、沉穩清楚的導航語氣朗讀。語速略快，適合開車聆聽，不要加額外解說。",
      }),
      signal: AbortSignal.timeout(12_000),
    });

    if (!response.ok) {
      const fallback = await fetch(OPENAI_TTS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          voice: "nova",
          input: text,
        }),
        signal: AbortSignal.timeout(12_000),
      });
      if (!fallback.ok) {
        return Response.json({ fallback: true, engine: "system" }, { status: 204 });
      }
      return new Response(fallback.body, {
        headers: {
          "Content-Type": fallback.headers.get("Content-Type") || "audio/mpeg",
          "Cache-Control": "no-store",
        },
      });
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ fallback: true, engine: "system" }, { status: 204 });
  }
}
