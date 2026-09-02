export function createVehicleMarkerElement(): HTMLDivElement {
  const root = document.createElement("div");
  root.className = "vehicle-marker";
  root.innerHTML = `
    <div class="vehicle-marker__halo"></div>
    <div class="vehicle-marker__arrow" aria-hidden="true">
      <svg viewBox="0 0 72 88" width="46" height="56">
        <defs>
          <linearGradient id="nav-arrow" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#9af4ff"/>
            <stop offset="55%" stop-color="#3ee0ff"/>
            <stop offset="100%" stop-color="#1494b8"/>
          </linearGradient>
        </defs>
        <ellipse cx="36" cy="78" rx="14" ry="5" fill="#3ee0ff" opacity="0.32"/>
        <path d="M36 6 L62 70 L36 56 L10 70 Z" fill="url(#nav-arrow)" stroke="#e7fbff" stroke-width="2" stroke-linejoin="round"/>
        <path d="M36 22 L46 52 L36 46 L26 52 Z" fill="#062026" opacity="0.28"/>
      </svg>
    </div>
    <div class="vehicle-marker__car" aria-hidden="true">
      <svg viewBox="0 0 72 96" width="54" height="72">
        <defs>
          <linearGradient id="body" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#3a4558"/>
            <stop offset="55%" stop-color="#1c222d"/>
            <stop offset="100%" stop-color="#0e1218"/>
          </linearGradient>
          <linearGradient id="glass" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="#8be9ff"/>
            <stop offset="100%" stop-color="#1a3a48"/>
          </linearGradient>
        </defs>
        <ellipse cx="36" cy="86" rx="18" ry="5" fill="#3ee0ff" opacity="0.28"/>
        <path d="M18 78c-3-8-4-22-3-34 1-14 6-24 21-30 15 6 20 16 21 30 1 12 0 26-3 34-2 5-8 8-18 8s-16-3-18-8z" fill="url(#body)" stroke="#3ee0ff" stroke-width="1.4"/>
        <path d="M26 40c2-10 6-16 10-18 4 2 8 8 10 18-6 3-14 3-20 0z" fill="url(#glass)" opacity="0.9"/>
        <rect x="20" y="70" width="8" height="5" rx="1.5" fill="#ff5a3c"/>
        <rect x="44" y="70" width="8" height="5" rx="1.5" fill="#ff5a3c"/>
        <rect x="32" y="74" width="8" height="3" rx="1" fill="#3ee0ff"/>
        <path d="M22 58h6M44 58h6" stroke="#3ee0ff" stroke-width="1.6" stroke-linecap="round" opacity="0.8"/>
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
