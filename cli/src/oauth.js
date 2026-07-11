/* oauth.js — OAuth 2.1 (PKCE + loopback) against the Fons authorization server.
   The AS is Supabase's OAuth 2.1 Server, discovered from the Fons MCP protected-
   resource metadata. Public native-app client (no secret); dynamic registration on
   first login, cached thereafter. Pure Node built-ins — no dependencies.

   Flow: discover → (register once) → PKCE authorize in the browser → loopback
   redirect catches the code → exchange for tokens. Plus refresh().
*/
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

// Loopback redirect port (RFC 8252). Fixed so the registered redirect_uri is stable
// and the CLI client can be reused across logins; override with FONS_CLI_PORT.
const PORT = Number(process.env.FONS_CLI_PORT || 47100);
const redirectUri = () => `http://127.0.0.1:${PORT}/callback`;

function openBrowser(url) {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch { /* user can paste the URL */ }
}

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  let body = null;
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) {
    const msg = (body && (body.error_description || body.error || body.message)) || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

// Discover the authorization server from Fons' protected-resource metadata, then its
// RFC 8414 (path-aware) metadata document.
export async function discover(base) {
  const prm = await getJson(`${base}/.well-known/oauth-protected-resource`);
  const issuer = (prm.authorization_servers && prm.authorization_servers[0]) || "";
  if (!issuer) throw new Error("No authorization server advertised by Fons.");
  const u = new URL(issuer);
  const p = u.pathname.replace(/\/$/, "");
  const asMetaUrl = `${u.origin}/.well-known/oauth-authorization-server${p}`;
  const meta = await getJson(asMetaUrl);
  return { issuer, resource: prm.resource || `${base}/mcp`, meta };
}

// Dynamic Client Registration (public native client). Returns the new client_id.
export async function registerClient(meta) {
  if (!meta.registration_endpoint) {
    throw new Error("This server doesn't support dynamic registration — a client_id must be configured.");
  }
  const out = await getJson(meta.registration_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Fons CLI",
      redirect_uris: [redirectUri()],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "native",
      scope: "profile",
    }),
  });
  if (!out.client_id) throw new Error("Registration did not return a client_id.");
  return out.client_id;
}

// Build the PKCE authorization request shared by the loopback and manual flows.
function buildAuthRequest({ meta, clientId, resource }) {
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const state = b64url(randomBytes(16));
  const authUrl = new URL(meta.authorization_endpoint);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri());
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");
  authUrl.searchParams.set("scope", "profile");
  authUrl.searchParams.set("state", state);
  if (resource) authUrl.searchParams.set("resource", resource);
  return { authUrl, verifier, state };
}

// Run the full authorization-code + PKCE flow in the browser; resolve to a token set.
// Catches the redirect on a loopback server (RFC 8252) — this requires the browser to
// be on the SAME machine as the CLI. On a remote/SSH box the loopback is unreachable
// from the browser; use authorizeManual() (the --no-browser flow) instead.
export async function authorize({ meta, clientId, resource }) {
  const { authUrl, verifier, state } = buildAuthRequest({ meta, clientId, resource });

  const code = await new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${PORT}`);
      if (u.pathname !== "/callback") { res.statusCode = 404; res.end("Not found"); return; }
      const err = u.searchParams.get("error");
      const gotState = u.searchParams.get("state");
      const gotCode = u.searchParams.get("code");
      res.setHeader("Content-Type", "text/html");
      if (err) { res.end(`<p>Authorization failed: ${err}. You can close this window.</p>`); server.close(); return reject(new Error(`Authorization denied: ${err}`)); }
      if (!gotCode || gotState !== state) { res.end("<p>Invalid response. You can close this window.</p>"); server.close(); return reject(new Error("State mismatch or missing code.")); }
      res.end("<p>Fons CLI is now connected. You can close this window and return to your terminal.</p>");
      server.close();
      resolve(gotCode);
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => {
      process.stderr.write(`\nOpening your browser to authorize…\nIf it doesn't open, visit:\n${authUrl}\n\n`);
      openBrowser(authUrl.toString());
    });
    setTimeout(() => { try { server.close(); } catch { /* */ } reject(new Error("Timed out waiting for authorization (5 min).")); }, 5 * 60 * 1000).unref();
  });

  return exchange({ meta, clientId, body: { grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier }, resource });
}

// Manual / no-browser flow for remote or headless machines (SSH boxes, containers),
// where the loopback redirect can't reach the CLI. We print the authorize URL; the user
// opens it in a browser on any machine, approves, and pastes the resulting callback URL
// back here. The browser will show "This site can't be reached" at 127.0.0.1 — that is
// expected; the authorization code is in the address bar and that's all we need.
export async function authorizeManual({ meta, clientId, resource }) {
  const { authUrl, verifier, state } = buildAuthRequest({ meta, clientId, resource });
  process.stderr.write(
    `\nTo authorize, open this URL in a browser on ANY machine and approve access:\n\n${authUrl}\n\n` +
    `After approving, the browser will try to open\n` +
    `  http://127.0.0.1:${PORT}/callback?code=…\n` +
    `and show "This site can't be reached" — that is EXPECTED on a remote/SSH box.\n` +
    `Copy the full address from the browser's address bar and paste it below.\n\n`
  );
  const input = (await prompt("Paste the callback URL (or just the code): ")).trim();
  if (!input) throw new Error("No input — login aborted.");

  let code = input;
  let gotState = null;
  if (input.includes("code=") || input.includes("error=")) {
    const query = input.includes("?") ? input.slice(input.indexOf("?") + 1) : input;
    const params = new URLSearchParams(query);
    const err = params.get("error");
    if (err) throw new Error(`Authorization denied: ${err}`);
    code = params.get("code") || "";
    gotState = params.get("state");
  }
  if (!code) throw new Error("Couldn't find an authorization code in what you pasted.");
  if (gotState && gotState !== state) throw new Error("State mismatch — paste the URL from this same login attempt (re-run `fons login` and try again).");

  return exchange({ meta, clientId, body: { grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: verifier }, resource });
}

function prompt(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}

async function exchange({ meta, clientId, body, resource }) {
  const form = new URLSearchParams({ ...body, client_id: clientId });
  if (resource) form.set("resource", resource);
  const tok = await getJson(meta.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return normalizeTokens(tok);
}

export async function refresh({ meta, clientId, refreshToken, resource }) {
  return exchange({ meta, clientId, body: { grant_type: "refresh_token", refresh_token: refreshToken }, resource });
}

function normalizeTokens(t) {
  const expiresIn = Number(t.expires_in || 3600);
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token || null,
    // 30s safety margin so we refresh just before the server would reject.
    expires_at: Date.now() + Math.max(0, expiresIn - 30) * 1000,
  };
}
