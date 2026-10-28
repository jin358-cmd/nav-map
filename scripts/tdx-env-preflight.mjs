import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

/** EIPP: inspect environment variable NAMES ONLY, never credential values. */
export function auditTdxEnvironmentNames(names) {
  const present = names instanceof Set ? names : new Set(names);
  const serverId = present.has("TDX_CLIENT_ID");
  const serverSecret = present.has("TDX_CLIENT_SECRET");
  const legacyId = present.has("NEXT_PUBLIC_TDX_CLIENT_ID");
  const legacySecret = present.has("NEXT_PUBLIC_TDX_CLIENT_SECRET");
  const status =
    legacyId || legacySecret
      ? "BLOCKED_PUBLIC_PREFIX"
      : !serverId || !serverSecret
        ? "BLOCKED_SERVER_NAMES_MISSING"
        : "NAMES_PRESENT_VALUES_UNVERIFIED";
  return {
    status,
    serverIdNamePresent: serverId,
    serverSecretNamePresent: serverSecret,
    legacyPublicIdNamePresent: legacyId,
    legacyPublicSecretNamePresent: legacySecret,
    credentialValuesRead: false,
    liveTdxRequestPerformed: false,
  };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const report = auditTdxEnvironmentNames(Object.keys(process.env));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "NAMES_PRESENT_VALUES_UNVERIFIED") process.exitCode = 2;
}
