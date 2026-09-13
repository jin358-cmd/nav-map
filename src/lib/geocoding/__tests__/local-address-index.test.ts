import assert from "node:assert/strict";
import { searchLocalAddressRows, type LocalAddressRow } from "../local-address-index";

const rows: LocalAddressRow[] = [
  {
    n: "台南市中西區中山路1號",
    d: "臺南市中西區中山路1號",
    lat: 22.992,
    lng: 120.202,
    c: "臺南市",
    t: "中西區",
    r: "中山路",
    h: "1號",
    a: "exact-house",
    k: "tainan-1",
  },
  {
    n: "高雄市前鎮區中山路1號",
    d: "高雄市前鎮區中山路1號",
    lat: 22.59,
    lng: 120.31,
    c: "高雄市",
    t: "前鎮區",
    r: "中山路",
    h: "1號",
    a: "exact-house",
    k: "kh-1",
  },
];

function testCountyFilter() {
  const hits = searchLocalAddressRows(rows, "臺南市中西區中山路1號");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].label, "臺南市中西區中山路1號");
  assert.equal(hits[0].source, "index");
  assert.equal(hits[0].exactHouseNumber, true);
}

function testEmptyQuery() {
  assert.deepEqual(searchLocalAddressRows(rows, "一"), []);
}

testCountyFilter();
testEmptyQuery();
console.log(JSON.stringify({ ok: true, suite: "local-address-index", tests: 2 }));
