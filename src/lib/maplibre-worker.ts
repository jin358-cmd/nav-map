import { setWorkerUrl } from "maplibre-gl";

let configured = false;

/** MapLibre 6 looks for its worker next to the bundled ESM file; Next.js moves that path. */
export function configureMapLibreWorker() {
  if (configured || typeof window === "undefined") return;
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
  configured = true;
}
