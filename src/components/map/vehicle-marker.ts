/**
 * 貼地 3D 黃色指標：MapLibre Marker 用 pitch/rotation alignment = map。
 * 旋轉走 Marker.setRotation，根節點不做 CSS rotate。
 */
export function createVehicleMarkerElement(): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "vehicle-marker";
  root.innerHTML = `
    <div class="vehicle-marker__body" aria-hidden="true">
      <svg viewBox="0 0 72 92" width="52" height="68">
        <ellipse cx="36" cy="86" rx="18" ry="5.5" fill="rgba(15,23,42,0.28)"/>
        <path d="M20 82 L26 40 L16 34 L36 4 L56 34 L46 40 L52 82 Z" fill="#713f12"/>
        <path d="M22 78 L28 38 L36 10 L44 38 L50 78 L36 70 Z" fill="#a16207"/>
        <path d="M24 74 L30 36 L36 14 L42 36 L48 74 L36 66 Z" fill="#ca8a04"/>
        <path d="M36 6 L56 34 L45 34 L52 72 L36 64 L20 72 L27 34 L16 34 Z" fill="#facc15" stroke="#d4d4d8" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M36 12 L45 32 L36 60 L27 32 Z" fill="#fde047" opacity="0.55"/>
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
