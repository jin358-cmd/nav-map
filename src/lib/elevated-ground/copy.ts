import { formatDistance } from "@/lib/format";

function formatSpan(seconds: number) {
  const abs = Math.abs(Math.round(seconds));
  if (abs < 60) return `${abs} 秒`;
  return `${Math.max(1, Math.round(abs / 60))} 分`;
}

export function formatForkComparison(
  activeSeconds: number,
  activeMeters: number,
  otherSeconds: number,
  otherMeters: number,
) {
  const seconds = otherSeconds - activeSeconds;
  const meters = otherMeters - activeMeters;
  const time =
    Math.abs(seconds) < 20
      ? "時間接近"
      : seconds < 0
        ? `快 ${formatSpan(seconds)}`
        : `慢 ${formatSpan(seconds)}`;
  const distance =
    Math.abs(meters) < 40
      ? "距離接近"
      : meters < 0
        ? `近 ${formatDistance(-meters)}`
        : `遠 ${formatDistance(meters)}`;
  return `${time} · ${distance}`;
}
