/**
 * 可恢復的 GCIS ingest cursor。禁止從 offset 0 重掃已成功區間。
 */
import { randomUUID } from "node:crypto";

export function emptyCheckpoint() {
  return {
    job_id: null,
    source_version: "",
    last_successful_offset: 0,
    last_successful_registry_id: "",
    batch_id: 0,
    status: "idle",
    started_at: null,
    updated_at: null,
    failed_reason: null,
  };
}

export function beginJob(existing, sourceVersion, now = new Date().toISOString()) {
  const prev = existing && typeof existing === "object" ? existing : emptyCheckpoint();
  if (prev.status === "running" || prev.status === "failed") {
    return {
      ...prev,
      source_version: sourceVersion || prev.source_version,
      status: "running",
      updated_at: now,
      failed_reason: null,
    };
  }
  return {
    job_id: `gcis-${now.slice(0, 10)}-${randomUUID().slice(0, 8)}`,
    source_version: sourceVersion,
    last_successful_offset: prev.last_successful_offset || 0,
    last_successful_registry_id: prev.last_successful_registry_id || "",
    batch_id: prev.batch_id || 0,
    status: "running",
    started_at: now,
    updated_at: now,
    failed_reason: null,
  };
}

export function sliceUnmatchedQueue(queue, checkpoint, limit) {
  const list = Array.isArray(queue) ? queue : [];
  let queueOffset = 0;
  const lastId = String(checkpoint?.last_successful_registry_id || "");
  if (lastId) {
    const idx = list.findIndex((shop) => String(shop.taxId) > lastId);
    queueOffset = idx === -1 ? list.length : idx;
  } else if (Number(checkpoint?.last_successful_offset) > 0) {
    queueOffset = Math.min(list.length, Number(checkpoint.last_successful_offset));
  }
  const size = limit < 0 ? list.length : Math.max(0, Number(limit) || 0);
  const globalStart = Number(checkpoint?.last_successful_offset) || 0;
  const take = size === 0 ? 0 : Math.min(size, Math.max(0, list.length - queueOffset));
  return {
    queue_offset: queueOffset,
    start_offset: globalStart,
    end_offset: globalStart + take,
    batch: take === 0 ? [] : list.slice(queueOffset, queueOffset + take),
  };
}

export function advanceCheckpoint(job, slice, lastTaxId, now = new Date().toISOString()) {
  return {
    ...job,
    batch_id: Number(job.batch_id || 0) + 1,
    last_successful_offset: slice.end_offset,
    last_successful_registry_id: lastTaxId || job.last_successful_registry_id || "",
    status: "running",
    updated_at: now,
    failed_reason: null,
  };
}

export function finishCheckpoint(job, status, failedReason = null, now = new Date().toISOString()) {
  return {
    ...job,
    status,
    updated_at: now,
    failed_reason: failedReason,
  };
}

export function newBatchRecord({
  job,
  slice,
  stats,
  durationMs,
  retryCount,
}) {
  return {
    job_id: job.job_id,
    batch_id: job.batch_id,
    start_offset: slice.start_offset,
    end_offset: slice.end_offset,
    total_input: slice.batch.length,
    matched: stats.matched ?? 0,
    unmatched: stats.unmatched ?? 0,
    skipped: stats.skipped ?? 0,
    failed: stats.failed ?? 0,
    duration: durationMs,
    retry_count: retryCount ?? 0,
    recorded_at: new Date().toISOString(),
  };
}
