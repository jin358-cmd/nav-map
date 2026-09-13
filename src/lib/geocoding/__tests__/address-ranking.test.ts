import assert from "node:assert/strict";
import { inferResultGroup, rankAddressResults } from "../address-ranking";
import type { GeocodeResult } from "../types";

function hit(
  partial: Partial<GeocodeResult> & Pick<GeocodeResult, "id" | "label">,
): GeocodeResult {
  return {
    formattedAddress: partial.label,
    latitude: 22.99,
    longitude: 120.2,
    source: "nlsc",
    confidence: 0.7,
    matchKind: "approximate",
    ...partial,
  };
}

function testExactBeatsRoadCenter() {
  const ranked = rankAddressResults(
    [
      hit({
        id: "road",
        label: "臺南市中西區中山路",
        matchKind: "road-center",
        source: "osm",
      }),
      hit({
        id: "house",
        label: "臺南市中西區中山路一段35巷7弄2號",
        matchKind: "exact-house",
        exactHouseNumber: true,
        source: "index",
      }),
    ],
    "臺南市中西區中山路一段35巷7弄2號",
  );
  assert.equal(ranked[0].id, "house");
  assert.equal(ranked[0].exactHouseNumber, true);
  assert.equal(ranked[0].resultGroup, "exact-house");
  assert.equal(ranked[1].exactHouseNumber, false);
}

function testCacheDoesNotWin() {
  const ranked = rankAddressResults(
    [
      hit({
        id: "cache-road",
        label: "臺南市中西區中山路",
        source: "cache",
        matchKind: "road-center",
        confidence: 0.99,
      }),
      hit({
        id: "house",
        label: "臺南市中西區中山路1號",
        matchKind: "exact-house",
        exactHouseNumber: true,
        source: "nlsc",
        confidence: 0.7,
      }),
    ],
    "臺南市中西區中山路1號",
  );
  assert.equal(ranked[0].id, "house");
}

function testWrongCountyExcludedFromExact() {
  const ranked = rankAddressResults(
    [
      hit({
        id: "taipei",
        label: "臺北市中正區中山路1號",
        latitude: 25.04,
        longitude: 121.51,
        matchKind: "exact-house",
        exactHouseNumber: true,
      }),
      hit({
        id: "tainan",
        label: "臺南市中西區中山路1號",
        matchKind: "exact-house",
        exactHouseNumber: true,
      }),
    ],
    "臺南市中西區中山路1號",
  );
  assert.equal(ranked[0].id, "tainan");
  assert.notEqual(ranked.find((row) => row.id === "taipei")?.exactHouseNumber, true);
}

function testNonSouthCountyUsesBox() {
  const ranked = rankAddressResults(
    [
      hit({
        id: "tp",
        label: "臺北市中正區重慶南路一段122號",
        latitude: 25.04,
        longitude: 121.51,
        matchKind: "exact-house",
        exactHouseNumber: true,
      }),
    ],
    "臺北市中正區重慶南路一段122號",
  );
  assert.equal(ranked[0].regionValidation, "ok");
}

function testCountyGeomMismatch() {
  const ranked = rankAddressResults(
    [
      hit({
        id: "wrong",
        label: "高雄市前鎮區中山路1號",
        latitude: 22.59,
        longitude: 120.31,
        matchKind: "exact-house",
        exactHouseNumber: true,
      }),
    ],
    "臺北市中正區中山路1號",
  );
  assert.equal(ranked[0].regionValidation, "mismatch");
  assert.notEqual(ranked[0].exactHouseNumber, true);
}

function testInferMissingGroup() {
  assert.equal(
    inferResultGroup({ exactHouseNumber: true, matchKind: "exact-house" }),
    "exact-house",
  );
  assert.equal(inferResultGroup({ matchKind: "interpolated" }), "interpolated");
  assert.equal(inferResultGroup({ matchKind: "road-center" }), "nearby");
  assert.equal(inferResultGroup({ category: "restaurant" }), "poi");
}

testExactBeatsRoadCenter();
testCacheDoesNotWin();
testWrongCountyExcludedFromExact();
testNonSouthCountyUsesBox();
testCountyGeomMismatch();
testInferMissingGroup();
console.log(JSON.stringify({ ok: true, suite: "address-ranking", tests: 6 }));
