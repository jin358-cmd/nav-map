import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

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

const SECRET_NAME = "NEXT_PUBLIC_TDX_CLIENT_SECRET";
const PUBLIC_ID_NAME = "NEXT_PUBLIC_TDX_CLIENT_ID";

export function auditTdxSourceExposure(root) {
  const hits = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        if (entry === "node_modules" || entry === ".next") continue;
        walk(path);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|jsx)$/.test(entry)) continue;
      const text = readFileSync(path, "utf8");
      if (text.includes(SECRET_NAME) || text.includes(PUBLIC_ID_NAME)) hits.push(path);
    }
  };
  walk(root);
  return { publicPrefixInAppSource: hits.length > 0, files: hits, credentialValuesRead: false };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const report = auditTdxEnvironmentNames(Object.keys(process.env));
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "NAMES_PRESENT_VALUES_UNVERIFIED") process.exitCode = 2;
}
