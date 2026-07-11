<picture>
  <source media="(prefers-color-scheme: dark)" srcset="assets/banner-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="assets/banner-light.png">
  <img alt="Fons — the living profile that gets your company investment ready" src="assets/banner-light.png">
</picture>

<p align="center">
  <b>Fons gives your company a living agentic profile that gets it ready for investment.</b><br>
  One profile that works as your data room, your due-diligence evidence, and the way investors and their agents discover you.
</p>

<p align="center">
  <a href="https://fons.vc"><img src="https://img.shields.io/badge/fons.vc-live-0a0a0a?style=flat-square" alt="fons.vc"></a>
  <a href="#install"><img src="https://img.shields.io/badge/Claude_Code-plugin-0a0a0a?style=flat-square" alt="Claude Code plugin"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-streamable_http-0a0a0a?style=flat-square" alt="MCP"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/licence-Apache--2.0-0a0a0a?style=flat-square" alt="Apache-2.0"></a>
  <a href="https://discord.gg/HVXjkCxgcj"><img src="https://img.shields.io/badge/Discord-join-0a0a0a?style=flat-square&logo=discord&logoColor=white" alt="Discord"></a>
  <a href="https://x.com/fons_vc"><img src="https://img.shields.io/badge/X-@fons__vc-0a0a0a?style=flat-square&logo=x&logoColor=white" alt="X"></a>
</p>

---

This repository is the **agent surface of Fons**: the Fons Skill, the MCP wiring it depends on,
and the `fons` CLI. Install it and your AI assistant can read and update your Fons profile,
your company, your product, your key metrics and your data room — from wherever you already
work, without a browser tab and without a single credential passing through the chat.

The Fons platform itself (the web app, the scoring engine, the database) is **not** open source
and does not live here. What lives here is everything you need to *talk to it*.

## Contents

- [What your agent can do](#what-your-agent-can-do)
- [Install](#install)
- [How it authenticates](#how-it-authenticates)
- [The CLI](#the-cli)
- [Readable without an account](#readable-without-an-account)
- [What it deliberately cannot do](#what-it-deliberately-cannot-do)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [Follow us](#follow-us)
- [Security](#security)
- [Licence](#licence)

## What your agent can do

Twenty tools, all scoped to **your own** account. Authorization is decided by the Fons server on
every single call, so the agent can never exceed the permissions you already have.

| | Tools |
|---|---|
| **Identity** | `whoami` · `get_profile` · `update_profile` |
| **Company** | `get_company` · `update_company` |
| **Product** | `get_product` · `update_product` — publishes your public `/p/` page |
| **Evidence** | `get_metrics` · `update_metric` · `delete_metric` · `list_documents` |
| **Readiness** | `get_company_readiness` — what's captured, unclear, missing |
| **Audit trail** | `get_feed` · `post_feed_note` — append-only, investor-facing |
| **Data sources** | `list_company_connections` · `sync_company_connection` · `connect_company_source` |
| **Verified accounts** | `list_connections` · `connect_account` · `disconnect_account` |

The Skill is what makes those tools *useful*. It teaches the agent the field vocabulary, the
validators, which edits are permanent, which ones void a verification badge, and — when
something can only be done in a browser — the exact URL that opens the right control rather
than a shrug towards the homepage.

```
you › get my company investment ready on fons

    → reads your readiness checklist, drafts the gaps with you, records the metrics,
      tells you which evidence is still missing, and hands you a link to connect Stripe
      so your revenue numbers carry verified provenance instead of your word for it.
```

## Install

You need a Fons account — free at [fons.vc/app](https://fons.vc/app). A personal profile costs
nothing. A company profile is Fons Pro (£49/month per company).

### Claude Code — one step

```bash
/plugin marketplace add fons-vc/fons
/plugin install fons@fons
```

That installs the Skill **and** wires up the MCP server. The first tool call opens a browser
consent screen; approve it and you're connected.

### Every other agent

One URL, everywhere:

```
https://fons.vc/mcp
```

It's a remote **Streamable HTTP** MCP server with **OAuth 2.1, PKCE and dynamic client
registration**, so in most clients you paste that URL and the browser does the rest — no key,
no token, no callback URL to configure.

<details open>
<summary><b>Claude</b> — claude.ai, Claude Desktop, Claude Code</summary>

- **claude.ai / Desktop:** Settings → Connectors → **Add custom connector** → paste the URL.
  (Custom connectors need a paid plan.)
- **Claude Code, without the plugin:** `claude mcp add --transport http fons https://fons.vc/mcp`
</details>

<details>
<summary><b>ChatGPT</b> — Developer mode</summary>

Paid plans (Plus, Pro, Business, Enterprise, Edu), **on the web**. Not available on Free. On
Business/Enterprise your workspace admin has to enable developer mode first.

1. **Settings → Security and login → Developer mode** — turn it on.
2. Go to **Settings → Plugins** (or `chatgpt.com/plugins`) → **+**.
3. Name it `Fons`, and set the **MCP server URL** to `https://fons.vc/mcp`. **Create**.
4. In a chat: **＋ → Developer mode → Fons**. You enable it per conversation.

ChatGPT asks you to confirm each write the first time — that's its behaviour, not ours, and we
think it's the right one. (OpenAI moves these menu labels around; if yours differ, look for
"developer mode".)
</details>

<details>
<summary><b>OpenAI Codex</b></summary>

Add to `~/.codex/config.toml`:

```toml
[mcp_servers.fons]
url = "https://fons.vc/mcp"
auth = "oauth"
```

Then `codex mcp login fons`.
</details>

<details>
<summary><b>Cursor</b></summary>

[![Add Fons to Cursor](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en/install-mcp?name=fons&config=eyJ1cmwiOiJodHRwczovL2ZvbnMudmMvbWNwIn0%3D)

Or by hand, in `~/.cursor/mcp.json`:

```json
{ "mcpServers": { "fons": { "url": "https://fons.vc/mcp" } } }
```
</details>

<details>
<summary><b>VS Code</b> — GitHub Copilot agent mode</summary>

Command Palette → **MCP: Add Server**, or write `.vscode/mcp.json` (note the key is `servers`):

```json
{ "servers": { "fons": { "type": "http", "url": "https://fons.vc/mcp" } } }
```

Works on every Copilot plan including Free. Copilot Business/Enterprise members need their org
to allow MCP servers.
</details>

<details>
<summary><b>Gemini CLI</b></summary>

```bash
gemini mcp add --transport http fons https://fons.vc/mcp -s user
```

Then `/mcp auth fons` inside the CLI. It needs a local browser for the consent step, so it
won't complete over a bare SSH session.

**The Gemini app (gemini.google.com) can't do this** — its connectors are a fixed Google-curated
list with no way to add your own. Use the CLI, or just [read the `.md`](#readable-without-an-account).
</details>

<details>
<summary><b>Grok</b></summary>

**grok.com/connectors → New Connector → Custom** → paste `https://fons.vc/mcp` → complete the
sign-in it prompts for. On Grok Business/Enterprise a team admin adds the connector first.
</details>

<details>
<summary><b>Zed</b></summary>

Settings → AI → MCP Servers → **Add Remote Server**, or in `settings.json`:

```json
{ "context_servers": { "fons": { "url": "https://fons.vc/mcp" } } }
```

Leave the headers out and Zed runs the OAuth flow for you.
</details>

<details>
<summary><b>Windsurf</b> (now Devin Desktop)</summary>

`~/.codeium/windsurf/mcp_config.json` — the remote key here is `serverUrl`, not `url`:

```json
{ "mcpServers": { "fons": { "serverUrl": "https://fons.vc/mcp" } } }
```
</details>

<details>
<summary><b>Llama, Mistral, DeepSeek, Qwen — or anything you run yourself</b></summary>

These are **models, not agent hosts** — they have no connector settings of their own. Run them
inside an MCP client and point that client at Fons. Two that handle our browser sign-in properly:

- **LibreChat** — per-user OAuth, and users can add the server from the UI.
  In `librechat.yaml`: `type: streamable-http`, `url: https://fons.vc/mcp`.
- **Open WebUI** (v0.6.31+) — Admin Settings → External Tools → **+** → MCP (Streamable HTTP) →
  URL → Auth: **OAuth 2.1 (DCR)**. Admin-only, and you must enable it per chat for the sign-in
  to fire.

**Ollama** runs the model, not the tools — it has no MCP client, so you can't point it at Fons
directly. Use it as the model *behind* LibreChat or Open WebUI. Likewise **OpenRouter**: it's an
inference router, not an agent host. Neither is a gap in Fons; it's just not what those tools do.
</details>

<details>
<summary><b>Not working yet — and we'd rather say so</b></summary>

| | Why |
|---|---|
| **Perplexity** | It *has* custom remote connectors (Pro/Max), but its OAuth registration currently insists on a `client_secret`. Fons registers clients as **public** ones — no secret, PKCE instead — which is the correct and safer design for an app that can't keep a secret. Perplexity rejects that today ([open bug](https://community.perplexity.ai/t/custom-mcp-connector-fails-with-did-not-return-a-client-secret-for-rfc-7591-compliant-public-client-registrations/5172)). We tested it; it fails. We'll list it the day it works. |
| **Microsoft 365 Copilot** | Custom MCP connectors are admin-configured, need a pre-registered client secret, and are documented for **read-only** tools. **Copilot Studio** does support our sign-in (Tools → New tool → MCP → OAuth 2.0 → Dynamic discovery) if you're building an agent there. The **consumer** Copilot app has no custom connectors at all. |
| **Any model, no setup** | All of these can still *read* a Fons profile — see below. |

</details>

The Skill is what turns those tools into good behaviour. Outside Claude Code, copy
[`plugins/fons/skills/fons`](plugins/fons/skills/fons) into your agent's skills directory
(`~/.claude/skills/fons` for Claude Code), or just paste `SKILL.md` into the conversation — it's
plain Markdown and it works as context anywhere.

## How it authenticates

**No credential ever passes through the chat.** Not an API key, not a token, not a password.
This is the whole point, so it is worth being precise about:

1. Your agent calls a Fons tool. The server replies `401` with an OAuth challenge.
2. Your agent opens a **browser consent screen inside your logged-in Fons session** — you
   approve, as yourself, in a place an agent cannot reach.
3. The agent receives a scoped token and acts **as you**. Every call is authorized server-side
   against the same rules the website uses. Row-level security is the boundary, not the client.

The same pattern covers anything that requires proof of ownership. Verifying a LinkedIn account
or connecting Stripe returns a **bridge URL** you open in your own browser — the agent hands you
the door; it never holds the key. If you paste a secret at it anyway, the Skill is written to
refuse it and tell you to rotate it.

## The CLI

```bash
curl -fsSL https://fons.vc/install.sh | sh    # installs the `fons` command (needs Node 18+)

fons login                  # OAuth, same browser consent, no tokens to copy
fons profile get
fons profile set --headline "Founder, Acme — B2B infrastructure"
fons company                # your company + data room
fons readiness              # the evidence checklist
fons product set --tagline "…"
fons metrics
fons connectors
```

The token is stored mode-`0600` at `~/.config/fons`. Same auth, same server-side authorization,
same refusals. See [`cli/`](cli).

## Readable without an account

Every public Fons profile ships an **agent-readable Markdown twin** at the same address — with
YAML front-matter and JSON-LD, so a model gets structured facts instead of a scraped page. No
auth, no SDK, no API key. Try it right now:

```bash
curl https://fons.vc/c/fons-vc.md      # a company (this one is ours)
curl https://fons.vc/p/<slug>.md       # a product
curl https://fons.vc/<handle>.md       # a founder
```

That's the discovery half of Fons, and it works with **every** model — no connector, no setup.
Paste the URL into ChatGPT, Gemini, Grok, Perplexity, Copilot, or a local Llama, and ask about
the company; anything that can read a web page can read a Fons profile. It is also why the
profiles are worth keeping accurate: an investor's agent doing background reading will find the
`.md`, not your pitch deck.

The MCP tools in this repo are for **your own** data. The `.md` twins are how any agent reads
**everybody else's**.

## What it deliberately cannot do

An honest surface is more useful than an omnipotent one. The agent **cannot**:

- **Assert a verification it didn't earn.** Verified connections, trust badges and `connected`
  metric provenance are written only by a live connector or a proven browser session. An agent
  can type a number into your data room; it cannot make it *verified*. That distinction is the
  product.
- **See or invent a score.** Fons reports readiness as statuses and bands — never a number. The
  scoring internals are not exposed to any agent, ever.
- **Read your documents.** `list_documents` returns names and dates. File contents never flow
  through a third-party AI session.
- **Forge your history.** The company feed is append-only and verification events are
  server-written, so an audit trail cannot be manufactured from a chat window.
- **Exceed your permissions.** A view-only teammate gets an honest `403`, not a workaround.

## Architecture

```
     your agent                        this repo                     fons.vc
  ┌───────────────┐              ┌────────────────────┐        ┌──────────────────┐
  │ Claude Code   │   skill ───▶ │ SKILL.md           │        │  /mcp            │
  │ claude.ai     │              │ references/        │        │  OAuth 2.1 + PKCE│
  │ Cursor, …     │   tools ───▶ │ .mcp.json ─────────┼───────▶│  ↓               │
  └───────────────┘              │ cli/               │        │  RLS authorizes  │
                                 └────────────────────┘        │  every call      │
        ▲                                                      └────────┬─────────┘
        │                                                               │
        └──────────  browser consent (you, logged in)  ◀────────────────┘
```

The Skill is instructions; the MCP server is the door; **the database is the boundary**. A fork
of this repo still authenticates as you, through your consent, under your permissions — which is
why we can publish it.

## Contributing

Issues and pull requests are welcome, particularly on the Skill's guidance: if it gave your agent
a bad instruction, that's a bug worth reporting. See [CONTRIBUTING.md](CONTRIBUTING.md).

Note that `SKILL.md`, `references/` and `cli/` are generated from the Fons monorepo — we accept
patches here and land them upstream.

## Follow us

- **Discord** — [discord.gg/HVXjkCxgcj](https://discord.gg/HVXjkCxgcj). Where we talk about what
  agents should and shouldn't be trusted to do with a company's own data. Bring the transcript
  where your agent got it wrong; that's the useful conversation.
- **X** — [@fons_vc](https://x.com/fons_vc).
- **Web** — [fons.vc](https://fons.vc). Every public profile there has a `.md` twin, including
  [ours](https://fons.vc/c/fons-vc.md).

## Security

Found a vulnerability? **Do not open a public issue.** See [SECURITY.md](SECURITY.md) —
report it to [admin@fons.vc](mailto:admin@fons.vc).

## Licence

[Apache-2.0](LICENSE). Fons, the Fons logo and fons.vc are trademarks of Fons — the licence
grants no rights to them (§6), so a fork must not present itself as Fons.
