import type { AccidentReport } from "@/types/domain";

/** 示範導航路線：中正路北上，民生路口右轉往臺南火車站 */
export const DEMO_ROUTE: [number, number][] = [
  [120.20472, 22.9849],
  [120.20478, 22.9864],
  [120.20486, 22.9878],
  [120.20492, 22.9894],
  [120.20495, 22.9912],
  [120.2049, 22.9931],
  [120.20478, 22.9946],
  [120.2047, 22.995],
  [120.2064, 22.99512],
  [120.2082, 22.99532],
  [120.2101, 22.99562],
  [120.2116, 22.9961],
  [120.21245, 22.9969],
];

export const TAINAN_ACCIDENTS: AccidentReport[] = [
  {
    id: "acc-zhongzheng",
    title: "中正路機車擦撞",
    description: "北側外側兩車輕碰，占用機車待轉區。",
    location: { lng: 120.2051, lat: 22.9882 },
  },
  {
    id: "acc-minsheng",
    title: "民生路口追撞",
    description: "右轉車道三車追撞，請改走公園路。",
    location: { lng: 120.2088, lat: 22.9953 },
  },
  {
    id: "acc-dongmen",
    title: "東門路追撞",
    description: "外側車道兩車擦撞，占用一線，請提早改道。",
    location: { lng: 120.2146, lat: 22.9904 },
  },
  {
    id: "acc-station",
    title: "火車站前減速看齊",
    description: "接送臨停占用外側，車速偏慢。",
    location: { lng: 120.2127, lat: 22.9969 },
  },
  {
    id: "acc-gongyuan",
    title: "公園路擦撞",
    description: "路口未減速，占用機車道。",
    location: { lng: 120.1982, lat: 22.9918 },
  },
  {
    id: "acc-anping",
    title: "安平路側撞",
    description: "外側車道輕碰，請靠內側通過。",
    location: { lng: 120.1854, lat: 22.9974 },
  },
];
