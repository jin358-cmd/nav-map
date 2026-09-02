import {
  finalizeTrafficSegment,
  type TrafficSegmentSeed,
} from "@/lib/traffic-normalize";
import type { TrafficSegment } from "@/types/domain";

const SEEDS: TrafficSegmentSeed[] = [
  {
    id: "tr-zz-smooth",
    name: "中正路南段",
    level: "smooth",
    sourceType: "city",
    dataOrigin: "mock",
    speedKmh: 42,
    coordinates: [
      [120.2047, 22.9846],
      [120.20486, 22.9878],
      [120.20495, 22.991],
    ],
  },
  {
    id: "tr-zz-slow",
    name: "中正路近民生",
    level: "slow",
    sourceType: "city",
    dataOrigin: "mock",
    speedKmh: 22,
    coordinates: [
      [120.20495, 22.991],
      [120.20478, 22.9946],
      [120.2047, 22.9952],
    ],
  },
  {
    id: "tr-ms-smooth",
    name: "民生路一段",
    level: "smooth",
    sourceType: "city",
    dataOrigin: "mock",
    speedKmh: 38,
    coordinates: [
      [120.2047, 22.995],
      [120.2082, 22.99532],
      [120.2121, 22.9964],
    ],
  },
  {
    id: "tr-dongmen",
    name: "東門圓環",
    level: "congested",
    sourceType: "city",
    dataOrigin: "mock",
    speedKmh: 12,
    coordinates: [
      [120.2092, 22.9898],
      [120.211, 22.9886],
      [120.2128, 22.9874],
      [120.2142, 22.9866],
    ],
  },
  {
    id: "tr-hua",
    name: "中華東路",
    level: "severe",
    sourceType: "city",
    dataOrigin: "mock",
    speedKmh: 7,
    coordinates: [
      [120.2168, 22.992],
      [120.2184, 22.9884],
      [120.2196, 22.9848],
    ],
  },
  {
    id: "tr-ic",
    name: "臺南交流道南下",
    level: "blocked",
    sourceType: "freeway",
    dataOrigin: "mock",
    speedKmh: 3,
    coordinates: [
      [120.2248, 23.0442],
      [120.2268, 23.0408],
      [120.2284, 23.0376],
    ],
  },
];

export const TAINAN_TRAFFIC: TrafficSegment[] = SEEDS.map(finalizeTrafficSegment);
