import type { OrderStatus } from "@/lib/delivery/types";

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: OrderStatus,
    readonly to: OrderStatus,
  ) {
    super(`illegal delivery transition ${from} -> ${to}`);
    this.name = "InvalidTransitionError";
  }
}

export class DeliverySchemaMissingError extends Error {
  constructor(
    message = "外送資料表尚未建立。請先審核並套用 delivery portal migration，再重新整理。",
  ) {
    super(message);
    this.name = "DeliverySchemaMissingError";
  }
}

export class DeliveryUnavailableError extends Error {
  constructor(message = "外送服務暫時無法連線。") {
    super(message);
    this.name = "DeliveryUnavailableError";
  }
}
