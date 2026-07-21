#!/usr/bin/env node
/* ============================================================================
   fons — the Fons CLI. Manage your Fons profile from the terminal.
   ----------------------------------------------------------------------------
   Rides the SAME doorway as the MCP server: OAuth 2.1 (PKCE) against Supabase's
   OAuth 2.1 Server for a Bearer token, then the /api/v1 resource API (RLS-scoped
   to you). Zero dependencies — Node 18+ built-ins only.

   Commands:
     fons login [--base <url>]      Authorize in the browser and store a token.
     fons logout                    Remove the stored token.
     fons whoami                    Show which account you're connected as.
     fons profile get [--json]      Print your profile.
     fons profile set [flags]       Update profile fields (scalars + --*-json for
                                    structured fields: current-role, job-history,
                                    links, faq, certifications, field-visibility).
                                    See `fons help`.
     fons connections               List verified connections (✓).
     fons connect <provider>        Print a browser link to verify an account.
     fons disconnect <provider>     Remove a verified connection.
   ========================================================================== */
import { loadConfig, saveConfig, clearConfig, configPath } from "../src/config.js";
import { discover, registerClient, authorize, authorizeManual } from "../src/oauth.js";
import { apiFetch, DEFAULT_BASE } from "../src/api.js";

// --- tiny arg parser: --flag value, repeatable flags collected into arrays, --bool.
function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      const isBool = next === undefined || next.startsWith("--");
      const val = isBool ? true : (i++, next);
      if (out[key] === undefined) out[key] = val;
      else out[key] = Array.isArray(out[key]) ? [...out[key], val] : [out[key], val];
    } else {
      out._.push(a);
    }
  }
  return out;
}
const arr = (v) => (v === undefined ? undefined : Array.isArray(v) ? v : [v]);

function fail(msg) { process.stderr.write(`fons: ${msg}\n`); process.exit(1); }

// Parse a --*-json flag value → JS value, or fail with a clear message.
function parseJsonFlag(value, flag) {
  if (typeof value !== "string") fail(`${flag} needs a JSON value.`);
  try { return JSON.parse(value); }
  catch { fail(`${flag} isn't valid JSON. Wrap it in single quotes, e.g. ${flag} '[{"title":"Founder"}]'.`); }
}

// Verify-by-OAuth Connections the CLI can act on. Keep in lockstep with
// scripts/connect-providers.js on the server (the bridge + the unlink allowlist).
const CONNECT_PROVIDERS = ["linkedin", "github", "x", "twitch", "discord", "youtube"];
const DISCONNECT_PROVIDERS = ["linkedin", "github", "x", "twitch", "discord"];

async function cmdLogin(args) {
  const base = (typeof args.base === "string" && args.base) || DEFAULT_BASE;
  const prev = await loadConfig();
  process.stderr.write(`Discovering Fons at ${base}…\n`);
  const { issuer, resource, meta } = await discover(base);
  let clientId = prev.client_id;
  if (!clientId || prev.issuer !== issuer || prev.base !== base) {
    process.stderr.write("Registering this CLI with the authorization server…\n");
    clientId = await registerClient(meta);
  }
  // On a remote/SSH box the browser can't reach the CLI's loopback redirect, so default
  // to the paste-back flow when an SSH session is detected. --browser forces loopback
  // (e.g. after forwarding the port); --no-browser/--manual forces paste-back anywhere.
  const isRemote = Boolean(process.env.SSH_CONNECTION || process.env.SSH_TTY);
  const useManual = Boolean(args["no-browser"] || args.manual || args.paste || (!args.browser && isRemote));
  if (useManual && isRemote && !args["no-browser"] && !args.manual && !args.paste) {
    process.stderr.write("Remote session detected — using the paste-back flow (no loopback). Use --browser to force the local browser flow.\n");
  }
  const tok = useManual
    ? await authorizeManual({ meta, clientId, resource })
    : await authorize({ meta, clientId, resource });
  await saveConfig({
    base, issuer, client_id: clientId,
    access_token: tok.access_token, refresh_token: tok.refresh_token, expires_at: tok.expires_at,
  });
  const { profile: p = {} } = await apiFetch("/api/v1/profile");
  process.stdout.write(`Logged in as ${p.name || p.email || "your account"}${p.handle ? ` (@${p.handle})` : ""}.\n`);
  process.stderr.write(`Token stored at ${configPath} (mode 600).\n`);
}

async function cmdLogout() {
  await clearConfig();
  process.stdout.write("Logged out — local token removed.\n");
  process.stderr.write("To fully revoke access, also remove this app under Settings → Connected apps on fons.vc.\n");
}

async function cmdWhoami() {
  const { profile: p = {} } = await apiFetch("/api/v1/profile");
  process.stdout.write(`${p.name || "(no name)"}${p.handle ? ` · @${p.handle}` : ""} · ${p.email || ""}\n`);
}

async function cmdProfileGet(args) {
  const { profile: p = {} } = await apiFetch("/api/v1/profile");
  if (args.json) { process.stdout.write(JSON.stringify(p, null, 2) + "\n"); return; }
  const line = (label, v) => { if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) process.stdout.write(`${label.padEnd(13)} ${Array.isArray(v) ? v.join(", ") : v}\n`); };
  line("name", p.name);
  line("handle", p.handle ? `@${p.handle}` : "");
  line("email", p.email);
  line("headline", p.headline);
  line("location", p.location);
  line("bio", p.bio);
  line("sectors", p.sectors);   // closed vocab, ≤3 (0157)
  line("skills", p.skills);     // open vocab, ≤12 (0157)
  line("open to", p.open_to);
  // call_access (0162) — WHO may request a call. A permission, not a status.
  line("call requests", p.call_access || "open");
  // the headline status (0154/0156) — promoted action, freehand note, or both
  line("status", p.primary_status ? p.primary_status + (p.status_note ? ` — ${p.status_note}` : "") : (p.status_note || ""));
  // Display links: "label: url — description" (description optional, 0150 era).
  const lks = Array.isArray(p.links) ? p.links : [];
  line("links", lks.map((k) => (k.label ? `${k.label}: ${k.url}` : k.url) + (k.description ? ` — ${k.description}` : "")).filter(Boolean));
  // FAQ is an ordered list of {q, a}; show the questions so `get` reflects what's set.
  const faq = Array.isArray(p.faq) ? p.faq : [];
  line("faq", faq.map((f) => (f && f.q) || "").filter(Boolean));
  // Credentials: catalogue slug (or the free-text name for "other") + "(linked)" if a
  // verification URL is set. Slugs resolve to full names on the web/.md via the catalogue.
  const certs = Array.isArray(p.certifications) ? p.certifications : [];
  line("credentials", certs.map((c) => {
    if (!c || !c.slug) return "";
    const label = c.slug === "other" ? (c.name || "other") : c.slug;
    return label + (c.url ? " (linked)" : "");
  }).filter(Boolean));
  // Channels proven by an OAuth handshake (drives the public ✓ and the .md verified_via).
  // Same provider ordering as the .md generator so the CLI, the .md, and the profile agree.
  const vc = (p.verified_connections && typeof p.verified_connections === "object") ? p.verified_connections : {};
  line("verified", ["linkedin", "x", "github", "twitch", "discord", "youtube"].filter((k) => vc[k] === true));
  line("visibility", p.visibility);
  process.stdout.write("\nTip: `fons profile get --json` for the full structured profile.\n");
}

async function cmdProfileSet(args) {
  const patch = {};
  if (typeof args.name === "string") patch.name = args.name;
  if (typeof args.headline === "string") patch.headline = args.headline;
  if (typeof args.bio === "string") patch.bio = args.bio;
  if (typeof args.location === "string") patch.location = args.location;
  if (typeof args.linkedin === "string") patch.linkedin = args.linkedin;
  if (typeof args.youtube === "string") patch.youtube = args.youtube;
  if (typeof args.visibility === "string") patch.visibility = args.visibility;
  if (args.sector !== undefined) patch.sectors = arr(args.sector);   // ≤3 directory sector slugs
  if (args.skill !== undefined) patch.skills = arr(args.skill);      // ≤12 free-text skills
  if (args["open-to"] !== undefined) patch.open_to = arr(args["open-to"]);
  // Who may request a call with you: open | investors | closed (0162).
  if (typeof args["call-access"] === "string") patch.call_access = args["call-access"];
  // The headline status (0154): one open_to value promoted to the top of the page;
  // "" clears it. Server-coerced to null unless it's in the open_to list.
  if (typeof args.status === "string") patch.primary_status = args.status;
  if (typeof args["status-note"] === "string") patch.status_note = args["status-note"];
  // Structured fields take JSON so the shape stays explicit (the server re-validates).
  if (args["current-role-json"] !== undefined) patch.current_role = parseJsonFlag(args["current-role-json"], "--current-role-json");
  if (args["job-history-json"] !== undefined) patch.job_history = parseJsonFlag(args["job-history-json"], "--job-history-json");
  if (args["links-json"] !== undefined) patch.links = parseJsonFlag(args["links-json"], "--links-json");
  if (args["faq-json"] !== undefined) patch.faq = parseJsonFlag(args["faq-json"], "--faq-json");
  if (args["certifications-json"] !== undefined) patch.certifications = parseJsonFlag(args["certifications-json"], "--certifications-json");
  if (args["field-visibility-json"] !== undefined) patch.field_visibility = parseJsonFlag(args["field-visibility-json"], "--field-visibility-json");
  if (!Object.keys(patch).length) {
    fail("nothing to set. Try --headline, --bio, --location, --name, --linkedin, --youtube, --visibility, --call-access, --sector, --skill, --open-to, or a --*-json flag (see `fons help`).");
  }
  await apiFetch("/api/v1/profile", { method: "PATCH", body: patch });
  process.stdout.write(`Updated: ${Object.keys(patch).join(", ")}.\n`);
}

// Freshness wording from the server staleness tier (company-feed.js computeFreshness) —
// mirrors the workspace + public stamp so the CLI reads the same.
function freshWords(fresh) {
  if (!fresh || !fresh.last) return "no activity yet";
  switch (fresh.tier) {
    case "fresh": return "active this week";
    case "7":     return "last active over a week ago";
    case "14":    return "no activity in 14+ days";
    default:      return "no activity in 30+ days";
  }
}

// Human label for a verified-revenue provider (CONN-1; V1 = Stripe).
const PROV_LABEL = { stripe: "Stripe" };
function provLabel(p) { return PROV_LABEL[p] || (p ? String(p).charAt(0).toUpperCase() + String(p).slice(1) : "provider"); }

// Company (Phase 1: read-only — company edits happen on fons.vc). One company in
// v1, but the API returns a list; print each. Never any scoring data (IP firewall).
async function cmdCompany(args) {
  const { companies = [] } = await apiFetch("/api/v1/company");
  if (args.json) { process.stdout.write(JSON.stringify(companies, null, 2) + "\n"); return; }
  if (!companies.length) {
    process.stdout.write("No company yet — create one at https://fons.vc/company (Fons Pro, £49/month per company).\n");
    return;
  }
  const line = (label, v) => { if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) process.stdout.write(`${label.padEnd(13)} ${Array.isArray(v) ? v.join(", ") : v}\n`); };
  companies.forEach((c, i) => {
    if (i) process.stdout.write("\n");
    line("name", c.name);
    line("handle", c.slug ? `fons.vc/c/${c.slug}` : "");
    line("tagline", c.tagline);
    line("website", c.website);
    line("logo", c.logo_path ? (String(c.logo_path).startsWith("/") ? `https://fons.vc${c.logo_path}` : c.logo_path) : "");
    line("sector", c.sector_id);
    line("stage", c.stage);
    line("biz model", c.business_model);
    line("raise status", c.raise_status);
    line("target inv", c.target_investor_type);
    line("location", c.location);
    line("founded", c.founded_year);
    line("team", c.team_size);
    line("about", c.description);
    line("problem", c.problem);
    line("solution", c.solution);
    line("why now", c.why_now);
    line("entity", c.entity_type);
    line("company no.", c.company_number);
    line("incorporated", c.incorporation_year);
    line("reg. address", c.registered_address);
    line("certs", (Array.isArray(c.certifications) ? c.certifications : []).map((x) => x.id + (x.url ? " (linked)" : "")));
    line("connections", (Array.isArray(c.connections) ? c.connections : []).map((x) => (x.url || x.id) + (x.verified && x.verified.method === "domain" ? " (domain-matched)" : "")));
    line("links", (Array.isArray(c.links) ? c.links : []).map((k) => k.url));
    const pr = c.product || {};
    line("product", pr.name);
    line("pr page", pr.page_live && pr.slug ? `fons.vc/p/${pr.slug}` : "");
    line("pr tagline", pr.tagline);
    line("pr stage", pr.stage);
    line("pr site", pr.website);
    line("pr logo", pr.logo_path ? (String(pr.logo_path).startsWith("/") ? `https://fons.vc${pr.logo_path}` : pr.logo_path) : "");
    line("pr pricing", pr.pricing);
    line("pr launched", pr.launched_on);
    line("pr topics", Array.isArray(pr.topics) ? pr.topics : []);
    line("pr video", pr.video_url);
    line("pr platforms", (Array.isArray(pr.connections) ? pr.connections : []).map((x) => x.url || x.id));
    line("pr links", (Array.isArray(pr.distribution_links) ? pr.distribution_links : []).map((x) => x.label ? `${x.label}: ${x.url}` : x.url));
    line("visibility", c.public_listing ? "public" : "unlisted");
    line("primary", c.is_primary ? "yes" : "");
    // Data room (DR-1 Phase C) — owner view: domain verification, completeness %,
    // freshness, and the Key Metrics rows (all visibilities — your own data). Never
    // a score (IP firewall). Freshness wording mirrors the workspace stamp.
    const dr = c.data_room || {};
    if (dr.domain && dr.domain.verified) {
      line("domain", `verified${dr.domain.registered_at ? ` · registered ${dr.domain.registered_at}` : ""}`);
    }
    // Verified-revenue connections (CONN-1) — owner view: the "Stripe verified" badge
    // source(s) that publish publicly, plus any connection's status so the owner sees a
    // test-mode / badge-off / errored connection too. Never a token/value (IP firewall).
    const vsrc = Array.isArray(dr.verified_sources) ? dr.verified_sources : [];
    vsrc.forEach((s) => line("verified revenue", `${provLabel(s.provider)}${s.last_synced_at ? ` · last checked ${String(s.last_synced_at).slice(0, 10)}` : ""}`));
    (Array.isArray(dr.connections) ? dr.connections : [])
      .filter((cn) => !(cn.status === "active" && cn.badge_public === true && cn.livemode === true))
      .forEach((cn) => line("connection", `${provLabel(cn.provider)} · ${cn.status}${cn.livemode === false ? " · test-mode" : ""}${cn.badge_public === false ? " · badge off" : ""}`));
    if (typeof dr.completion_pct === "number") line("completeness", `${dr.completion_pct}%`);
    if (dr.freshness && dr.freshness.last) line("last active", freshWords(dr.freshness));
    const ms = Array.isArray(dr.metrics) ? dr.metrics : [];
    if (ms.length) {
      process.stdout.write("metrics\n");
      ms.forEach((m) => process.stdout.write(`  ${String(m.label || m.metric_key).padEnd(16)} ${m.display}  (${m.provenance_label}, ${m.visibility})\n`));
    }
    // TEAM-1 connected team — linked members with role + corroboration. Mutual-consent
    // (each accepted an invite); never a score. Pending invites live in `--json` only.
    const tm = c.team && Array.isArray(c.team.members) ? c.team.members : [];
    if (tm.length) {
      process.stdout.write("team\n");
      tm.forEach((m) => {
        const badges = [m.domain_corroborated ? "domain-verified" : null, m.registry_corroborated ? "registered director" : null].filter(Boolean);
        const who = m.handle ? `@${m.handle}` : (m.name || "member");
        process.stdout.write(`  ${String(who).padEnd(16)} ${m.role}${m.is_primary ? " · owner" : ""}${badges.length ? " · " + badges.join(" · ") : ""}\n`);
      });
    }
  });
  process.stdout.write("\nTip: `fons company set --tagline \"…\"` to edit; `fons company --json` for the full structured record.\n");
}

// Product — the 1:1 product as its own entity (0064/0065). Read + write through
// /api/v1/product (updateProductCore server-side — the same validators + slug mint
// as the website's Product tab). Never any scoring data (IP firewall).
async function cmdProductGet(args) {
  const { products = [] } = await apiFetch("/api/v1/product");
  if (args.json) { process.stdout.write(JSON.stringify(products, null, 2) + "\n"); return; }
  if (!products.length) {
    process.stdout.write("No product yet — it's created with your company at https://fons.vc/company (Fons Pro, £49/month per company).\n");
    return;
  }
  const line = (label, v) => { if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) process.stdout.write(`${label.padEnd(13)} ${Array.isArray(v) ? v.join(", ") : v}\n`); };
  products.forEach((p, i) => {
    if (i) process.stdout.write("\n");
    line("name", p.name);
    line("company", p.company ? `${p.company.name} (fons.vc/c/${p.company.slug})` : "");
    line("page", p.page_live && p.slug ? `fons.vc/p/${p.slug}` : "(unpublished — needs name + tagline + description)");
    line("tagline", p.tagline);
    line("stage", p.stage);
    line("website", p.website);
    line("logo", p.logo_path ? (String(p.logo_path).startsWith("/") ? `https://fons.vc${p.logo_path}` : p.logo_path) : "");
    line("pricing", p.pricing);
    line("launched", p.launched_on);
    line("topics", Array.isArray(p.topics) ? p.topics : []);
    line("video", p.video_url);
    line("about", p.description);
    line("platforms", (Array.isArray(p.connections) ? p.connections : []).map((x) => (x.url || x.id) + (x.verified && x.verified.method === "domain" ? " (domain-matched)" : "")));
    line("other links", (Array.isArray(p.distribution_links) ? p.distribution_links : []).map((x) => x.label ? `${x.label}: ${x.url}` : x.url));
  });
  process.stdout.write("\nTip: `fons product set --tagline \"…\"` to edit; `fons product get --json` for the full record.\n");
}

async function cmdProductSet(args) {
  const product = {};
  if (typeof args.name === "string") product.name = args.name;
  if (typeof args.tagline === "string") product.tagline = args.tagline;
  if (typeof args.stage === "string") product.stage = args.stage;
  if (typeof args.about === "string") product.description = args.about;
  if (typeof args.description === "string") product.description = args.description;
  if (typeof args.website === "string") product.website = args.website;
  if (typeof args.pricing === "string") product.pricing = args.pricing;
  if (typeof args.launched === "string") product.launched_on = args.launched;
  if (typeof args.video === "string") product.video_url = args.video;
  if (args.topic !== undefined) product.topics = arr(args.topic);
  if (args["topics-json"] !== undefined) product.topics = parseJsonFlag(args["topics-json"], "--topics-json");
  if (args["connections-json"] !== undefined) product.connections = parseJsonFlag(args["connections-json"], "--connections-json");
  if (args["distribution-links-json"] !== undefined) product.distribution_links = parseJsonFlag(args["distribution-links-json"], "--distribution-links-json");
  if (!Object.keys(product).length) {
    fail("nothing to set. Try --tagline, --about, --name, --stage, --website, --pricing, --launched, --video, --topic, or a --*-json flag (see `fons help`).");
  }
  const body = { product };
  if (typeof args.company === "string") body.company = args.company;
  const out = await apiFetch("/api/v1/product", { method: "PATCH", body });
  const p = (out && out.product) || {};
  process.stdout.write(`Updated: ${Object.keys(product).join(", ")}.\n`);
  process.stdout.write(p.page_live && p.slug
    ? `Public page: https://fons.vc/p/${p.slug}\n`
    : "Public page unpublished — it goes live once name, tagline and description are all set.\n");
}

// Readiness (Phase 2: read-only) — the Decision Engine checklist for your company.
// --company <slug> picks among your companies (defaults to the oldest).
async function cmdReadiness(args) {
  const q = typeof args.company === "string" && args.company ? `?company=${encodeURIComponent(args.company)}` : "";
  const out = await apiFetch(`/api/v1/readiness${q}`);
  if (args.json) { process.stdout.write(JSON.stringify(out, null, 2) + "\n"); return; }
  if (!out.company) {
    process.stdout.write("No company yet — create one at https://fons.vc/company (Fons Pro, £49/month per company).\n");
    return;
  }
  const r = out.readiness;
  process.stdout.write(`${out.company.name} — readiness ${Math.round((r.completeness || 0) * 100)}%\n\n`);
  for (const key of ["must", "should", "could"]) {
    const b = r.moscow[key];
    const title = { must: "Must have", should: "Should have", could: "Could have" }[key];
    process.stdout.write(`${title}: ${b.captured}/${b.total} captured` + (b.unclear ? ` (${b.unclear} to confirm)` : "") + "\n");
  }
  if (Array.isArray(r.next) && r.next.length) {
    process.stdout.write("\nNext up:\n");
    for (const n of r.next.slice(0, 5)) process.stdout.write(`  · ${n.label}  (${n.pillar})\n`);
  }
  process.stdout.write("\nAnswer these on https://fons.vc/company. Tip: `fons readiness --json` for the full checklist.\n");
}

/* ---- AGNT-3 Phase 2/3 — company data-room commands -------------------------
   All through /api/v1 (the same shared cores as the website + MCP). Writes need
   an owner/manager seat on a paid company — the server's refusal message is
   relayed verbatim. `--company <slug>` picks among your companies everywhere. */
const coQ = (args, extra = {}) => {
  const p = new URLSearchParams();
  if (typeof args.company === "string" && args.company) p.set("company", args.company);
  for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== null && v !== "") p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : "";
};

async function cmdCompanySet(args) {
  const patch = {};
  const scalar = {
    name: "name", website: "website", tagline: "tagline", about: "description",
    description: "description", location: "location", stage: "stage", sector: "sector_id",
    "business-model": "business_model", "raise-status": "raise_status",
    "target-investor": "target_investor_type", problem: "problem", solution: "solution",
    "why-now": "why_now", entity: "entity_type", "company-number": "company_number",
    address: "registered_address",
  };
  for (const [flag, field] of Object.entries(scalar)) {
    if (typeof args[flag] === "string") patch[field] = args[flag];
  }
  if (args.founded !== undefined) patch.founded_year = args.founded === "" ? null : Number(args.founded);
  if (args["team-size"] !== undefined) patch.team_size = args["team-size"];
  if (args["links-json"] !== undefined) patch.links = parseJsonFlag(args["links-json"], "--links-json");
  if (args["connections-json"] !== undefined) patch.connections = parseJsonFlag(args["connections-json"], "--connections-json");
  if (args["certifications-json"] !== undefined) patch.certifications = parseJsonFlag(args["certifications-json"], "--certifications-json");
  if (args["grants-json"] !== undefined) patch.grants = parseJsonFlag(args["grants-json"], "--grants-json");
  if (!Object.keys(patch).length) {
    fail("nothing to set. Try --name, --website, --tagline, --about, --location, --stage, --problem, --solution, --why-now, or a --*-json flag (see `fons help`).");
  }
  const body = { ...patch };
  if (typeof args.company === "string") body.company = args.company;
  const out = await apiFetch("/api/v1/company", { method: "PATCH", body });
  const c = (out && out.company) || {};
  process.stdout.write(`Updated: ${Object.keys(patch).join(", ")}${c.name ? ` on ${c.name}` : ""}.\n`);
  if (patch.website || patch["company_number"]) {
    process.stdout.write("Note: changing the website/company number voids the matching verification badge — re-verify on https://fons.vc/company.\n");
  }
}

async function cmdMetrics(args) {
  const out = await apiFetch(`/api/v1/metrics${coQ(args)}`);
  if (args.json) { process.stdout.write(JSON.stringify(out, null, 2) + "\n"); return; }
  const ms = Array.isArray(out.metrics) ? out.metrics : [];
  if (!ms.length) { process.stdout.write("No metrics yet. Add one: `fons metric set --key mrr --value 1000 --unit GBP`.\n"); return; }
  for (const m of ms) {
    process.stdout.write(`${String(m.metric_key).padEnd(20)} ${String(m.value).padEnd(12)} ${(m.unit || "").padEnd(6)} ${(m.period || "").padEnd(14)} ${m.provenance}, ${m.visibility}\n`);
  }
  process.stdout.write("\n'connected' rows are connector-verified; 'founder' rows are self-entered.\n");
}

async function cmdMetricSet(args) {
  if (typeof args.key !== "string" || args.value === undefined) fail("need --key <metric_key> and --value <number>.");
  const body = { metric_key: args.key, value: Number(args.value) };
  for (const k of ["unit", "period", "visibility", "source"]) if (typeof args[k] === "string") body[k] = args[k];
  if (typeof args.company === "string") body.company = args.company;
  const out = await apiFetch("/api/v1/metrics", { method: "PUT", body });
  const m = out.metric || {};
  process.stdout.write(`${out.event === "metric_added" ? "Recorded" : "Updated"}: ${m.metric_key} = ${m.value}${m.unit ? ` ${m.unit}` : ""} (${m.provenance}, ${m.visibility}).\n`);
}

async function cmdMetricRm(args) {
  if (typeof args.key !== "string") fail("need --key <metric_key>.");
  await apiFetch(`/api/v1/metrics${coQ(args, { key: args.key })}`, { method: "DELETE" });
  process.stdout.write(`Removed ${args.key}.\n`);
}

async function cmdDocuments(args) {
  const out = await apiFetch(`/api/v1/documents${coQ(args, { slot: typeof args.slot === "string" ? args.slot : undefined })}`);
  if (args.json) { process.stdout.write(JSON.stringify(out, null, 2) + "\n"); return; }
  const docs = Array.isArray(out.documents) ? out.documents : [];
  const filled = new Set(docs.map((d) => d.slot));
  for (const d of docs) {
    const kb = d.size_bytes ? `${Math.round(d.size_bytes / 1024)} KB` : "";
    process.stdout.write(`${String(d.slot).padEnd(22)} ${String(d.filename).padEnd(36)} ${kb}\n`);
  }
  const empty = (out.slots || []).filter((s) => !filled.has(s));
  if (empty.length) process.stdout.write(`\nEmpty slots: ${empty.join(", ")}\n`);
  process.stdout.write("Upload/download happens on https://fons.vc/company (files never transit the CLI).\n");
}

async function cmdFeed(args) {
  const out = await apiFetch(`/api/v1/feed${coQ(args, { limit: args.limit })}`);
  if (args.json) { process.stdout.write(JSON.stringify(out, null, 2) + "\n"); return; }
  const evs = Array.isArray(out.events) ? out.events : [];
  if (!evs.length) { process.stdout.write("No feed activity yet.\n"); return; }
  for (const e of evs) {
    const when = String(e.created_at).slice(0, 10);
    const what = e.event_type === "note" ? `note: ${(e.payload && e.payload.text) || ""}` : `${e.event_type} ${e.payload && e.payload.metric_key ? `(${e.payload.metric_key})` : e.payload && e.payload.filename ? `(${e.payload.filename})` : ""}`;
    process.stdout.write(`${when}  ${what}\n`);
  }
}

async function cmdFeedPost(args) {
  const text = typeof args.text === "string" ? args.text : args._.slice(2).join(" ");
  if (!text) fail('need the note text: `fons feed post "Closed our 10th customer"`.');
  const body = { text };
  if (typeof args.company === "string") body.company = args.company;
  await apiFetch("/api/v1/feed", { method: "POST", body });
  process.stdout.write("Note posted (the feed is append-only — notes are permanent).\n");
}

async function cmdConnectors(args) {
  const out = await apiFetch(`/api/v1/company-connections${coQ(args)}`);
  if (args.json) { process.stdout.write(JSON.stringify(out, null, 2) + "\n"); return; }
  const conns = Array.isArray(out.connections) ? out.connections : [];
  if (conns.length) {
    for (const c of conns) {
      process.stdout.write(`${String(c.provider).padEnd(16)} ${String(c.status).padEnd(10)} ${c.last_synced_at ? `synced ${String(c.last_synced_at).slice(0, 10)}` : ""}${c.last_error ? `  ⚠ ${c.last_error}` : ""}\n`);
    }
  } else {
    process.stdout.write("No data sources connected yet.\n");
  }
  const reg = Array.isArray(out.registry) ? out.registry : [];
  if (reg.length) process.stdout.write(`\nConnectable: ${reg.map((r) => r.provider).join(", ")}\nConnect with \`fons connectors connect <provider>\`.\n`);
}

async function cmdConnectorSync(args) {
  const id = args._[2] || args.id;
  if (!id) fail("need the connection id: `fons connectors sync <id>` (ids from `fons connectors --json`).");
  await apiFetch("/api/v1/company-connections/sync", { method: "POST", body: { connection_id: id, ...(typeof args.company === "string" ? { company: args.company } : {}) } });
  process.stdout.write("Refresh queued — verified metrics update within a few minutes.\n");
}

async function cmdConnectorConnect(args) {
  const provider = args._[2] || args.provider;
  if (!provider) fail("need the provider: `fons connectors connect stripe`.");
  const out = await apiFetch("/api/v1/company-connections/connect", { method: "POST", body: { provider, ...(typeof args.company === "string" ? { company: args.company } : {}) } });
  process.stdout.write(`Open this in your browser to connect ${out.provider}:\n\n  ${out.url}\n\n${out.instructions}\n`);
}

async function cmdConnections() {
  const { connections = [] } = await apiFetch("/api/v1/connections");
  for (const c of connections) {
    const mark = c.connected ? "✓" : "·";
    const tail = c.connected ? (c.url ? `  ${c.url}` : "  (verified)") : "  not connected";
    process.stdout.write(`${mark} ${(c.label || c.provider).padEnd(10)}${tail}\n`);
  }
  process.stdout.write("\nConnect one with `fons connect <provider>`.\n");
}

async function cmdConnect(args) {
  const provider = (args._[1] || "").toString().trim().toLowerCase();
  if (!provider) fail(`which account? Try: ${CONNECT_PROVIDERS.join(", ")}.`);
  if (!CONNECT_PROVIDERS.includes(provider)) {
    fail(`can't connect "${provider}". Choose one of: ${CONNECT_PROVIDERS.join(", ")}.`);
  }
  // A Connection is proof-of-ownership, so it's never an API write: print the bridge URL
  // the user opens in their logged-in browser to approve the OAuth link.
  const cfg = await loadConfig();
  const base = cfg.base || DEFAULT_BASE;
  const url = `${base.replace(/\/$/, "")}/profile?connect=${provider}`;
  process.stdout.write(`Open this in your browser to connect ${provider} (approve in your logged-in Fons session):\n\n  ${url}\n\nThen run \`fons connections\` to confirm the ✓.\n`);
}

async function cmdDisconnect(args) {
  const provider = (args._[1] || "").toString().trim().toLowerCase();
  if (!provider) fail(`which account? Try: ${DISCONNECT_PROVIDERS.join(", ")}.`);
  if (!DISCONNECT_PROVIDERS.includes(provider)) {
    fail(`can't disconnect "${provider}" from the CLI. Choose one of: ${DISCONNECT_PROVIDERS.join(", ")}. (YouTube is managed on fons.vc.)`);
  }
  await apiFetch(`/api/v1/disconnect/${encodeURIComponent(provider)}`, { method: "POST" });
  process.stdout.write(`Disconnected ${provider} — its ✓ has been removed from your profile.\n`);
}

/* ---- NET-3: member search + call invites (the network loop) ---------------- */

const fmtWhen = (iso) => {
  const t = Date.parse(iso || "");
  return Number.isFinite(t) ? new Date(t).toLocaleString() : String(iso || "");
};

async function cmdSearch(args) {
  const qs = new URLSearchParams();
  if (args._[1] && typeof args._[1] === "string") qs.set("q", args._[1]);
  if (typeof args.q === "string") qs.set("q", args.q);
  for (const v of arr(args["open-to"]) || []) qs.append("open_to", v);
  for (const v of arr(args.sector) || []) qs.append("sector", v);
  if (typeof args.location === "string") qs.set("location", args.location);
  if (typeof args.limit === "string") qs.set("limit", args.limit);
  const data = await apiFetch(`/api/v1/search/profiles?${qs.toString()}`);
  if (args.json) { process.stdout.write(JSON.stringify(data, null, 2) + "\n"); return; }
  const rows = data.profiles || [];
  if (!rows.length) { process.stdout.write("No members matched — loosen the filters.\n"); return; }
  for (const p of rows) {
    const bits = [p.headline, p.location, (p.open_to || []).join(", ")].filter(Boolean).join(" · ");
    // invitable is computed FOR YOU (an 'investors' member is invitable only by
    // a seated investor); call_access is the member's raw setting.
    const access = p.call_access && p.call_access !== "open" ? `  [calls: ${p.call_access}]` : "";
    process.stdout.write(`@${p.handle}  ${p.name}${p.invitable ? "  [invitable]" : ""}${access}\n`);
    if (bits) process.stdout.write(`  ${bits}\n`);
    process.stdout.write(`  ${p.profile_url}\n`);
  }
}

async function cmdCalendar(args) {
  const data = await apiFetch(`/api/v1/calendar${typeof args.days === "string" ? `?days=${encodeURIComponent(args.days)}` : ""}`);
  if (args.json) { process.stdout.write(JSON.stringify(data, null, 2) + "\n"); return; }
  process.stdout.write(`Calendar: ${data.calendar_connected ? "connected" : "not connected"} · timezone ${data.timezone}\n`);
  if (data.venue) process.stdout.write(`Venue: ${data.venue.url}\n`);
  if (data.error) process.stdout.write(`${data.error}\n`);
  const slots = data.offered_slots || [];
  if (!data.calendar_connected) process.stdout.write("No offered slots without a connected calendar — connect at https://fons.vc/calendar/settings\n");
  else if (!slots.length) process.stdout.write("No free slots inside your working hours in this window.\n");
  else for (const s of slots.slice(0, 40)) process.stdout.write(`  ${fmtWhen(s.start)}\n`);
}

async function cmdAvailability(args) {
  const handle = (args._[1] || "").toString().trim().replace(/^@/, "");
  if (!handle) fail("whose availability? Try: fons availability <handle>");
  const qs = typeof args.days === "string" ? `?days=${encodeURIComponent(args.days)}` : "";
  const data = await apiFetch(`/api/v1/members/${encodeURIComponent(handle)}/availability${qs}`);
  if (args.json) { process.stdout.write(JSON.stringify(data, null, 2) + "\n"); return; }
  if (!data.calendar_connected) {
    process.stdout.write(`@${data.handle} has no calendar connected — propose a time blind with \`fons call request\` and they can counter.\n`);
    return;
  }
  process.stdout.write(`Offered slots for @${data.handle} (${data.timezone})${data.mutual ? " — mutual with your calendar" : ""}:\n`);
  for (const s of (data.slots || []).slice(0, 40)) process.stdout.write(`  ${s.start}  (${fmtWhen(s.start)})\n`);
  if (!(data.slots || []).length) process.stdout.write("  (none in this window)\n");
}

async function cmdCallRequest(args) {
  const handle = (args._[2] || "").toString().trim().replace(/^@/, "");
  if (!handle) fail("who? Try: fons call request <handle> --at <ISO time> [--message \"…\"]");
  const ats = arr(args.at);
  if (!ats || !ats.length) fail("when? Pass --at <ISO time> (repeatable, up to 5) — pick from `fons availability <handle>`.");
  const slots = ats.map((t) => {
    const ms = Date.parse(t);
    if (!Number.isFinite(ms)) fail(`--at "${t}" isn't a valid time. Use ISO 8601, e.g. 2026-07-22T10:00:00Z.`);
    return { start: new Date(ms).toISOString(), end: new Date(ms + 30 * 60 * 1000).toISOString() };
  });
  const body = { handle, slots };
  if (typeof args.message === "string") body.message = args.message;
  if (typeof args.timezone === "string") body.timezone = args.timezone;
  const data = await apiFetch("/api/v1/calls", { method: "POST", body });
  const inv = data.invite;
  process.stdout.write(`Invite sent to ${inv.counterparty.name} — ${inv.status}, expires ${fmtWhen(inv.expires_at)}.\n`);
  process.stdout.write(`Track it with \`fons call list\` (id: ${inv.id}).\n`);
}

async function cmdCallList(args) {
  const dir = typeof args.direction === "string" ? args.direction : "all";
  const data = await apiFetch(`/api/v1/calls?direction=${encodeURIComponent(dir)}`);
  if (args.json) { process.stdout.write(JSON.stringify(data, null, 2) + "\n"); return; }
  const rows = data.invites || [];
  if (!rows.length) { process.stdout.write("No call invites yet — `fons search` to find members (most are contactable by default).\n"); return; }
  for (const i of rows) {
    const other = `${i.counterparty.name}${i.counterparty.handle ? ` (@${i.counterparty.handle})` : ""}`;
    process.stdout.write(`${i.id}  ${i.direction === "sent" ? "→" : "←"} ${other}  [${i.status}]\n`);
    if (i.status === "accepted" && i.chosen_slot) {
      process.stdout.write(`    Confirmed: ${fmtWhen(i.chosen_slot.start)}${i.venue_url ? ` · ${i.venue_url}` : ""}\n`);
      if (i.ics_url) process.stdout.write(`    .ics: https://fons.vc${i.ics_url}\n`);
    } else if (i.status === "pending") {
      process.stdout.write(`    Proposed: ${(i.proposed_slots || []).map((s) => fmtWhen(s.start)).join(" · ")}\n`);
    } else if (i.status === "proposed_new_time") {
      process.stdout.write(`    Counter-proposed: ${(i.counter_slots || []).map((s) => fmtWhen(s.start)).join(" · ")}\n`);
    }
  }
}

async function cmdCallCancel(args) {
  const id = (args._[2] || "").toString().trim();
  if (!id) fail("which invite? Try: fons call cancel <id> (ids from `fons call list`).");
  await apiFetch(`/api/v1/calls/${encodeURIComponent(id)}/cancel`, { method: "POST" });
  process.stdout.write(`Invite ${id} cancelled.\n`);
}

const HELP = `fons — manage your Fons profile from the terminal

Usage:
  fons login [--base <url>]          Authorize in the browser, store a token
      --no-browser                   Paste-back flow (for remote/SSH boxes; auto on SSH)
      --browser                      Force the local-browser loopback flow
  fons logout                        Remove the stored token
  fons whoami                        Show the connected account
  fons profile get [--json]          Print your profile
  fons profile set [flags]           Update fields:
      --name <s>  --headline <s>  --bio <s>  --location <s>  --linkedin <url>  --youtube <url>
      --visibility <public|unlisted|private>
      --sector <s>     (repeat, max 3 — directory sector slugs, e.g. financial_services)
      --skill <s>      (repeat, max 12 — free text, e.g. "Product management")
      --open-to <o>    (repeat: looking-for-work|hiring|raising|investing|co-founder|advising|
                        mentoring|looking-for-mentor|freelance|board-roles|speaking)
      --call-access <a>  who may request a call with you: open|investors|closed (default open —
                         a public profile is contactable; contact never leaves Fons)
      --status <o>       the ONE open-to value shown as the headline status at the top of the page ("" clears)
      --status-note <s>  one-line status in your own words (max 80 chars) — works with --status or alone
      --current-role-json '[{"title":"Founder","company":"Acme","start":"2024-01"}]'
      --job-history-json  '[{"title":"PM","company":"X","start":"2020","end":"2023"}]'
      --links-json        '[{"label":"Site","url":"https://example.com","description":"Optional one-line context"}]'
      --faq-json          '[{"q":"What are you building?","a":"…"}]'  (ordered, max 10)
      --certifications-json '[{"slug":"cspo","credential_id":"1453839","issued":"2021-09","url":"https://…"}]'
                          (max 40; use {"slug":"other","name":"…","issuer":"…"} for anything not in the catalogue)
      --field-visibility-json '{"cv":true}'
  fons company [--json]              Print your company profile
  fons company set [flags]           Update company fields:
      --name <s>  --website <url>  --tagline <s>  --about <s>  --location <s>
      --stage <s>  --sector <id>  --business-model <s>  --raise-status <s>
      --target-investor <s>  --problem <s>  --solution <s>  --why-now <s>
      --founded <yyyy>  --team-size <n>  --entity <s>  --company-number <s>  --address <s>
      --links-json '[{"label":"Docs","url":"https://…"}]' (≤6)
      --connections-json / --certifications-json / --grants-json  (replace whole list)
      (changing website/company number voids the matching verification badge; name is badge-safe)
  fons metrics [--json]              List the company's key metrics (with provenance)
  fons metric set --key <k> --value <n> [--unit <s>] [--period <s>] [--visibility public|gated|private] [--source <s>]
  fons metric rm --key <k>           Remove a metric (connector-managed rows refuse)
  fons documents [--slot <slot>] [--json]   Data-room document metadata + empty slots
  fons feed [--limit <n>] [--json]   The company's append-only audit feed
  fons feed post "<text>"            Post a permanent dated note to the feed
  fons connectors [--json]           Company data-source connectors + what's connectable
  fons connectors sync <id>          Queue a connector re-sync
  fons connectors connect <provider> Browser link to connect a source (never paste keys in a terminal/agent)
      (all company commands take --company <slug> when you belong to several)
  fons product [get] [--json]        Print your product profile
  fons product set [flags]           Update product fields:
      --name <s>  --tagline <s>  --about <s>  --website <url>
      --stage <stage_pre_seed|stage_seed|stage_series_a|stage_series_b|stage_series_c_plus>
      --pricing <free|freemium|paid>  --launched <YYYY-MM-DD>  --video <youtube/vimeo url>
      --topic <t>      (repeat for multiple, max 6)   --topics-json '["AI","DevTools"]'
      Distribution (where your product is listed — renders as public chips):
      --connections-json '[{"id":"producthunt","url":"https://www.producthunt.com/products/x"}]'
                         (id = a launch-platform catalogue id: producthunt, g2,
                          app_store, google_play, appsumo, indiehackers, … ~300)
      --distribution-links-json '[{"label":"My Directory","url":"https://x.example"}]'
                         (free-entry custom links, max 10; label optional)
      --company <slug> (only needed with multiple companies)
      (public page fons.vc/p/<slug> + its .md publish once name+tagline+about are set)
  fons readiness [--company <slug>] [--json]   Your company's Decision Engine checklist (read-only)
  fons connections                   List your verified connections (✓)
  fons connect <provider>            Get a browser link to verify an account
  fons disconnect <provider>         Remove a verified connection
      providers: linkedin, github, x, twitch, discord, youtube
      (disconnect: youtube is managed on fons.vc)
  fons search [<q>] [flags]          Find members (public, listed profiles only):
      --open-to <o>    (repeat — e.g. raising, investing; legacy "intro-calls"
                        still works and filters to members who accept call requests)
      --sector <s>     (repeat — directory sector slugs)
      --location <s>   --limit <n>   --json
  fons availability <handle>         A member's offered call slots (if their call_access
                                     permits you;
      [--days <n>]                    mutual intersection when your calendar is connected)
  fons calendar [--days <n>]         Your own calendar state + offered slots
                                     (connect/settings live at fons.vc/calendar/settings)
  fons call request <handle> --at <ISO time>   Send a call invite (Fons relays it —
      [--at <t> …] [--message "…"]             no contact details exchanged; 30-min slots;
                                               up to 5 --at proposals; caps: Free 4/mo,
                                               Plus 20/mo, Investor uncapped)
  fons call list [--direction sent|received] [--json]   Track invite status
  fons call cancel <id>              Cancel a pending invite you sent

Env: FONS_BASE (default https://fons.vc) · FONS_CONFIG_DIR · FONS_CLI_PORT
`;

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const [cmd, sub] = args._;
  try {
    if (!cmd || cmd === "help" || args.help) { process.stdout.write(HELP); return; }
    if (cmd === "login") return await cmdLogin(args);
    if (cmd === "logout") return await cmdLogout();
    if (cmd === "whoami") return await cmdWhoami();
    if (cmd === "profile") {
      if (sub === "get") return await cmdProfileGet(args);
      if (sub === "set") return await cmdProfileSet(args);
      return fail("unknown profile command. Try `fons profile get` or `fons profile set`.");
    }
    if (cmd === "company") {
      if (sub === "set") return await cmdCompanySet(args);
      if (!sub || sub === "get") return await cmdCompany(args);
      return fail("unknown company command. Try `fons company` or `fons company set`.");
    }
    if (cmd === "product") {
      if (sub === "set") return await cmdProductSet(args);
      if (!sub || sub === "get") return await cmdProductGet(args);
      return fail("unknown product command. Try `fons product get` or `fons product set`.");
    }
    if (cmd === "metrics") return await cmdMetrics(args);
    if (cmd === "metric") {
      if (sub === "set") return await cmdMetricSet(args);
      if (sub === "rm" || sub === "remove") return await cmdMetricRm(args);
      return fail("unknown metric command. Try `fons metric set` or `fons metric rm`.");
    }
    if (cmd === "documents" || cmd === "docs") return await cmdDocuments(args);
    if (cmd === "feed") {
      if (sub === "post") return await cmdFeedPost(args);
      return await cmdFeed(args);
    }
    if (cmd === "connectors") {
      if (sub === "sync") return await cmdConnectorSync(args);
      if (sub === "connect") return await cmdConnectorConnect(args);
      return await cmdConnectors(args);
    }
    if (cmd === "readiness") return await cmdReadiness(args);
    if (cmd === "search") return await cmdSearch(args);
    if (cmd === "availability") return await cmdAvailability(args);
    if (cmd === "calendar") return await cmdCalendar(args);
    if (cmd === "call") {
      if (sub === "request") return await cmdCallRequest(args);
      if (sub === "cancel") return await cmdCallCancel(args);
      if (!sub || sub === "list") return await cmdCallList(args);
      return fail("unknown call command. Try `fons call request`, `fons call list`, or `fons call cancel`.");
    }
    if (cmd === "connections") return await cmdConnections();
    if (cmd === "connect") return await cmdConnect(args);
    if (cmd === "disconnect") return await cmdDisconnect(args);
    fail(`unknown command "${cmd}". Run \`fons help\`.`);
  } catch (e) {
    fail(e && e.message ? e.message : String(e));
  }
}

main();
