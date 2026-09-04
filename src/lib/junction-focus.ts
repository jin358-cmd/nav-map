import {
  JUNCTION_FOCUS_ENTER_METERS,
  JUNCTION_FOCUS_EXIT_METERS,
} from "@/lib/constants";

let latched = false;

export function deriveJunctionFocus(navigating: boolean, distanceMeters: number) {
  if (!navigating) {
    latched = false;
    return false;
  }
  latched = latched
    ? distanceMeters <= JUNCTION_FOCUS_EXIT_METERS
    : distanceMeters <= JUNCTION_FOCUS_ENTER_METERS;
  return latched;
}
