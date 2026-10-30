import type { SVGProps } from "react";

function svgProps(props: SVGProps<SVGSVGElement>) {
  return {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function CongestionCarsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)} aria-hidden>
      <rect x="1.4" y="13.2" width="6.2" height="4.2" rx="1" />
      <path d="M2.2 13.2l1-2.2h2.2l1.2 2.2" />
      <circle cx="3" cy="17.6" r="0.7" fill="currentColor" />
      <circle cx="6.2" cy="17.6" r="0.7" fill="currentColor" />
      <rect x="8.6" y="9.6" width="7" height="4.6" rx="1" />
      <path d="M9.6 9.6l1.1-2.3h2.6l1.3 2.3" />
      <circle cx="10.4" cy="14.4" r="0.7" fill="currentColor" />
      <circle cx="14" cy="14.4" r="0.7" fill="currentColor" />
      <rect x="16.4" y="13.2" width="6.2" height="4.2" rx="1" />
      <path d="M17.2 13.2l1-2.2h2.2l1.2 2.2" />
      <circle cx="18" cy="17.6" r="0.7" fill="currentColor" />
      <circle cx="21.2" cy="17.6" r="0.7" fill="currentColor" />
    </svg>
  );
}

export function CctvLensIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)} aria-hidden>
      <rect x="2.5" y="7" width="11" height="8.5" rx="2" />
      <path d="M13.5 9.6l7-3.4v11.2l-7-3.4" />
      <circle cx="8" cy="11.2" r="2.2" />
      <circle cx="8" cy="11.2" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function ConstructionBarrierIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)} aria-hidden>
      <path d="M5 5v15" />
      <path d="M19 5v15" />
      <path d="M5 8.5h14" />
      <path d="M5 14h14" />
      <path d="M7 8.5l4 5.5" />
      <path d="M13 8.5l4 5.5" />
    </svg>
  );
}

export function AccidentTriangleIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)} aria-hidden>
      <path d="M12 3.2l9.6 17.2H2.4L12 3.2z" />
      <path d="M12 10v5.2" strokeWidth="2.2" />
      <circle cx="12" cy="18.1" r="0.85" fill="currentColor" />
    </svg>
  );
}

/** Side-view scooter with a delivery box on the rear rack. */
export function DeliveryScooterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)} aria-hidden>
      <rect x="1.7" y="6.6" width="6.2" height="4.8" rx="0.9" />
      <path d="M1.7 8.9h6.2" />
      <circle cx="5.8" cy="17.8" r="2.45" />
      <circle cx="18.2" cy="17.8" r="2.45" />
      <path d="M8.2 17.8h7.2" />
      <path d="M5.8 15.3V12.2H13l4.6 5.6" />
      <path d="M13 12.2l2.5-3.8H20.4" />
      <path d="M8.4 11.4h3.5" />
    </svg>
  );
}

export function DisasterWarningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...svgProps(props)} aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z" />
      <path d="M12 8v5" strokeWidth="2.2" />
      <circle cx="12" cy="16.2" r="0.85" fill="currentColor" />
    </svg>
  );
}
