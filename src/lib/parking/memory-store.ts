import type { NormalizedParkingLot } from "@/lib/parking/schema";

type MemorySnapshot = {
  lots: NormalizedParkingLot[];
  fetchedAt: number;
  lotSyncedAt: number;
  availSyncedAt: number;
};

const snapshots = new Map<string, MemorySnapshot>();

export function readParkingMemory(source: string) {
  return snapshots.get(source) ?? null;
}

export function writeParkingMemory(
  source: string,
  lots: NormalizedParkingLot[],
  kind: "lots" | "availability" | "both" = "both",
) {
  const now = Date.now();
  const previous = snapshots.get(source);
  snapshots.set(source, {
    lots,
    fetchedAt: now,
    lotSyncedAt:
      kind === "availability" ? (previous?.lotSyncedAt ?? now) : now,
    availSyncedAt: kind === "lots" ? (previous?.availSyncedAt ?? now) : now,
  });
}
