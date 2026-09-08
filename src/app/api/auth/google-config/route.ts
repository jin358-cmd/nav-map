import { readGoogleOAuthClientId } from "@/lib/google-oauth-env";

export const dynamic = "force-dynamic";

export function GET() {
  const clientId = readGoogleOAuthClientId();
  return Response.json({
    configured: Boolean(clientId),
    clientId: clientId || null,
  });
}
