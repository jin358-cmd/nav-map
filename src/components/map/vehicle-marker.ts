export function createVehicleMarkerElement(): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "vehicle-marker";
  root.innerHTML = `
    <div class="vehicle-marker__halo"></div>
    <div class="vehicle-marker__triangle" aria-hidden="true">
      <svg viewBox="0 0 36 40" width="22" height="24">
        <defs>
          <linearGradient id="loc-tri" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#fff3a1"/>
            <stop offset="42%" stop-color="#facc15"/>
            <stop offset="100%" stop-color="#ca8a04"/>
          </linearGradient>
        </defs>
        <ellipse cx="18" cy="36" rx="7" ry="2.4" fill="#facc15" opacity="0.35"/>
        <path d="M18 3 L32 34 L18 26 L4 34 Z" fill="url(#loc-tri)" stroke="#fef08a" stroke-width="1.6" stroke-linejoin="round"/>
        <path d="M18 10 L22 24 L18 21 L14 24 Z" fill="#fff7c2" opacity="0.7"/>
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
