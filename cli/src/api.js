/* api.js — authenticated calls to the Fons resource API (/api/v1).
   Ensures a non-expired access token (refreshing transparently), then attaches it
   as a Bearer. Pure Node built-ins (global fetch on Node 18+). */
import { loadConfig, saveConfig } from "./config.js";
import { discover, refresh } from "./oauth.js";

export const DEFAULT_BASE = process.env.FONS_BASE || "https://fons.vc";

// Return { base, token } with a valid access token, refreshing if it's expired.
export async function ensureToken() {
  const cfg = await loadConfig();
  if (!cfg.access_token) throw new Error("Not logged in. Run `fons login` first.");
  const base = cfg.base || DEFAULT_BASE;
  if (cfg.expires_at && Date.now() < cfg.expires_at) return { base, token: cfg.access_token };
  if (!cfg.refresh_token) throw new Error("Session expired. Run `fons login` again.");
  const { meta, resource } = await discover(base);
  const tok = await refresh({ meta, clientId: cfg.client_id, refreshToken: cfg.refresh_token, resource });
  await saveConfig({
    ...cfg,
    access_token: tok.access_token,
    refresh_token: tok.refresh_token || cfg.refresh_token,
    expires_at: tok.expires_at,
  });
  return { base, token: tok.access_token };
}

export async function apiFetch(path, { method = "GET", body } = {}) {
  const { base, token } = await ensureToken();
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty/non-JSON */ }
  if (res.status === 401) throw new Error("Unauthorized — run `fons login` again.");
  if (!res.ok) throw new Error((data && data.error) || `HTTP ${res.status}`);
  return data;
}
