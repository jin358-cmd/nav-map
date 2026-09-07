#!/usr/bin/env node
/**
 * 經濟部公司／商業登記不得整批當成可導航 POI。
 * 僅能在已有實體店座標時做名稱補充，本腳本預設拒絕匯入。
 */
const report = {
  dataset: "MOEA company / business registration",
  status: "NOT IMPORTED",
  reason: "商業登記資料 ≠ 可導航 POI。缺少門市座標與實際營業點時不得當成店家。",
  imported: 0,
};

console.log(JSON.stringify(report, null, 2));
