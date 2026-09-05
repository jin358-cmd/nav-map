export type AttributionEntry = {
  label: string;
  href: string;
  note?: string;
};

/** Presentation-only catalog. Does not change APIs or layer data. */
export const MAP_DATA_SOURCES: AttributionEntry[] = [
  {
    label: "© OpenStreetMap contributors",
    href: "https://www.openstreetmap.org/copyright",
    note: "底圖與部分標籤",
  },
  {
    label: "OpenFreeMap",
    href: "https://openfreemap.org/",
    note: "向量底圖",
  },
  {
    label: "OpenMapTiles",
    href: "https://openmaptiles.org/",
    note: "圖磚樣式",
  },
  {
    label: "警政署測速執法公開資料",
    href: "https://data.gov.tw/dataset/7320",
    note: "測速執法點",
  },
  {
    label: "內政部 TGOS",
    href: "https://data.tgos.tw/",
    note: "地址與主題圖資",
  },
  {
    label: "Esri / Maxar / Earthstar Geographics",
    href: "https://www.esri.com/",
    note: "衛星影像",
  },
  {
    label: "CARTO",
    href: "https://carto.com/attributions",
    note: "衛星路名標籤",
  },
];
