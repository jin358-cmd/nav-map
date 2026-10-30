/** Predicates mirrored by the Supabase conditional updates. */

export function grabClaimQuery(orderId: string) {
  return [
    `id=eq.${encodeURIComponent(orderId)}`,
    "status=eq.awaiting_dispatch",
    "dispatch_mode=eq.grab",
    "courier_id=is.null",
  ].join("&");
}

export function nearestClaimQuery(orderId: string, courierId: string, nowIso: string) {
  return [
    `id=eq.${encodeURIComponent(orderId)}`,
    "status=eq.awaiting_dispatch",
    "dispatch_mode=eq.nearest",
    `offered_courier_id=eq.${encodeURIComponent(courierId)}`,
    `offer_expires_at=gte.${encodeURIComponent(nowIso)}`,
  ].join("&");
}

export function nearestOfferQuery(orderId: string) {
  return [
    `id=eq.${encodeURIComponent(orderId)}`,
    "status=eq.awaiting_dispatch",
    "dispatch_mode=eq.nearest",
    "offered_courier_id=is.null",
  ].join("&");
}
