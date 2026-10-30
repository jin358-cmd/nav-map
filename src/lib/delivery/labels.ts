import type { OrderStatus } from "@/lib/delivery/types";

const LABELS: Record<OrderStatus, string> = {
  created: "已建立",
  awaiting_dispatch: "等待外送員接單",
  assigned: "外送員已接單",
  picked_up: "已取餐",
  delivered: "已送達",
  cancelled: "已取消",
};

export function statusLabel(status: OrderStatus) {
  return LABELS[status];
}
