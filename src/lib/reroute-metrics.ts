export type ReroutePhase =
  | "detect"
  | "request"
  | "response"
  | "parse"
  | "render";

export type RerouteTimings = {
  detectMs: number | null;
  requestMs: number | null;
  responseMs: number | null;
  parseMs: number | null;
  renderMs: number | null;
  totalMs: number | null;
  at: string | null;
};

const empty: RerouteTimings = {
  detectMs: null,
  requestMs: null,
  responseMs: null,
  parseMs: null,
  renderMs: null,
  totalMs: null,
  at: null,
};

let last = empty;

export function recordRerouteTimings(next: RerouteTimings) {
  last = next;
}

export function lastRerouteTimings() {
  return last;
}

export function logRerouteTimings(label: string, timings: RerouteTimings) {
  recordRerouteTimings(timings);
  console.info(`[reroute] ${label}`, timings);
}
