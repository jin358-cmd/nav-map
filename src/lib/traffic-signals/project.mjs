const TAIWAN = { west: 118, south: 21.5, east: 122.8, north: 26.6 };

export function validTaiwanPoint(location) {
  const lng = Number(location?.lng);
  const lat = Number(location?.lat);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < TAIWAN.west || lng > TAIWAN.east || lat < TAIWAN.south || lat > TAIWAN.north) {
    return null;
  }
  return { lng, lat };
}

function neutral(signal) {
  return {
    drawable: false,
    label: "🚦 --",
    seconds: null,
    phase: "unknown",
    showColor: false,
    demo: false,
    message: "路口號誌位置已通過座標檢核／即時秒數未提供",
    ariaLabel: "路口號誌。即時秒數未提供。以現場號誌及員警指揮為準。",
    signal,
  };
}

function directionMatches(signal) {
  if (!signal?.routeApproach || !signal?.expectedApproach) return false;
  if (signal.routeApproach !== signal.expectedApproach) return false;
  return signal.movement === "straight" || signal.movement === "left" || signal.movement === "right";
}

function liveSeconds(signal, nowMs) {
  if (signal?.remainingMode !== "verified_live" || signal?.status !== "live") return null;
  if (!directionMatches(signal)) return null;
  if (signal.phase !== "red" && signal.phase !== "amber" && signal.phase !== "green") return null;
  if (!Number.isInteger(signal.remainingSeconds) || signal.remainingSeconds < 0) return null;
  const expires = Date.parse(signal.expiresAt ?? "");
  const stamped = Date.parse(signal.sourceTimestamp ?? "");
  if (!Number.isFinite(expires) || !Number.isFinite(stamped)) return null;
  if (nowMs < stamped || nowMs > expires) return null;
  const remainingMs = expires - nowMs;
  if (signal.remainingSeconds * 1000 > remainingMs + 1000) return null;
  const shown = Math.min(signal.remainingSeconds, Math.floor(remainingMs / 1000));
  if (!Number.isInteger(shown) || shown < 0) return null;
  return shown;
}

export function projectSignal(signal, options = {}) {
  const nowMs = options.nowMs ?? Date.now();
  const location = validTaiwanPoint(signal?.location);
  if (!location) {
    return {
      ...neutral(signal),
      drawable: false,
      label: null,
      message: "座標未確認，不顯示號誌。",
    };
  }
  const base = {
    ...neutral({ ...signal, location }),
    drawable: true,
  };
  if (signal?.remainingMode === "demo_only") {
    if (options.allowDemo !== true) return base;
    const seconds = Number(signal.remainingSeconds);
    const phase = signal.phase;
    if (!Number.isInteger(seconds) || seconds < 0 || seconds > 10) return base;
    if (phase !== "red" && phase !== "amber" && phase !== "green") return base;
    return {
      ...base,
      label: `TEST/DEMO 🚦 ${phase} ${String(seconds).padStart(2, "0")}`,
      seconds,
      phase,
      showColor: true,
      demo: true,
      message: "本機 TEST/DEMO，不是官方即時秒數。",
      ariaLabel: "測試用號誌動畫，不是道路上的即時秒數。",
    };
  }
  const seconds = liveSeconds(signal, nowMs);
  if (seconds == null) return base;
  const phaseLabel = signal.phase === "red" ? "紅" : signal.phase === "amber" ? "黃" : "綠";
  return {
    ...base,
    label: `🚦 ${phaseLabel} ${seconds}`,
    seconds,
    phase: signal.phase,
    showColor: true,
    message: "已驗證的即時秒數。以現場號誌及員警指揮為準。",
    ariaLabel: `行進方向號誌${phaseLabel}燈，剩餘 ${seconds} 秒。以現場號誌及員警指揮為準。`,
  };
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

export function haversineMeters(a, b) {
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceToRouteMeters(point, line) {
  if (!Array.isArray(line) || line.length < 2) return Number.POSITIVE_INFINITY;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 1; index < line.length; index += 1) {
    const start = { lng: line[index - 1][0], lat: line[index - 1][1] };
    const end = { lng: line[index][0], lat: line[index][1] };
    best = Math.min(best, pointToSegmentMeters(point, start, end));
  }
  return best;
}

function pointToSegmentMeters(point, start, end) {
  const length = haversineMeters(start, end);
  if (length < 1) return haversineMeters(point, start);
  const steps = Math.max(1, Math.ceil(length / 25));
  let best = Number.POSITIVE_INFINITY;
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps;
    best = Math.min(
      best,
      haversineMeters(point, {
        lng: start.lng + (end.lng - start.lng) * t,
        lat: start.lat + (end.lat - start.lat) * t,
      }),
    );
  }
  return best;
}

export function recordToSignal(row) {
  const location = validTaiwanPoint({ lng: row?.[0], lat: row?.[1] });
  if (!location) return null;
  return {
    intersectionId: `tainan110:${location.lat.toFixed(5)}:${location.lng.toFixed(5)}`,
    signalId: typeof row[2] === "string" && row[2] ? row[2] : null,
    source: "臺南市公共管線圖資 110年交通號誌",
    sourceUrl: "https://data.tainan.gov.tw/DataSet/Detail/db71753a-125c-46e9-95a9-60d35512d4e5",
    location,
    locationConfidence: "reported",
    routeApproach: null,
    signalGroup: null,
    movement: "unknown",
    phase: "unknown",
    remainingSeconds: null,
    remainingMode: "unavailable",
    sourceTimestamp: null,
    expiresAt: null,
    lastVerifiedAt: null,
    status: "blocked",
    headCount: Number.isInteger(row[3]) ? row[3] : 1,
    equipmentNote: typeof row[4] === "string" ? row[4] : null,
  };
}
