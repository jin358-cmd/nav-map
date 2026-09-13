import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { normalizeTaiwanAddress } from "../normalizeTaiwanAddress";

const FIXTURE = "fixtures/geocoding/south-address-regression.json";

function main() {
  assert.equal(existsSync(FIXTURE), true, "missing south address fixture");
  const payload = JSON.parse(readFileSync(FIXTURE, "utf8")) as {
    cases: Array<{
      query: string;
      county: string;
      district?: string;
      village?: string;
      neighborhood?: string;
      locality?: string;
      road?: string;
      section?: string;
      lane?: string;
      alley?: string;
      number?: string;
      subNumber?: string;
      attachedNumber?: string;
      hard?: boolean;
    }>;
  };
  assert.ok(payload.cases.length >= 1000, `need 1000 cases, got ${payload.cases.length}`);
  let parseOk = 0;
  let countyOk = 0;
  let hardFail = 0;
  for (const row of payload.cases) {
    const parsed = normalizeTaiwanAddress(row.query);
    const okCounty = parsed.parts.city === row.county || parsed.parts.city.replaceAll("臺", "台") === row.county.replaceAll("臺", "台");
    if (okCounty) countyOk += 1;
    const okNumber = !row.number || parsed.parts.number === row.number;
    const okSub = !row.subNumber || parsed.parts.subNumber === row.subNumber;
    const okAttached = !row.attachedNumber || parsed.parts.attachedNumber === row.attachedNumber;
    const okRoad = !row.road || parsed.parts.road === row.road;
    if (okCounty && okNumber && okSub && okAttached && okRoad) parseOk += 1;
    else if (row.hard) hardFail += 1;
  }
  const top1 = parseOk / payload.cases.length;
  assert.ok(top1 >= 0.95, `parser county/house top1 ${top1}`);
  assert.equal(hardFail, 0, `hard cases failed: ${hardFail}`);
  console.log(
    JSON.stringify({
      ok: true,
      suite: "south-address-regression",
      count: payload.cases.length,
      parseOk,
      countyOk,
      top1: Number(top1.toFixed(4)),
    }),
  );
}

main();
