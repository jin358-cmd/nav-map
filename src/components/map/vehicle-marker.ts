/**
 * 立體三角車頭：與安裝圖示同語言。
 * 旋轉走 Marker.setRotation；根節點不做 CSS rotate。
 * 圖標本身以 rotateX(15deg) 呈現 15° 仰角；viewBox 正方形、重心在中心。
 */
export function createVehicleMarkerElement(): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "vehicle-marker";
  root.innerHTML = `
    <div class="vehicle-marker__body" aria-hidden="true">
      <svg viewBox="0 0 64 64" width="58" height="58">
        <ellipse cx="32" cy="51" rx="11" ry="3.1" fill="rgba(15,23,42,0.3)"/>
        <path d="M16 46 L32 52 L48 46 L32 40 Z" fill="#713f12"/>
        <path d="M32 4 L50 46 L32 40 Z" fill="#92400e"/>
        <path d="M32 4 L14 46 L32 40 Z" fill="#ca8a04"/>
        <path
          d="M32 2 L51 47 L32 37 L13 47 Z"
          fill="#facc15"
          stroke="#3f3f46"
          stroke-width="1.15"
          stroke-linejoin="round"
        />
        <path d="M32 6 L20 42 L32 34 Z" fill="#fde047" opacity="0.5"/>
        <path
          d="M32 8 L32 34"
          fill="none"
          stroke="#fef08a"
          stroke-width="1.7"
          stroke-linecap="round"
          opacity="0.9"
        />
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
