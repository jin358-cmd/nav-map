import assert from "node:assert/strict";
import test from "node:test";
import { auditTdxEnvironmentNames } from "./tdx-env-preflight.mjs";

test("missing server-only names block a live probe", () => {
  const r = auditTdxEnvironmentNames(new Set());
  assert.equal(r.status, "BLOCKED_SERVER_NAMES_MISSING");
  assert.equal(r.credentialValuesRead, false);
  assert.equal(r.liveTdxRequestPerformed, false);
});
test("legacy public secret blocks even with server names", () => {
  const r = auditTdxEnvironmentNames(new Set(["TDX_CLIENT_ID", "TDX_CLIENT_SECRET", "NEXT_PUBLIC_TDX_CLIENT_SECRET"]));
  assert.equal(r.status, "BLOCKED_PUBLIC_PREFIX");
  assert.equal(r.legacyPublicSecretNamePresent, true);
});
test("legacy public client ID name blocks", () => {
  const r = auditTdxEnvironmentNames(new Set(["NEXT_PUBLIC_TDX_CLIENT_ID"]));
  assert.equal(r.status, "BLOCKED_PUBLIC_PREFIX");
});
test("server-only names alone do not prove credentials work", () => {
  const r = auditTdxEnvironmentNames(["TDX_CLIENT_ID", "TDX_CLIENT_SECRET"]);
  assert.equal(r.status, "NAMES_PRESENT_VALUES_UNVERIFIED");
  assert.equal(r.credentialValuesRead, false);
  assert.equal(r.liveTdxRequestPerformed, false);
});
