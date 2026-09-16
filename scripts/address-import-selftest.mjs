#!/usr/bin/env node
import assert from "node:assert/strict";
import {
  EXPECTED_NAVPILOT_REF,
  cloudWriteGate,
  dedupeAddressRows,
  qualityScoreForAccuracy,
  toAddressIndexRow,
} from "./address-import-shared.mjs";

function testDryRunDefault() {
  const gate = cloudWriteGate({
    apply: false,
    allowNlsc: true,
    url: `https://${EXPECTED_NAVPILOT_REF}.supabase.co`,
    serviceKey: "secret",
    expectedRef: EXPECTED_NAVPILOT_REF,
    source: "nlsc-derived",
  });
  assert.equal(gate.ok, false);
  assert.equal(gate.reason, "dry_run");
}

function testNlscSwitch() {
  const blocked = cloudWriteGate({
    apply: true,
    allowNlsc: false,
    url: `https://${EXPECTED_NAVPILOT_REF}.supabase.co`,
    serviceKey: "secret",
    expectedRef: EXPECTED_NAVPILOT_REF,
    source: "nlsc-derived",
  });
  assert.equal(blocked.reason, "nlsc_derived_blocked");
  const allowed = cloudWriteGate({
    apply: true,
    allowNlsc: true,
    url: `https://${EXPECTED_NAVPILOT_REF}.supabase.co`,
    serviceKey: "secret",
    expectedRef: EXPECTED_NAVPILOT_REF,
    source: "nlsc-derived",
  });
  assert.equal(allowed.ok, true);
}

function testRefuseWrongProject() {
  const gvg = cloudWriteGate({
    apply: true,
    allowNlsc: true,
    url: "https://qmptlkgseffmeqnarwnb.supabase.co",
    serviceKey: "secret",
    expectedRef: EXPECTED_NAVPILOT_REF,
  });
  assert.equal(gvg.ok, false);
}

function testRowNeverOfficial() {
  const row = toAddressIndexRow(
    {
      n: "台南市中西區中山路1號",
      d: "臺南市中西區中山路1號",
      lat: 22.99,
      lng: 120.2,
      c: "臺南市",
      t: "中西區",
      r: "中山路",
      s: "",
      h: "1號",
      a: "exact-house",
      k: "臺南市|中西區|中山路||||1|",
    },
    { version: "test", license: "nlsc-derived-beta" },
  );
  assert.equal(row.source, "nlsc-derived");
  assert.equal(row.publish_status, "staging");
  assert.notEqual(row.source, "official");
  assert.equal(qualityScoreForAccuracy("road-center") < qualityScoreForAccuracy("exact-house"), true);
  const centers = toAddressIndexRow(
    {
      n: "台南市中西區中山路",
      d: "臺南市中西區中山路",
      lat: 22.99,
      lng: 120.2,
      c: "臺南市",
      t: "中西區",
      r: "中山路",
      s: "",
      h: "",
      a: "road-center",
      k: "road",
    },
    { version: "test" },
  );
  assert.equal(centers.publish_status, "staging");
  assert.equal(centers.accuracy, "road-center");
}

function testDedupe() {
  const rows = dedupeAddressRows([
    { id: "a", canonical_address_key: "k1" },
    { id: "b", canonical_address_key: "k1" },
    { id: "c", canonical_address_key: "k2" },
  ]);
  assert.equal(rows.length, 2);
}

testDryRunDefault();
testNlscSwitch();
testRefuseWrongProject();
testRowNeverOfficial();
testDedupe();
console.log(JSON.stringify({ ok: true, suite: "address-import", tests: 5 }));
