export type ArrowPaintSide = "left" | "right";

const FLOAT_PHASES = 6;

export function floatArrowPhaseCount() {
  return FLOAT_PHASES;
}

function canvasOf(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);
  return ctx;
}

/** Flat arrow pointing up. Laid on the road with map pitch and route bearing. */
export function paintFlatArrow(): ImageData | null {
  const ctx = canvasOf(128);
  if (!ctx) return null;
  ctx.shadowColor = "rgba(8, 47, 73, 0.45)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.moveTo(0, -52);
  ctx.lineTo(16, -24);
  ctx.lineTo(7, -24);
  ctx.lineTo(7, 50);
  ctx.lineTo(-7, 50);
  ctx.lineTo(-7, -24);
  ctx.lineTo(-16, -24);
  ctx.closePath();
  const face = ctx.createLinearGradient(0, -52, 0, 50);
  face.addColorStop(0, "#ffffff");
  face.addColorStop(1, "#7dd3fc");
  ctx.fillStyle = face;
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#0e7490";
  ctx.stroke();
  return ctx.getImageData(0, 0, 128, 128);
}

function curvePoint(side: ArrowPaintSide, t: number) {
  const dir = side === "right" ? 1 : -1;
  const p0 = { x: 0, y: 58 };
  const p1 = { x: dir * 8, y: 8 };
  const p2 = { x: dir * 52, y: -46 };
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

/**
 * Billboard curve. `phase` 0–1 slides a bright packet along the bend
 * toward the arrow head.
 */
export function paintFloatArrow(
  side: ArrowPaintSide,
  phase: number,
): ImageData | null {
  const size = 160;
  const ctx = canvasOf(size);
  if (!ctx) return null;
  const dir = side === "right" ? 1 : -1;

  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.55)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 10;
  ctx.beginPath();
  ctx.moveTo(0, 58);
  ctx.quadraticCurveTo(dir * 8, 8, dir * 52, -46);
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#0f172a";
  ctx.stroke();
  ctx.restore();

  const body = ctx.createLinearGradient(0, 58, dir * 52, -46);
  body.addColorStop(0, "#bae6fd");
  body.addColorStop(0.55, "#38bdf8");
  body.addColorStop(1, "#0369a1");
  ctx.beginPath();
  ctx.moveTo(0, 58);
  ctx.quadraticCurveTo(dir * 8, 8, dir * 52, -46);
  ctx.lineWidth = 14;
  ctx.lineCap = "round";
  ctx.strokeStyle = body;
  ctx.stroke();

  const t = ((phase % 1) + 1) % 1;
  const glow = curvePoint(side, 0.18 + t * 0.62);
  ctx.beginPath();
  ctx.arc(glow.x, glow.y, 8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.fill();

  const tip = curvePoint(side, 1);
  const prev = curvePoint(side, 0.82);
  const angle = Math.atan2(tip.y - prev.y, tip.x - prev.x);
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-8, 12);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, -12);
  ctx.closePath();
  ctx.fillStyle = "#f0f9ff";
  ctx.fill();
  ctx.restore();

  return ctx.getImageData(0, 0, size, size);
}
