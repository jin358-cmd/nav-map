import assert from "node:assert/strict";
import type { Map as MapLibreMap } from "maplibre-gl";
import {
  applyChineseBasemapLabels,
  CHINESE_NAME_TEXT_FIELD,
  shouldRewriteBasemapLabel,
} from "../basemap-labels";

const LIBERTY_NAME = [
  "case",
  ["has", "name:nonlatin"],
  ["concat", ["get", "name:latin"], "\n", ["get", "name:nonlatin"]],
  ["coalesce", ["get", "name_en"], ["get", "name"]],
];

function testCoalesceOrder() {
  assert.deepEqual(CHINESE_NAME_TEXT_FIELD, [
    "coalesce",
    ["get", "name:zh-Hant"],
    ["get", "name:zh-TW"],
    ["get", "name:zh"],
    ["get", "name"],
  ]);
}

function testRewriteRules() {
  assert.equal(shouldRewriteBasemapLabel("label_city", LIBERTY_NAME), true);
  assert.equal(
    shouldRewriteBasemapLabel("highway_name_other", LIBERTY_NAME),
    true,
  );
  assert.equal(
    shouldRewriteBasemapLabel("highway-shield-us", ["to-string", ["get", "ref"]]),
    false,
  );
  assert.equal(
    shouldRewriteBasemapLabel("highway_name_motorway", ["to-string", ["get", "ref"]]),
    false,
  );
  assert.equal(
    shouldRewriteBasemapLabel("parking-layer-label", ["concat", "P", ["get", "label"]]),
    false,
  );
  assert.equal(
    shouldRewriteBasemapLabel("navpilot-poi-label", ["get", "name"]),
    false,
  );
  assert.equal(
    shouldRewriteBasemapLabel("speed-enforcement-label-layer", [
      "to-string",
      ["get", "speedLimit"],
    ]),
    false,
  );
  assert.equal(
    shouldRewriteBasemapLabel("navpilot-turn-arrows-layer", ["get", "name"]),
    false,
  );
  assert.equal(shouldRewriteBasemapLabel("guidance-arrow", ["get", "name"]), false);
}

function testApplySkipsOwnedLayersAndShields() {
  const updates: Array<{ id: string; name: string; value: unknown }> = [];
  const layers = [
    { id: "label_city", type: "symbol" },
    { id: "highway-shield-us", type: "symbol" },
    { id: "water", type: "fill" },
    { id: "navpilot-poi-label", type: "symbol" },
    { id: "parking-layer-label", type: "symbol" },
    { id: "speed-enforcement-label-layer", type: "symbol" },
    { id: "navpilot-turn-line-layer-v3", type: "line" },
  ];
  const fields: Record<string, unknown> = {
    label_city: LIBERTY_NAME,
    "highway-shield-us": ["to-string", ["get", "ref"]],
    "navpilot-poi-label": ["get", "name"],
    "parking-layer-label": ["concat", "P", ["get", "label"]],
    "speed-enforcement-label-layer": ["to-string", ["get", "speedLimit"]],
  };
  const map = {
    getStyle: () => ({ layers }),
    getLayoutProperty: (id: string) => fields[id],
    setLayoutProperty: (id: string, name: string, value: unknown) => {
      updates.push({ id, name, value });
    },
  };
  applyChineseBasemapLabels(map as unknown as MapLibreMap);
  assert.deepEqual(updates, [
    { id: "label_city", name: "text-field", value: CHINESE_NAME_TEXT_FIELD },
    { id: "label_city", name: "text-padding", value: 10 },
  ]);
}

testCoalesceOrder();
testRewriteRules();
testApplySkipsOwnedLayersAndShields();
console.log(JSON.stringify({ ok: true, suite: "basemap-labels", tests: 3 }));
