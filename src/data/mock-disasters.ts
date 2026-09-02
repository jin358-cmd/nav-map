import type { DisasterAlert } from "@/types/domain";

export const TAINAN_DISASTERS: DisasterAlert[] = [
  {
    id: "ds-canal-flood",
    kind: "flood",
    title: "運河側積水警戒",
    description: "安平運河沿岸低窪路段積水 10–20 公分，請減速或改道。",
    location: { lng: 120.1926, lat: 22.9968 },
    severity: "watch",
    dataOrigin: "mock",
    source: "mock",
  },
  {
    id: "ds-jh-closure",
    kind: "closure",
    title: "金華路夜間施工封閉",
    description: "金華路三段機車道封閉，大型施工機具占用外側。",
    location: { lng: 120.2034, lat: 22.9892 },
    severity: "warning",
    dataOrigin: "mock",
    source: "mock",
  },
  {
    id: "ds-typhoon",
    kind: "typhoon",
    title: "沿海強風注意",
    description: "安平漁港至觀夕平台沿線陣風偏強，高車注意側風。",
    location: { lng: 120.1506, lat: 22.9992 },
    severity: "watch",
    dataOrigin: "mock",
    source: "mock",
  },
];
