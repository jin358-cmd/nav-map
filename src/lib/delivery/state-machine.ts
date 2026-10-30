import { InvalidTransitionError } from "@/lib/delivery/errors";
import type { OrderStatus } from "@/lib/delivery/types";

const EDGES: Record<OrderStatus, readonly OrderStatus[]> = {
  created: ["awaiting_dispatch", "cancelled"],
  awaiting_dispatch: ["assigned", "cancelled"],
  assigned: ["picked_up", "cancelled"],
  picked_up: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return EDGES[from].includes(to);
}

export function assertTransition(from: OrderStatus, to: OrderStatus) {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
  return to;
}

export function isTerminal(status: OrderStatus) {
  return EDGES[status].length === 0;
}
