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

/** Wide head for the flat ribbon. The shaft is the route line, not this sprite. */
export function paintFlatArrow(): ImageData | null {
  const ctx = canvasOf(128);
  if (!ctx) return null;
  ctx.shadowColor = "rgba(186, 230, 253, 0.9)";
  ctx.shadowBlur = 16;
  wideHead(ctx);
  ctx.fillStyle = "#e0f2fe";
  ctx.fill();
  ctx.shadowColor = "transparent";
  wideHead(ctx);
  const face = ctx.createLinearGradient(0, -46, 0, 18);
  face.addColorStop(0, "#ffffff");
  face.addColorStop(1, "#7dd3fc");
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  return ctx.getImageData(0, 0, 128, 128);
}

/**
 * Raised head for the floating ribbon. The bend itself is the route line.
 * `phase` is accepted so callers can keep a stable signature; the moving
 * highlight is painted on that line.
 */
export function paintFloatArrow(
  _side: ArrowPaintSide,
  _phase = 0,
): ImageData | null {
  const ctx = canvasOf(128);
  if (!ctx) return null;
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.55)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 12;
  ctx.translate(0, 8);
  wideHead(ctx);
  ctx.fillStyle = "#0c4a6e";
  ctx.fill();
  ctx.restore();

  ctx.translate(0, 7);
  wideHead(ctx);
  ctx.fillStyle = "#075985";
  ctx.fill();
  ctx.translate(0, -7);
  wideHead(ctx);
  const face = ctx.createLinearGradient(0, -46, 0, 20);
  face.addColorStop(0, "#ffffff");
  face.addColorStop(0.45, "#7dd3fc");
  face.addColorStop(1, "#0284c7");
  ctx.fillStyle = face;
  ctx.fill();
  ctx.lineJoin = "round";
  ctx.lineWidth = 6;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  return ctx.getImageData(0, 0, 128, 128);
}
