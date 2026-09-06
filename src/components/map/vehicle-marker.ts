/**
 * 貼地 3D 黃色指標：MapLibre Marker 用 pitch/rotation alignment = map。
 * 旋轉走 Marker.setRotation，根節點不做 CSS rotate。
 */
export function createVehicleMarkerElement(): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "vehicle-marker";
  root.innerHTML = `
    <div class="vehicle-marker__body" aria-hidden="true">
      <svg viewBox="0 0 72 84" width="52" height="61">
        <ellipse cx="36" cy="76" rx="18" ry="6" fill="rgba(15,23,42,0.28)"/>
        <path d="M22 70 L28 38 L20 34 L36 10 L52 34 L44 38 L50 70 Z" fill="#a16207"/>
        <path d="M24 68 L30 36 L36 14 L42 36 L48 68 L36 62 Z" fill="#ca8a04"/>
        <path d="M36 8 L54 34 L44 34 L50 66 L36 60 L22 66 L28 34 L18 34 Z" fill="#facc15" stroke="#d4d4d8" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M36 14 L44 32 L36 58 L28 32 Z" fill="#fde047" opacity="0.55"/>
      </svg>
    </div>
  `;
  return root;
}

export function setVehicleMarkerNavigating(
  element: HTMLElement,
  navigating: boolean,
) {
  element.classList.toggle("vehicle-marker--nav", navigating);
}

export function setVehicleMarkerHeading(element: HTMLElement, heading: number) {
  const body = element.querySelector<HTMLElement>(".vehicle-marker__body");
  if (!body) return;
  body.dataset.heading = String(heading);
}
