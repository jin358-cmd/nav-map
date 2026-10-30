export type LngLatPair = [number, number];

export type RoadRibbon = {
  line: LngLatPair[];
  elevated: boolean;
  link: boolean;
  roadClass: string;
};

export type ForkRoute = {
  coordinates: LngLatPair[];
  distanceMeters: number;
  durationSeconds: number;
};

export type ElevatedGroundFork = {
  id: string;
  decision: LngLatPair;
  rejoin: LngLatPair | null;
  elevated: ForkRoute;
  ground: ForkRoute;
};

export const SAME_PATH_METERS = 12;
export const MIN_SPLIT_METERS = 80;
export const MAX_SPLIT_METERS = 8_000;
export const ELEVATED_MEDIAN_MAX_METERS = 10;
export const GROUND_MEDIAN_MIN_METERS = 12;
export const MEDIAN_GAP_METERS = 8;
export const SPLIT_LENGTH_RATIO = 2.2;

export const FORK_PROMPT_METERS = 200;
export const FORK_PROMPT_EXIT_METERS = 240;
export const FORK_PASSED_HOLD_METERS = 15;
export const FORK_DISMISS_MS = 12_000;

export const FORK_PROBE_GAP_MS = 20_000;
export const FORK_NEGATIVE_RETRY_MS = 60_000;
export const FORK_NEGATIVE_RETRY_METERS = 400;
