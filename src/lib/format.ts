export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return `${km >= 10 ? km.toFixed(0) : km.toFixed(1)} 公里`;
  }
  return `${Math.round(meters)} 公尺`;
}

export function cctvStatusLabel(status: "online" | "offline" | "maintenance") {
  if (status === "online") return "在線";
  if (status === "maintenance") return "維護中";
  return "離線";
}
