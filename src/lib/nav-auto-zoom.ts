/**
 * Navigation auto-zoom. The follow camera calls jumpTo every frame, which
 * cancels a concurrent MapLibre easeTo, so the zoom ease uses the same
 * ease-out curve and durations easeTo would. Phase changes are still
 * explicit and timed.
 */

export const NAV_AUTO_ZOOM_DEFAULTS = {
  /** Base trigger before speed is added. Stays inside 100–200 m after clamping. */
  triggerMeters: 120,
  triggerMinMeters: 100,
  triggerMaxMeters: 200,
  /** Extra lead per m/s so a faster approach starts the zoom earlier. */
  metersPerMps: 5,
  hysteresisMeters: 36,
  /** Metres past the maneuver point before the zoom may release. */
  settleMeters: 16,
  /** Or this long after the point, once at least settleMinMeters in. */
  settleMs: 2800,
  settleMinMeters: 6,
  minIntervalMs: 900,
  zoomInMs: 900,
  zoomOutMs: 1200,
  gestureResumeMs: 4000,
  alleyTightMeters: 48,
  alleyCloseMeters: 85,
  alleyTightBoost: 0.55,
  alleyCloseBoost: 0.28,
} as const;

export type NavAutoZoomConfig = typeof NAV_AUTO_ZOOM_DEFAULTS;

export type NavAutoZoomPhase = "cruise" | "approach" | "turning" | "recover";

export type NavAutoZoomState = {
  phase: NavAutoZoomPhase;
  apexMeters: number | null;
  passedApexAtMs: number | null;
  zoom: number;
  fromZoom: number;
  toZoom: number;
  transitionStartMs: number;
  transitionMs: number;
  lastChangeMs: number;
  holding: boolean;
  resumeAtMs: number;
  frozenZoom: number | null;
};

export type NavAutoZoomInput = {
  previous: NavAutoZoomState;
  nowMs: number;
  enabled: boolean;
  navigating: boolean;
  held: boolean;
  heldZoom: number;
  recenter: boolean;
  speedMps: number;
  routeMeters: number;
  /** Absolute route-metres of upcoming turn maneuvers, sorted. */
  turnCues: number[];
  baseZoom: number;
  focusZoom: number;
  config?: Partial<NavAutoZoomConfig>;
};

export type NavAutoZoomResult = {
  state: NavAutoZoomState;
  zoom: number;
  /** 0 cruise pitch, 1 intersection pitch. */
  tightness: number;
  phase: NavAutoZoomPhase;
  triggerMeters: number;
  active: boolean;
};

export function emptyNavAutoZoomState(zoom = 0): NavAutoZoomState {
  return {
    phase: "cruise",
    apexMeters: null,
    passedApexAtMs: null,
    zoom,
    fromZoom: zoom,
    toZoom: zoom,
    transitionStartMs: 0,
    transitionMs: 0,
    lastChangeMs: -1_000_000,
    holding: false,
    resumeAtMs: 0,
    frozenZoom: null,
  };
}

export function triggerDistanceMeters(
  speedMps: number,
  config: NavAutoZoomConfig = NAV_AUTO_ZOOM_DEFAULTS,
) {
  const speed = Math.max(0, speedMps);
  const raw = config.triggerMeters + speed * config.metersPerMps;
  return Math.min(config.triggerMaxMeters, Math.max(config.triggerMinMeters, raw));
}

export function easeOutQuad(t: number) {
  const clamped = Math.min(1, Math.max(0, t));
  return 1 - (1 - clamped) * (1 - clamped);
}

function cfg(partial?: Partial<NavAutoZoomConfig>): NavAutoZoomConfig {
  return { ...NAV_AUTO_ZOOM_DEFAULTS, ...partial };
}

function sampleZoom(state: NavAutoZoomState, nowMs: number) {
  if (state.transitionMs <= 0) return state.toZoom;
  const t = (nowMs - state.transitionStartMs) / state.transitionMs;
  if (t >= 1) return state.toZoom;
  if (t <= 0) return state.fromZoom;
  return state.fromZoom + (state.toZoom - state.fromZoom) * easeOutQuad(t);
}

function tightnessFor(zoom: number, base: number, focus: number) {
  const span = Math.max(0.2, focus - base);
  return Math.min(1, Math.max(0, (zoom - base) / span));
}

function alleyBoost(gap: number, config: NavAutoZoomConfig) {
  if (!Number.isFinite(gap)) return 0;
  if (gap <= config.alleyTightMeters) return config.alleyTightBoost;
  if (gap <= config.alleyCloseMeters) return config.alleyCloseBoost;
  return 0;
}

function beginMove(
  state: NavAutoZoomState,
  nowMs: number,
  toZoom: number,
  durationMs: number,
  phase: NavAutoZoomPhase,
): NavAutoZoomState {
  const fromZoom = state.zoom;
  if (Math.abs(fromZoom - toZoom) < 0.02 && state.phase === phase) {
    return { ...state, phase, toZoom, zoom: toZoom, transitionMs: 0 };
  }
  return {
    ...state,
    phase,
    fromZoom,
    toZoom,
    zoom: fromZoom,
    transitionStartMs: nowMs,
    transitionMs: durationMs,
    lastChangeMs: nowMs,
  };
}

function upcoming(cues: number[], routeMeters: number, settleMeters: number) {
  const relevant = cues
    .filter((meters) => Number.isFinite(meters) && meters >= routeMeters - settleMeters - 8)
    .sort((a, b) => a - b);
  return { next: relevant[0] ?? null, after: relevant[1] ?? null };
}

export function stepNavAutoZoom(input: NavAutoZoomInput): NavAutoZoomResult {
  const config = cfg(input.config);
  const trigger = triggerDistanceMeters(input.speedMps, config);
  const release = trigger + config.hysteresisMeters;
  const base = input.baseZoom;
  const focus = input.focusZoom;

  if (!input.enabled || !input.navigating) {
    const idle = emptyNavAutoZoomState(base);
    return {
      state: idle,
      zoom: base,
      tightness: 0,
      phase: "cruise",
      triggerMeters: trigger,
      active: false,
    };
  }

  let state: NavAutoZoomState =
    input.previous.zoom === 0 && input.previous.phase === "cruise"
      ? { ...input.previous, zoom: base, fromZoom: base, toZoom: base }
      : input.previous;

  if (input.held && !input.recenter) {
    const frozen = input.heldZoom;
    state = {
      ...state,
      holding: true,
      resumeAtMs: input.nowMs + config.gestureResumeMs,
      frozenZoom: frozen,
      zoom: frozen,
    };
    return {
      state,
      zoom: frozen,
      tightness: tightnessFor(frozen, base, focus),
      phase: state.phase,
      triggerMeters: trigger,
      active: true,
    };
  }

  if (state.holding && !input.recenter && input.nowMs < state.resumeAtMs) {
    const frozen = state.frozenZoom ?? state.zoom;
    return {
      state: { ...state, zoom: frozen },
      zoom: frozen,
      tightness: tightnessFor(frozen, base, focus),
      phase: state.phase,
      triggerMeters: trigger,
      active: true,
    };
  }

  if (state.holding) {
    state = {
      ...state,
      holding: false,
      frozenZoom: null,
      zoom: state.frozenZoom ?? state.zoom,
    };
  }

  state = { ...state, zoom: sampleZoom(state, input.nowMs) };

  const { next, after } = upcoming(input.turnCues, input.routeMeters, config.settleMeters);
  const distance = next == null ? Number.POSITIVE_INFINITY : next - input.routeMeters;
  const gap = next != null && after != null ? after - next : Number.POSITIVE_INFINITY;
  const boosted = focus + alleyBoost(gap, config);
  const intervalOk = input.nowMs - state.lastChangeMs >= config.minIntervalMs;
  const latched = state.apexMeters;
  const into = latched == null ? -Infinity : input.routeMeters - latched;
  const passed = latched != null && into >= 0;
  const passedAt = passed ? (state.passedApexAtMs ?? input.nowMs) : null;
  const settled =
    passed &&
    (into >= config.settleMeters ||
      (into >= config.settleMinMeters &&
        passedAt != null &&
        input.nowMs - passedAt >= config.settleMs));
  const nextStillClose =
    after != null && after - input.routeMeters <= release && after - input.routeMeters > -config.settleMinMeters;
  const wantIn = next != null && distance <= trigger && distance >= -config.settleMinMeters;
  const keepLatched =
    latched != null &&
    next != null &&
    Math.abs(next - latched) < 12 &&
    distance <= release;

  const zoomed = state.phase === "approach" || state.phase === "turning";

  if (!zoomed && state.phase !== "recover") {
    if (wantIn && (intervalOk || state.lastChangeMs < 0)) {
      state = beginMove(
        { ...state, apexMeters: next, passedApexAtMs: null },
        input.nowMs,
        boosted,
        config.zoomInMs,
        "approach",
      );
    }
  } else if (state.phase === "recover") {
    if (wantIn && intervalOk) {
      state = beginMove(
        { ...state, apexMeters: next, passedApexAtMs: null },
        input.nowMs,
        boosted,
        config.zoomInMs,
        "approach",
      );
    } else if (state.zoom - base < 0.03 && input.nowMs - state.transitionStartMs >= state.transitionMs) {
      state = { ...state, phase: "cruise", apexMeters: null, passedApexAtMs: null, toZoom: base, zoom: base };
    }
  } else if (latched != null) {
    state = { ...state, passedApexAtMs: passedAt, toZoom: Math.max(state.toZoom, boosted) };
    if (!keepLatched && !wantIn && (next == null || distance > release) && into < 0 && intervalOk) {
      state = beginMove(state, input.nowMs, base, config.zoomOutMs, "recover");
      state.apexMeters = null;
      state.passedApexAtMs = null;
    } else if (passed && !settled) {
      state = { ...state, phase: "turning" };
    } else if (settled && nextStillClose && after != null) {
      state = {
        ...state,
        phase: "approach",
        apexMeters: after,
        passedApexAtMs: null,
        toZoom: boosted,
        zoom: Math.max(state.zoom, boosted - 0.02),
      };
    } else if (settled && intervalOk) {
      state = beginMove(state, input.nowMs, base, config.zoomOutMs, "recover");
      state.apexMeters = null;
      state.passedApexAtMs = null;
    } else if (settled) {
      state = { ...state, phase: "turning" };
    } else {
      state = { ...state, phase: into >= 0 ? "turning" : "approach" };
    }
  }

  const zoom = sampleZoom(state, input.nowMs);
  state = { ...state, zoom };
  return {
    state,
    zoom,
    tightness: tightnessFor(zoom, base, focus),
    phase: state.phase,
    triggerMeters: trigger,
    active: true,
  };
}

export type YunlinZoomSample = {
  tMs: number;
  routeMeters: number;
  speedMps: number;
  distanceToTurn: number;
  zoom: number;
  phase: NavAutoZoomPhase;
  triggerMeters: number;
};

/**
 * 斗六市文化路轉入巷弄的示意駕駛。
 * 起點約 120.5438, 23.7072，沿路線公尺樁連續幾個近距路口。
 */
export const YUNLIN_ALLEY_TURN_CUES = [220, 290, 335, 560] as const;

export function simulateYunlinAlleyZoom(options?: {
  baseZoom?: number;
  focusZoom?: number;
  speedMps?: number;
}): YunlinZoomSample[] {
  const baseZoom = options?.baseZoom ?? 16.7;
  const focusZoom = options?.focusZoom ?? 18.15;
  const speedMps = options?.speedMps ?? 4;
  const cues = [...YUNLIN_ALLEY_TURN_CUES];
  let state = emptyNavAutoZoomState(baseZoom);
  const samples: YunlinZoomSample[] = [];
  const stepMeters = 5;
  for (let routeMeters = 0; routeMeters <= 560; routeMeters += stepMeters) {
    const tMs = Math.round((routeMeters / speedMps) * 1000);
    const result = stepNavAutoZoom({
      previous: state,
      nowMs: tMs,
      enabled: true,
      navigating: true,
      held: false,
      heldZoom: state.zoom,
      recenter: false,
      speedMps,
      routeMeters,
      turnCues: cues,
      baseZoom,
      focusZoom,
    });
    state = result.state;
    const next = cues.find((cue) => cue >= routeMeters - 8);
    samples.push({
      tMs,
      routeMeters,
      speedMps,
      distanceToTurn: next == null ? Number.POSITIVE_INFINITY : next - routeMeters,
      zoom: Math.round(result.zoom * 100) / 100,
      phase: result.phase,
      triggerMeters: Math.round(result.triggerMeters),
    });
  }
  return samples;
}
