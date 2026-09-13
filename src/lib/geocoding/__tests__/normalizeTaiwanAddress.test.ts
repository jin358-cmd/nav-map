import assert from "node:assert/strict";
import {
  classifyMatchKind,
  normalizeTaiwanAddress,
} from "../normalizeTaiwanAddress";

function testBasicDoorplate() {
  const parsed = normalizeTaiwanAddress("台南市中西區中山路一段35巷7弄2號");
  assert.equal(parsed.parts.city, "臺南市");
  assert.equal(parsed.parts.town, "中西區");
  assert.equal(parsed.parts.road, "中山路");
  assert.equal(parsed.parts.section, "1段");
  assert.equal(parsed.parts.lane, "35巷");
  assert.equal(parsed.parts.alley, "7弄");
  assert.equal(parsed.parts.number, "2");
  assert.equal(parsed.hasHouseNumber, true);
}

function testSubAndAttached() {
  const a = normalizeTaiwanAddress("嘉義縣民雄鄉福樂村中正路12之3號");
  assert.equal(a.parts.number, "12");
  assert.equal(a.parts.subNumber, "3");
  const b = normalizeTaiwanAddress("屏東縣潮州鎮中山路35號附1");
  assert.equal(b.parts.number, "35");
  assert.equal(b.parts.attachedNumber, "1");
  const c = normalizeTaiwanAddress("嘉義縣民雄鄉福樂村中正路12號之3");
  assert.equal(c.parts.number, "12");
  assert.equal(c.parts.subNumber, "3");
  assert.equal(a.canonicalKey.split("|")[9], c.canonicalKey.split("|")[9]);
}

function testRuralNoRoad() {
  const parsed = normalizeTaiwanAddress("雲林縣東勢鄉昌南村12鄰35號");
  assert.equal(parsed.parts.city, "雲林縣");
  assert.equal(parsed.parts.town, "東勢鄉");
  assert.equal(parsed.parts.village, "昌南村");
  assert.equal(parsed.parts.neighborhood, "12鄰");
  assert.equal(parsed.parts.number, "35");
  assert.equal(parsed.hasRoad, false);
}

function testFloorNotInHouse() {
  const parsed = normalizeTaiwanAddress("高雄市前鎮區中山二路100號3樓");
  assert.equal(parsed.parts.number, "100");
  assert.equal(parsed.parts.floor.includes("3"), true);
}

function testDuplicateAdminAndPostal() {
  const parsed = normalizeTaiwanAddress("700臺南市南區臺南市南區中華西路一段1號");
  assert.equal(parsed.parts.city, "臺南市");
  assert.equal(parsed.normalizedAddress.includes("臺南市南區臺南市南區"), false);
}

function testLocality() {
  const parsed = normalizeTaiwanAddress("嘉義縣番路鄉公田村公田庄12之3號");
  assert.equal(parsed.parts.locality, "公田庄");
  assert.equal(parsed.parts.subNumber, "3");
}

function testExactHouseRequiresLane() {
  const query = normalizeTaiwanAddress("臺南市中西區中山路35巷7號");
  assert.equal(
    classifyMatchKind(query, "臺南市中西區中山路7號"),
    "interpolated",
  );
  assert.equal(
    classifyMatchKind(query, "臺南市中西區中山路35巷7號"),
    "exact-house",
  );
}

testBasicDoorplate();
testSubAndAttached();
testRuralNoRoad();
testFloorNotInHouse();
testDuplicateAdminAndPostal();
testLocality();
testExactHouseRequiresLane();
console.log(JSON.stringify({ ok: true, suite: "normalizeTaiwanAddress", tests: 7 }));
