/**
 * Shared NavPilot Supabase helpers for south-pilot scripts.
 * Never logs keys. Refuses GVG / rental project URLs.
 */

const FORBIDDEN = /gvg|rent|rental|租屋/i;

export function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host.endsWith(".supabase.co")) return host.split(".")[0];
    return host;
  } catch {
    return "";
  }
}

export function readSupabaseConfig() {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  if (!url && !key) {
    return { ok: false, reason: "missing_credentials", url: "", key: "", projectRef: "" };
  }
  if (!url || !key) {
    return {
      ok: false,
      reason: "incomplete_credentials",
      url: Boolean(url),
      key: Boolean(key),
      projectRef: projectRefFromUrl(url),
    };
  }
  if (FORBIDDEN.test(url)) {
    return { ok: false, reason: "forbidden_project", url, key: "", projectRef: projectRefFromUrl(url) };
  }
  return { ok: true, reason: null, url, key, projectRef: projectRefFromUrl(url) };
}

export function isProjectConfirmed(config) {
  const expected = (process.env.NAVPILOT_SUPABASE_PROJECT_REF || "").trim().toLowerCase();
  if (!expected || !config?.ok) return false;
  const actual = String(config.projectRef || "").toLowerCase();
  return actual === expected || config.url.toLowerCase().includes(expected);
}

export function applyBlockedReason(config) {
  if (!config?.ok) return config?.reason || "missing_credentials";
  if (!isProjectConfirmed(config)) return "project_ref_unconfirmed";
  return null;
}

export async function supabaseRest(config, path, init = {}) {
  const headers = {
    apikey: config.key,
    Authorization: `Bearer ${config.key}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const response = await fetch(`${config.url}${path}`, {
    method: init.method || "GET",
    headers,
    body: init.body,
    signal: init.signal || AbortSignal.timeout(init.timeoutMs || 45000),
  });
  const text = await response.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }
  return {
    ok: response.ok,
    status: response.status,
    text: text.slice(0, 500),
    json,
    contentRange: response.headers.get("content-range"),
  };
}

export function parseExactCount(contentRange, fallbackJson) {
  if (contentRange && contentRange.includes("/")) {
    const total = Number(contentRange.split("/")[1]);
    if (Number.isFinite(total)) return total;
  }
  if (Array.isArray(fallbackJson)) return fallbackJson.length;
  return null;
}

export async function countTable(config, table, filter = "") {
  const qs = filter ? `&${filter}` : "";
  const result = await supabaseRest(
    config,
    `/rest/v1/${table}?select=id${qs}`,
    {
      method: "GET",
      headers: { Prefer: "count=exact", Range: "0-0" },
      timeoutMs: 20000,
    },
  );
  return {
    ok: result.ok,
    status: result.status,
    count: parseExactCount(result.contentRange, result.json),
    text: result.text,
  };
}
