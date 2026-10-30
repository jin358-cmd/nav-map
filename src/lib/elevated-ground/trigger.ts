import {
  FORK_DISMISS_MS,
  FORK_NEGATIVE_RETRY_METERS,
  FORK_NEGATIVE_RETRY_MS,
  FORK_PASSED_HOLD_METERS,
  FORK_PROBE_GAP_MS,
  FORK_PROMPT_EXIT_METERS,
  FORK_PROMPT_METERS,
} from "@/lib/elevated-ground/types";

export type ForkPromptInput = {
  navigating: boolean;
  offRoute: boolean;
  choiceMade: boolean;
  dismissed: boolean;
  aheadMeters: number;
};

export type ForkPromptState = {
  visible: boolean;
  pending: boolean;
};

export function initialForkPrompt(): ForkPromptState {
  return { visible: false, pending: false };
}

function inEntryWindow(aheadMeters: number) {
  return aheadMeters >= 0 && aheadMeters <= FORK_PROMPT_METERS;
}

function inHoldWindow(aheadMeters: number) {
  return aheadMeters >= -FORK_PASSED_HOLD_METERS && aheadMeters <= FORK_PROMPT_EXIT_METERS;
}

export function reduceForkPrompt(
  state: ForkPromptState,
  input: ForkPromptInput,
): ForkPromptState {
  if (!input.navigating || input.offRoute || input.choiceMade || input.dismissed) {
    return { visible: false, pending: false };
  }
  if (state.visible) {
    return inHoldWindow(input.aheadMeters)
      ? { visible: true, pending: false }
      : { visible: false, pending: false };
  }
  if (!inEntryWindow(input.aheadMeters)) return { visible: false, pending: false };
  if (!state.pending) return { visible: false, pending: true };
  return { visible: true, pending: false };
}

export function forkTimedOut(
  visibleSinceMs: number | null,
  nowMs: number,
  dismissMs = FORK_DISMISS_MS,
) {
  return visibleSinceMs != null && nowMs - visibleSinceMs >= dismissMs;
}

export type ProbeGate = {
  lastAtMs: number;
  negatives: { key: string; atMs: number; routeMeters: number }[];
};

export function canProbeFork(
  gate: ProbeGate,
  nowMs: number,
  routeMeters: number,
  key: string,
): boolean {
  if (gate.lastAtMs > 0 && nowMs - gate.lastAtMs < FORK_PROBE_GAP_MS) return false;
  const negative = gate.negatives.find((item) => item.key === key);
  if (!negative) return true;
  if (nowMs - negative.atMs >= FORK_NEGATIVE_RETRY_MS) return true;
  return routeMeters - negative.routeMeters >= FORK_NEGATIVE_RETRY_METERS;
}
