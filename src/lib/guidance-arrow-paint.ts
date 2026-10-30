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

function wideHead(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(0, -46);
  ctx.lineTo(40, 18);
  ctx.lineTo(0, 2);
  ctx.lineTo(-40, 18);
  ctx.closePath();
}

function fillHead(ctx: CanvasRenderingContext2D) {
  wideHead(ctx);
  const face = ctx.createLinearGradient(0, -46, 0, 18);
  face.addColorStop(0, "#fbbf24");
  face.addColorStop(1, "#f59e0b");
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#1f2937";
  ctx.stroke();
}

/** Wide amber head. The shaft is the route line, not this sprite. */
export function paintFlatArrow(): ImageData | null {
  const ctx = canvasOf(128);
  if (!ctx) return null;
  fillHead(ctx);
  return ctx.getImageData(0, 0, 128, 128);
}

/**
 * Same amber head as the flat arrow, with a faint dark shadow under it.
 * The bend itself stays on the route line.
 */
export function paintFloatArrow(
  _side: ArrowPaintSide,
  _phase = 0,
): ImageData | null {
  const ctx = canvasOf(128);
  if (!ctx) return null;
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.45)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 8;
  fillHead(ctx);
  ctx.restore();
  fillHead(ctx);
  return ctx.getImageData(0, 0, 128, 128);
}
