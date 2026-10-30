"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Bike } from "lucide-react";
import { HudCloseButton } from "@/components/overlay/hud-close-button";
import { Button } from "@/components/ui/button";
import {
  cancelOrder,
  customerDeviceId,
  DELIVERY_POLL_MS,
  fetchMenu,
  fetchOrder,
  fetchStores,
  placeOrder,
  readActiveOrderId,
  sendCustomerLocation,
  subscribeActiveOrder,
  writeActiveOrderId,
} from "@/lib/delivery/client";
import type {
  CustomerOrderView,
  DeliveryMapPin,
  DeliveryStore,
  DispatchMode,
  MenuItem,
} from "@/lib/delivery/types";

type Point = { lng: number; lat: number };

type Props = {
  open: boolean;
  vehicle: Point;
  googleSub?: string | null;
  googleIdToken?: string | null;
  onClose: () => void;
  onPins: (pins: DeliveryMapPin[]) => void;
};

const ACTOR_ID = /^[A-Za-z0-9_-]{8,128}$/;

function noActiveOrder() {
  return null;
}

function isFailure<T extends { ok?: boolean }>(
  value: T,
): value is Extract<T, { ok: false }> {
  return value.ok !== true;
}

export function DeliverySession({
  open,
  vehicle,
  googleSub,
  googleIdToken,
  onClose,
  onPins,
}: Props) {
  const googleReady = Boolean(googleSub && googleIdToken && ACTOR_ID.test(googleSub));
  const actorId = googleReady ? googleSub! : customerDeviceId();
  const token = googleReady ? googleIdToken : null;
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [store, setStore] = useState<DeliveryStore | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [mode, setMode] = useState<DispatchMode>("nearest");
  const orderId = useSyncExternalStore(subscribeActiveOrder, readActiveOrderId, noActiveOrder);
  const [view, setView] = useState<CustomerOrderView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pins = useMemo(() => pinsFrom(view), [view]);

  useEffect(() => {
    onPins(pins);
  }, [onPins, pins]);

  const refresh = useCallback(async (id: string) => {
    const result = await fetchOrder(actorId, id, token);
    if (isFailure(result)) {
      if (result.error === "not_found") {
        writeActiveOrderId(null);
        setView(null);
      }
      setMessage(result.message ?? "找不到訂單。");
      return;
    }
    setView(result);
    setMessage(null);
  }, [actorId, token]);

  useEffect(() => {
    if (!orderId) return;
    const kick = window.setTimeout(() => {
      void refresh(orderId);
    }, 0);
    const timer = window.setInterval(() => {
      void refresh(orderId);
    }, DELIVERY_POLL_MS);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [orderId, refresh]);

  useEffect(() => {
    if (!orderId) return;
    const timer = window.setInterval(() => {
      void sendCustomerLocation(actorId, orderId, vehicle, token);
    }, DELIVERY_POLL_MS + 2000);
    return () => window.clearInterval(timer);
  }, [actorId, orderId, token, vehicle]);

  useEffect(() => {
    if (!open || orderId) return;
    let cancelled = false;
    void fetchStores(actorId, token).then((result) => {
      if (cancelled) return;
      if (isFailure(result)) {
        setMessage(result.message ?? "外送服務暫時無法連線。");
        setStores([]);
        return;
      }
      setStores(result.stores);
      setMessage(null);
    });
    return () => {
      cancelled = true;
    };
  }, [actorId, open, orderId, token]);

  async function openStore(next: DeliveryStore) {
    setBusy(true);
    const result = await fetchMenu(actorId, next.id, token);
    setBusy(false);
    if (isFailure(result)) {
      setMessage(result.message ?? "菜單讀取失敗。");
      return;
    }
    setStore(result.store);
    setMenu(result.menu);
    setQty({});
    setMessage(null);
  }

  async function submit() {
    if (!store) return;
    const lines = menu
      .filter((item) => (qty[item.id] ?? 0) > 0)
      .map((item) => ({ menuItemId: item.id, qty: qty[item.id] }));
    setBusy(true);
    const result = await placeOrder(
      actorId,
      {
        storeId: store.id,
        lines,
        dropoff: { ...vehicle, label: "目前位置" },
        customerLocation: vehicle,
        dispatchMode: mode,
      },
      token,
    );
    setBusy(false);
    if (isFailure(result)) {
      setMessage(result.message ?? "下單失敗。");
      return;
    }
    writeActiveOrderId(result.order.id);
    setMessage(null);
  }

  async function cancel() {
    if (!orderId) return;
    setBusy(true);
    const result = await cancelOrder(actorId, orderId, token);
    setBusy(false);
    if (isFailure(result)) {
      setMessage(result.message ?? "取消失敗。");
      return;
    }
    setView((current) =>
      current
        ? { ...current, order: result.order, statusLabel: result.statusLabel, courier: null }
        : current,
    );
  }

  if (!open) return null;

  const totalQty = Object.values(qty).reduce((sum, value) => sum + value, 0);
  const cancellable =
    view?.order.status === "created" ||
    view?.order.status === "awaiting_dispatch" ||
    view?.order.status === "assigned";

  return (
    <div className="pointer-events-none absolute inset-0 z-[70]">
      <section
        data-testid="delivery-portal"
        className="parking-panel pointer-events-auto absolute inset-x-2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[48vh] overflow-y-auto rounded-2xl p-3 text-white landscape:inset-y-auto landscape:bottom-3 landscape:left-[max(0.75rem,env(safe-area-inset-left))] landscape:right-auto landscape:max-h-[calc(100dvh-1.5rem)] landscape:w-[min(22rem,calc(100vw-6.5rem))]"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <Bike className="size-4 text-emerald-300" aria-hidden />
            外送
          </h2>
          <HudCloseButton label="關閉外送" size="sm" onClick={onClose} />
        </div>
        {message ? (
          <p role="alert" className="mb-2 text-xs leading-5 text-amber-200">
            {message}
          </p>
        ) : null}
        {view ? (
          <StatusBlock
            view={view}
            busy={busy}
            cancellable={cancellable}
            onCancel={() => void cancel()}
            onNewOrder={() => {
              writeActiveOrderId(null);
              setView(null);
              setStore(null);
            }}
          />
        ) : orderId ? (
          <p className="text-xs text-zinc-400">正在讀取訂單…</p>
        ) : store ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold">{store.name}</p>
            <p className="text-[11px] text-zinc-400">{store.address}</p>
            <ul className="space-y-1.5">
              {menu.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{item.name}</span>
                  <span className="flex items-center gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      aria-label={`減少${item.name}`}
                      onClick={() =>
                        setQty((current) => ({
                          ...current,
                          [item.id]: Math.max(0, (current[item.id] ?? 0) - 1),
                        }))
                      }
                    >
                      −
                    </Button>
                    <span className="w-4 text-center tabular-nums">{qty[item.id] ?? 0}</span>
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      aria-label={`增加${item.name}`}
                      onClick={() =>
                        setQty((current) => ({
                          ...current,
                          [item.id]: Math.min(9, (current[item.id] ?? 0) + 1),
                        }))
                      }
                    >
                      ＋
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex gap-1.5">
              <ModeButton current={mode} value="nearest" label="最近外送員" onChange={setMode} />
              <ModeButton current={mode} value="grab" label="搶單" onChange={setMode} />
            </div>
            <p className="text-[11px] text-zinc-400">金額 0，略過付款。送到目前位置。</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStore(null)}>
                返回店家
              </Button>
              <Button type="button" disabled={busy || totalQty < 1} onClick={() => void submit()}>
                送出訂單
              </Button>
            </div>
          </div>
        ) : (
          <ul className="space-y-1.5" data-testid="delivery-stores">
            {stores.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border border-white/10 px-3 py-2 text-left"
                  onClick={() => void openStore(item)}
                  disabled={busy}
                >
                  <span className="block text-sm font-semibold">{item.name}</span>
                  <span className="block text-[11px] text-zinc-400">{item.address}</span>
                </button>
              </li>
            ))}
            {stores.length === 0 && !message ? (
              <li className="text-xs text-zinc-400">正在讀取店家…</li>
            ) : null}
          </ul>
        )}
      </section>
    </div>
  );
}

function ModeButton({
  current,
  value,
  label,
  onChange,
}: {
  current: DispatchMode;
  value: DispatchMode;
  label: string;
  onChange: (mode: DispatchMode) => void;
}) {
  const selected = current === value;
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={
        selected
          ? "rounded-full bg-emerald-500/30 px-2.5 py-1 text-[11px] text-emerald-100"
          : "rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300"
      }
      onClick={() => onChange(value)}
    >
      {label}
    </button>
  );
}

function StatusBlock({
  view,
  busy,
  cancellable,
  onCancel,
  onNewOrder,
}: {
  view: CustomerOrderView;
  busy: boolean;
  cancellable: boolean;
  onCancel: () => void;
  onNewOrder: () => void;
}) {
  return (
    <div data-testid="delivery-status" className="space-y-2">
      <p className="text-base font-semibold">{view.statusLabel}</p>
      <p className="text-sm">{view.order.storeName}</p>
      <ul className="text-[12px] text-zinc-300">
        {view.order.lines.map((line) => (
          <li key={line.menuItemId}>
            {line.name} × {line.qty}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-zinc-400">
        {view.order.dispatchMode === "grab" ? "搶單" : "最近外送員"} · 金額 0 · 付款已略過
      </p>
      <p className="text-sm">
        {view.courier
          ? `${view.courier.displayName}${view.courier.location ? " · 位置更新中" : ""}`
          : "尚未有外送員接單"}
      </p>
      <p className="text-[11px] text-zinc-500">地圖：送＝外送員，收＝送達，店＝店家，客＝顧客</p>
      {cancellable ? (
        <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>
          取消訂單
        </Button>
      ) : null}
      {view.order.status === "delivered" || view.order.status === "cancelled" ? (
        <Button type="button" variant="outline" onClick={onNewOrder}>
          再下一筆
        </Button>
      ) : null}
    </div>
  );
}

function pinsFrom(view: CustomerOrderView | null): DeliveryMapPin[] {
  if (!view) return [];
  const pins: DeliveryMapPin[] = [
    {
      id: `pickup-${view.order.id}`,
      role: "pickup",
      lng: view.order.pickup.lng,
      lat: view.order.pickup.lat,
      label: `店 ${view.order.pickup.label}`,
    },
    {
      id: `dropoff-${view.order.id}`,
      role: "dropoff",
      lng: view.order.dropoff.lng,
      lat: view.order.dropoff.lat,
      label: `收 ${view.order.dropoff.label}`,
    },
  ];
  if (view.order.customerLocation) {
    pins.push({
      id: `customer-${view.order.id}`,
      role: "customer",
      lng: view.order.customerLocation.lng,
      lat: view.order.customerLocation.lat,
      label: "客 目前位置",
    });
  }
  if (view.courier?.location) {
    pins.push({
      id: `courier-${view.courier.id}`,
      role: "courier",
      lng: view.courier.location.lng,
      lat: view.courier.location.lat,
      label: `送 ${view.courier.displayName}`,
    });
  }
  return pins;
}
