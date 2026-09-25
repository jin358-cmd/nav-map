import assert from "node:assert/strict";
import {
  SOUTH_REGIONS,
  deduplicate,
  normalizeParkingRow,
  validateParkingRow,
} from "./tdx-import-shared.mjs";

assert.deepEqual(SOUTH_REGIONS.map(([id]) => id), [
  "YunlinCounty",
  "ChiayiCounty",
  "Chiayi",
  "Tainan",
  "Kaohsiung",
  "PingtungCounty",
]);

const valid = {
  CarParkID: "TN-001",
  CarParkName: { Zh_tw: "南區測試停車場" },
  Address: "臺南市中西區",
  CarParkPosition: { PositionLat: 22.99, PositionLon: 120.2 },
  TotalSpaces: 100,
  UpdateTime: "2026-09-25T10:00:00+08:00",
};
const checked = validateParkingRow(valid);
assert.equal(checked.errors.length, 0);
assert.equal(checked.withinTaiwan, true);

const normalized = normalizeParkingRow(valid, {
  region: "Tainan",
  city: "臺南市",
  fetchedAt: "2026-09-25T02:01:00.000Z",
  sourceVersion: "test",
});
assert.equal(normalized.normalization_status, "accepted");
assert.equal(normalized.normalized_data.total_spaces, 100);

const rejected = normalizeParkingRow({ CarParkID: "bad", CarParkName: "bad" }, {
  region: "Tainan",
  city: "臺南市",
  fetchedAt: "2026-09-25T02:01:00.000Z",
  sourceVersion: "test",
});
assert.equal(rejected.normalization_status, "rejected");
assert.ok(rejected.validation_errors.includes("invalid_coordinate"));

const unique = deduplicate([normalized, normalized]);
assert.equal(unique.records.length, 1);
assert.equal(unique.duplicates, 1);

console.log("TDX Phase 1 self-test passed");
