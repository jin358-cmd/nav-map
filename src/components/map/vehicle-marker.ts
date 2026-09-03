/**
 * MapLibre Marker 使用 anchor=center、無 offset。
 * 根節點不做 translate；旋轉只走 marker.setRotation。
 */
export function createVehicleMarkerElement(): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "vehicle-marker";
  root.innerHTML = `
    <div class="vehicle-marker__halo"></div>
    <div class="vehicle-marker__triangle" aria-hidden="true">
      <svg viewBox="0 0 24 28" width="32" height="38">
        <path d="M12 2 L22 25 L12 19 L2 25 Z" fill="#facc15" stroke="#fef08a" stroke-width="1.8" stroke-linejoin="round"/>
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
