import assert from "node:assert/strict";
import { hasCountyBox, validateAdminPoint } from "../admin-boxes";

function testAllCountiesHaveBoxes() {
  const counties = [
    "臺北市",
    "新北市",
    "桃園市",
    "臺中市",
    "臺南市",
    "高雄市",
    "基隆市",
    "新竹市",
    "新竹縣",
    "苗栗縣",
    "彰化縣",
    "南投縣",
    "雲林縣",
    "嘉義市",
    "嘉義縣",
    "屏東縣",
    "宜蘭縣",
    "花蓮縣",
    "臺東縣",
    "澎湖縣",
    "金門縣",
    "連江縣",
  ];
  for (const county of counties) {
    assert.equal(hasCountyBox(county), true, county);
  }
}

function testTaipeiOkKaohsiungMismatch() {
  assert.equal(validateAdminPoint("臺北市", "中正區", 25.04, 121.51).region, "ok");
  assert.equal(validateAdminPoint("臺北市", "中正區", 22.59, 120.31).region, "mismatch");
  assert.equal(validateAdminPoint("臺南市", "中西區", 22.99, 120.2).districtInside, true);
}

testAllCountiesHaveBoxes();
testTaipeiOkKaohsiungMismatch();
console.log(JSON.stringify({ ok: true, suite: "admin-boxes", tests: 2 }));
