#!/usr/bin/env node
/**
 * Nationwide OSM Overpass ingest (ODbL). Merges into src/data/taiwan-poi-index.json.
 * Company registries are NOT imported here — see import-company-registry.mjs.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const USER_AGENT = "NavPilot/0.1 (https://github.com/jin358-cmd/nav-map)";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const PHOTON = "https://photon.komoot.io/api/";
const OUT = "src/data/taiwan-poi-index.json";
const CITIES = [
  { county: "臺北市", q: "Taipei" },
  { county: "新北市", q: "New Taipei" },
  { county: "桃園市", q: "Taoyuan" },
  { county: "臺中市", q: "Taichung" },
  { county: "臺南市", q: "Tainan" },
  { county: "高雄市", q: "Kaohsiung" },
];
const BBOX = "21.8,119.3,25.4,122.15";

const BRANDS = [
  { brand: "7-Eleven", category: "convenience", aliases: ["711", "7-11", "統一超商"], overpass: '["brand"="7-Eleven"]' },
  { brand: "FamilyMart", category: "convenience", aliases: ["全家", "全家便利商店"], overpass: '["brand"="FamilyMart"]' },
  { brand: "PX Mart", category: "convenience", aliases: ["全聯", "全聯福利中心"], overpass: '["name"~"全聯"]' },
  { brand: "E-Life", category: "other", aliases: ["全國電子"], overpass: '["name"~"全國電子"]' },
  { brand: "Starbucks", category: "cafe", aliases: ["星巴克"], overpass: '["brand"="Starbucks"]' },
  { brand: "McDonald's", category: "restaurant", aliases: ["麥當勞"], overpass: '["brand"="McDonald\'s"]' },
  { brand: "Hi-Life", category: "convenience", aliases: ["萊爾富"], overpass: '["brand"="Hi-Life"]' },
  { brand: "OK Mart", category: "convenience", aliases: ["OK超商"], overpass: '["name"~"OK超商"]' },
  { brand: "MOS Burger", category: "restaurant", aliases: ["摩斯", "摩斯漢堡"], overpass: '["brand"="MOS Burger"]' },
  { brand: "Louisa", category: "cafe", aliases: ["路易莎"], overpass: '["name"~"路易莎"]' },
];

const LANDMARKS = [
  { name: "臺北車站", aliases: ["台北車站", "台北火車站"], query: '["name"="臺北車站"]["railway"="station"]' },
  { name: "臺南車站", aliases: ["台南車站", "台南火車站"], query: '["name"="臺南車站"]["railway"="station"]' },
  { name: "高雄車站", aliases: ["高雄火車站"], query: '["name"="高雄車站"]["railway"="station"]' },
  { name: "海安路", aliases: ["海安路商圈"], query: '["name"="海安路"]["highway"]' },
];

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("臺", "台")
    .replace(/[\s\-_.＋+]/g, "");
}

function nameFitsBrand(name, brand) {
  if (!brand) return true;
  const n = normalize(name);
  const b = normalize(brand);
  if (!n || !b) return true;
  if (n.includes(b) || (n.length >= 2 && b.includes(n))) return true;
  if (b.includes("7eleven") || b === "711") {
    return /7eleven|統一超商|小七|^711/.test(n) || n.startsWith("7eleven");
  }
  if (b.includes("familymart") || b.includes("全家")) return n.includes("全家") || n.includes("familymart");
  if (b.includes("pxmart") || b.includes("全聯")) return n.includes("全聯") || n.includes("pxmart");
  if (b.includes("starbucks") || b.includes("星巴克")) return n.includes("星巴克") || n.includes("starbucks");
  if (b.includes("mcdonald") || b.includes("麥當勞")) return n.includes("麥當勞") || n.includes("mcdonald");
  if (b.includes("elife") || b.includes("全國電子")) return n.includes("全國電子") || n.includes("elife");
  if (b.includes("hilife") || b.includes("萊爾富")) return n.includes("萊爾富") || n.includes("hilife");
  if (b.includes("okmart") || b.includes("ok超商")) {
    return n.includes("ok超商") || (n.includes("ok") && (n.includes("超商") || n.includes("便利")));
  }
  if (b.includes("mos") || b.includes("摩斯")) return n.includes("摩斯") || n.includes("mos");
  if (b.includes("louisa") || b.includes("路易莎")) return n.includes("路易莎") || n.includes("louisa");
  return false;
}

function inTaiwan(lat, lng) {
  return lng >= 118 && lng <= 123 && lat >= 20 && lat <= 27;
}

function countyFromText(text) {
  const match = String(text ?? "").match(
    /(臺北市|台北市|新北市|桃園市|臺中市|台中市|臺南市|台南市|高雄市|基隆市|新竹市|嘉義市|宜蘭縣|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|花蓮縣|臺東縣|台東縣|澎湖縣|金門縣|連江縣)/,
  );
  return match?.[1]?.replaceAll("台", "臺") ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function centerOf(el) {
  if (Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
    return { lat: Number(el.lat), lng: Number(el.lon) };
  }
  if (el.center && Number.isFinite(el.center.lat)) {
    return { lat: Number(el.center.lat), lng: Number(el.center.lon) };
  }
  return null;
}

function rowFromElement(el, meta) {
  const loc = centerOf(el);
  if (!loc || !inTaiwan(loc.lat, loc.lng)) return null;
  const tags = el.tags ?? {};
  let name = String(tags.name || tags["name:zh"] || meta.brand || meta.name || "").trim();
  if (!name) return null;
  if (meta.brand && !nameFitsBrand(name, meta.brand)) {
    name = `${meta.brand} ${name}`.trim();
  }
  const branch =
    tags.branch ||
    tags["name:branch"] ||
    (name.includes(meta.brand) ? name.replace(meta.brand, "").replace(/^[\s\-_/]+/, "").trim() : "") ||
    null;
  const address = [tags["addr:full"], tags["addr:city"], tags["addr:district"], tags["addr:street"], tags["addr:housenumber"]]
    .filter(Boolean)
    .join("");
  const city = countyFromText(address) || countyFromText(tags["addr:city"]) || countyFromText(tags["addr:province"]);
  return {
    id: `osm-${String(el.type ?? "n")[0].toUpperCase()}-${el.id}`,
    name,
    nameNormalized: normalize(name),
    aliases: meta.aliases ?? [],
    category: meta.category ?? "landmark",
    brand: meta.brand ?? null,
    branchName: branch || null,
    address: address || city || "",
    addressNormalized: normalize(address || city || ""),
    city,
    county: city,
    district: tags["addr:district"] || tags["addr:suburb"] || null,
    latitude: loc.lat,
    longitude: loc.lng,
    source: "osm",
    sourceId: String(el.id),
    updatedAt: new Date().toISOString(),
    license: "ODbL",
    confidence: 0.86,
    isActive: true,
  };
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "zh-TW",
      "User-Agent": USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function searchPhoton(query, meta, county) {
  const url = new URL(PHOTON);
  url.searchParams.set("q", county ? `${query} ${county}` : query);
  url.searchParams.set("limit", "12");
  const payload = await fetchJson(url);
  return (payload.features ?? []).flatMap((feature) => {
    const lng = Number(feature.geometry?.coordinates?.[0]);
    const lat = Number(feature.geometry?.coordinates?.[1]);
    const name = feature.properties?.name || query;
    if (meta.brand && !nameFitsBrand(name, meta.brand)) return [];
    const address = [
      feature.properties?.state,
      feature.properties?.district,
      feature.properties?.street,
      feature.properties?.housenumber,
    ]
      .filter(Boolean)
      .join("");
    const city = countyFromText(address) || meta.county || null;
    return [{
      id: `osm-${feature.properties?.osm_type ?? "n"}-${feature.properties?.osm_id ?? `${lng},${lat}`}`,
      id: `osm-${feature.properties?.osm_type ?? "n"}-${feature.properties?.osm_id ?? `${lng},${lat}`}`,
      name,
      nameNormalized: normalize(name),
      aliases: meta.aliases ?? [],
      category: meta.category,
      brand: meta.brand ?? null,
      branchName: null,
      address: address || city || "",
      addressNormalized: normalize(address || city || ""),
      city,
      county: city,
      district: feature.properties?.district ?? null,
      latitude: lat,
      longitude: lng,
      source: "osm",
      sourceId: String(feature.properties?.osm_id ?? `${lng.toFixed(5)},${lat.toFixed(5)}`),
      updatedAt: new Date().toISOString(),
      license: "ODbL",
      confidence: 0.82,
      isActive: true,
    }];
  });
}

async function overpass(query) {
  const body = `[out:json][timeout:75];(${query});out center tags;`;
  const response = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": USER_AGENT,
    },
    body: `data=${encodeURIComponent(body)}`,
  });
  if (!response.ok) throw new Error(`overpass ${response.status}`);
  const payload = await response.json();
  return Array.isArray(payload.elements) ? payload.elements : [];
}

function loadExisting() {
  if (!existsSync(OUT)) return new Map();
  const rows = JSON.parse(readFileSync(OUT, "utf8"));
  const map = new Map();
  for (const row of rows) {
    const key = `${row.source}:${row.sourceId ?? row.id}`;
    map.set(key, {
      ...row,
      branchName: row.branchName ?? null,
      addressNormalized: row.addressNormalized ?? normalize(row.address ?? ""),
      city: row.city ?? row.county ?? null,
      confidence: row.confidence ?? 0.8,
      isActive: row.isActive !== false,
    });
  }
  return map;
}

async function main() {
  const map = loadExisting();
  let failed = 0;
  for (const brand of BRANDS) {
    process.stdout.write(`overpass ${brand.brand}\n`);
    try {
      const elements = await overpass(`nwr${brand.overpass}(${BBOX})`);
      for (const el of elements) {
        const row = rowFromElement(el, brand);
        if (!row) continue;
        map.set(`${row.source}:${row.sourceId}`, row);
      }
      await sleep(800);
    } catch (error) {
      failed += 1;
      console.error(`skip ${brand.brand}: ${error instanceof Error ? error.message : error}`);
      await sleep(1500);
    }
  }
  for (const place of LANDMARKS) {
    process.stdout.write(`overpass landmark ${place.name}\n`);
    try {
      const elements = await overpass(`nwr${place.query}(${BBOX})`);
      for (const el of elements) {
        const row = rowFromElement(el, {
          brand: null,
          category: "landmark",
          aliases: place.aliases,
          name: place.name,
        });
        if (!row) continue;
        map.set(`${row.source}:${row.sourceId}`, row);
      }
      await sleep(600);
    } catch (error) {
      failed += 1;
      console.error(`skip ${place.name}: ${error instanceof Error ? error.message : error}`);
    }
  }

  const photonJobs = [
    ...BRANDS.map((brand) => ({ q: brand.aliases[0] || brand.brand, ...brand })),
    { q: "海安路", category: "landmark", brand: null, aliases: ["海安路商圈"], county: "臺南市" },
  ];
  for (const city of CITIES) {
    for (const job of photonJobs) {
      process.stdout.write(`photon ${city.county} ${job.q}\n`);
      try {
        const rows = await searchPhoton(job.q, { ...job, county: city.county }, city.q);
        for (const row of rows) {
          if (!inTaiwan(row.latitude, row.longitude)) continue;
          map.set(`${row.source}:${row.sourceId}`, row);
        }
        await sleep(180);
      } catch (error) {
        failed += 1;
        console.error(`skip photon ${job.q} ${city.county}: ${error instanceof Error ? error.message : error}`);
        await sleep(400);
      }
    }
  }

  const rows = [...map.values()]
    .filter((row) => row.isActive !== false)
    .map((row) => {
      if (row.brand && !nameFitsBrand(row.name, row.brand)) {
        return {
          ...row,
          brand: null,
          aliases: [],
        };
      }
      return row;
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "zh-Hant"));
  writeFileSync(OUT, `${JSON.stringify(rows, null, 2)}\n`);
  const bySource = {};
  const byCategory = {};
  const byCity = {};
  for (const row of rows) {
    bySource[row.source] = (bySource[row.source] ?? 0) + 1;
    byCategory[row.category] = (byCategory[row.category] ?? 0) + 1;
    byCity[row.city ?? row.county ?? "未知"] = (byCity[row.city ?? row.county ?? "未知"] ?? 0) + 1;
  }
  const report = {
    dataset: "taiwan_poi_index",
    source: "OpenStreetMap Overpass + Photon (ODbL)",
    companyRegistry: "not-imported (commercial registration ≠ navigable POI)",
    total: rows.length,
    failed,
    bySource,
    byCategory,
    byCity,
    written: OUT,
  };
  writeFileSync("docs/poi-ingest-report.json", `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
