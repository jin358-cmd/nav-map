"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DeliveryMap } from "@/components/delivery/delivery-map";
import { Button } from "@/components/ui/button";
import { TAINAN_CENTER } from "@/lib/constants";
import {
  courierAction,
  courierDeviceId,
  DELIVERY_POLL_MS,
  fetchCourierWork,
  setCourierOnline,
} from "@/lib/delivery/client";
import type { CourierOrderView, DeliveryMapPin } from "@/lib/delivery/types";

const DEMO_POINT = { lng: TAINAN_CENTER.lng + 0.004, lat: TAINAN_CENTER.lat + 0.003 };

function subscribeCourier() {
  return () => {};
}

function serverCourierId() {
  return "";
}

export function CourierDesk() {
  const actorId = useSyncExternalStore(subscribeCourier, courierDeviceId, serverCourierId);
  const [online, setOnline] = useState(false);
  const [self, setSelf] = useState<{ lng: number; lat: number } | null>(null);
  const [offers, setOffers] = useState<CourierOrderView[]>([]);
  const [active, setActive] = useState<CourierOrderView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [geoNote, setGeoNote] = useState<string | null>(null);
  const watchRef = useRef<number | null>(null);

  const publish = useCallback(
    async (lng: number, lat: number, heading?: number | null) => {
      if (!actorId) return;
      setSelf({ lng, lat });
      const result = await setCourierOnline(actorId, {
        online: true,
        lng,
        lat,
        heading: heading ?? null,
        displayName: "外送員",
      });
      if (result.ok !== true) {
        setMessage(result.message ?? "上線失敗。");
        return;
      }
      setOnline(true);
      setMessage(null);
    },
    [actorId],
  );

  const refresh = useCallback(async () => {
    if (!actorId) return;
    const result = await fetchCourierWork(actorId);
    if (result.ok !== true) {
      setMessage(result.message ?? "讀取訂單失敗。");
      return;
    }
    setOffers(result.offers);
    setActive(result.active);
  }, [actorId]);

  useEffect(() => {
    if (!online || !actorId) return;
    const kick = window.setTimeout(() => {
      void refresh();
    }, 0);
    const timer = window.setInterval(() => {
      void refresh();
    }, DELIVERY_POLL_MS);
    return () => {
      window.clearTimeout(kick);
      window.clearInterval(timer);
    };
  }, [actorId, online, refresh]);

  useEffect(() => {
    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, []);

  function goOnline() {
    if (!navigator.geolocation) {
      setGeoNote("這台裝置沒有定位，請改用臺南示範位置。");
      return;
    }
    setGeoNote("正在取得定位…");
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        setGeoNote(null);
        void publish(position.coords.longitude, position.coords.latitude, position.coords.heading);
      },
      () => setGeoNote("拿不到定位，可以改用臺南示範位置。"),
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 8000 },
    );
  }

  async function goOffline() {
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    setOnline(false);
    if (!actorId) return;
    await setCourierOnline(actorId, { online: false, lng: self?.lng, lat: self?.lat });
  }

  async function act(orderId: string, action: "accept" | "decline" | "pickup" | "deliver") {
    if (!actorId) return;
    setBusy(true);
    const result = await courierAction(actorId, orderId, action);
    setBusy(false);
    if (result.ok !== true) {
      setMessage(result.message ?? "操作失敗。");
    } else {
      setMessage(null);
    }
    await refresh();
  }

  const focus = active ?? offers[0] ?? null;
  const pins = useMemo(() => {
    const next: DeliveryMapPin[] = [];
    if (self) {
      next.push({ id: "self", role: "courier", lng: self.lng, lat: self.lat, label: "送 我的位置" });
    }
    if (focus) {
      next.push(
        {
          id: `pickup-${focus.order.id}`,
          role: "pickup",
          lng: focus.order.pickup.lng,
          lat: focus.order.pickup.lat,
          label: `店 ${focus.order.pickup.label}`,
        },
        {
          id: `dropoff-${focus.order.id}`,
          role: "dropoff",
          lng: focus.order.dropoff.lng,
          lat: focus.order.dropoff.lat,
          label: `收 ${focus.order.dropoff.label}`,
        },
      );
      if (focus.order.customerLocation) {
        next.push({
          id: `customer-${focus.order.id}`,
          role: "customer",
          lng: focus.order.customerLocation.lng,
          lat: focus.order.customerLocation.lat,
          label: "客 顧客位置",
        });
      }
    }
    return next;
  }, [focus, self]);

  return (
    <main data-testid="courier-desk" className="flex h-dvh flex-col bg-[#0b0d11] text-white landscape:flex-row">
      <div className="relative min-h-[42vh] flex-1 landscape:min-h-0">
        <DeliveryMap pins={pins} />
      </div>
      <section className="max-h-[58vh] overflow-y-auto border-white/10 p-3 landscape:max-h-none landscape:w-[min(24rem,42vw)] landscape:border-l">
        <h1 className="text-lg font-semibold">外送員</h1>
        <p className="mt-1 text-[11px] text-zinc-400">
          {actorId ? `代號 ${actorId.slice(0, 10)}…` : "正在準備這台裝置的代號"}
        </p>
        {geoNote ? <p className="mt-2 text-xs text-amber-200">{geoNote}</p> : null}
        {message ? (
          <p role="alert" className="mt-2 text-xs text-amber-200">
            {message}
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          {online ? (
            <Button type="button" variant="outline" onClick={() => void goOffline()}>
              下線
            </Button>
          ) : (
            <Button type="button" onClick={goOnline}>
              上線並分享位置
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            data-testid="courier-demo-location"
            onClick={() => void publish(DEMO_POINT.lng, DEMO_POINT.lat, null)}
          >
            用臺南示範位置上線
          </Button>
        </div>
        {active ? (
          <article className="mt-4 rounded-2xl border border-emerald-400/30 p-3" data-testid="courier-active">
            <h2 className="text-sm font-semibold">{active.statusLabel}</h2>
            <p className="mt-1 text-sm">{active.order.storeName}</p>
            <p className="text-[12px] text-zinc-300">{active.order.dropoff.label}</p>
            <div className="mt-2 flex gap-2">
              {active.order.status === "assigned" ? (
                <Button type="button" disabled={busy} onClick={() => void act(active.order.id, "pickup")}>
                  已取餐
                </Button>
              ) : null}
              {active.order.status === "picked_up" ? (
                <Button type="button" disabled={busy} onClick={() => void act(active.order.id, "deliver")}>
                  已送達
                </Button>
              ) : null}
            </div>
          </article>
        ) : null}
        <div className="mt-4 space-y-2" data-testid="courier-offers">
          {offers.length === 0 ? <p className="text-xs text-zinc-500">目前沒有可接的訂單。</p> : null}
          {offers.map((offer) => (
            <article key={offer.order.id} className="rounded-2xl border border-white/10 p-3" data-testid="courier-offer">
              <h2 className="text-sm font-semibold">
                {offer.order.dispatchMode === "grab" ? "搶單" : "指派給你"} · {offer.order.storeName}
              </h2>
              <p className="text-[12px] text-zinc-300">
                {offer.distanceMeters == null ? "距離計算中" : `約 ${Math.round(offer.distanceMeters)} 公尺`}
                {offer.offerExpiresAt ? ` · ${offer.offerExpiresAt.slice(11, 19)} 前` : ""}
              </p>
              <p className="text-[12px] text-zinc-400">送到 {offer.order.dropoff.label}</p>
              <div className="mt-2 flex gap-2">
                <Button type="button" disabled={busy} onClick={() => void act(offer.order.id, "accept")}>
                  接受
                </Button>
                {offer.order.dispatchMode === "nearest" ? (
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void act(offer.order.id, "decline")}
                  >
                    婉拒
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
