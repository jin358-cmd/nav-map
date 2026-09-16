import assert from "node:assert/strict";
import { addressFallbackSearchParams } from "../address-cloud-query";
import { getSupabaseAnonConfig } from "../../supabase/anon";

function testFallbackRequiresPublishedSouthAndCoords() {
  const qs = addressFallbackSearchParams("臺南市中西區中山路1號").toString();
  assert.match(qs, /publish_status=eq\.published/);
  assert.match(decodeURIComponent(qs), /雲林縣/);
  assert.match(decodeURIComponent(qs), /屏東縣/);
  assert.match(qs, /latitude=not\.is\.null/);
  assert.match(qs, /longitude=not\.is\.null/);
  assert.doesNotMatch(qs, /service_role/);
}

function testAnonConfigIgnoresServiceRole() {
  const prev = { ...process.env };
  process.env.SUPABASE_URL = "https://rxzbsthsqlozxgctdoks.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-should-not-be-used";
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.equal(getSupabaseAnonConfig(), null);
  process.env.SUPABASE_ANON_KEY = "anon-public-key";
  const config = getSupabaseAnonConfig();
  assert.ok(config);
  assert.equal(config.anonKey, "anon-public-key");
  assert.equal(config.url, "https://rxzbsthsqlozxgctdoks.supabase.co");
  for (const key of Object.keys(process.env)) {
    if (!(key in prev)) delete process.env[key];
  }
  Object.assign(process.env, prev);
}

testFallbackRequiresPublishedSouthAndCoords();
testAnonConfigIgnoresServiceRole();
console.log(JSON.stringify({ ok: true, suite: "official-index", tests: 2 }));
