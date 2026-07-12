# fons CLI

Manage your [Fons](https://fons.vc) profile from the terminal. The CLI is a thin
client over the same authenticated layer the MCP server uses: it authorizes you via
OAuth 2.1 (PKCE) against Supabase's OAuth 2.1 Server, then calls the `/api/v1`
resource API — every request is scoped to **you** by Row-Level Security.

## Install

```bash
npm install -g fons-cli
```

Or, if you'd rather not go through npm:

```bash
curl -fsSL https://fons.vc/install.sh | sh
```

Needs Node 18+. Zero runtime dependencies.

Or from a checkout of this repo: `cd cli && npm link`.

Requires Node 18+. Zero runtime dependencies (Node built-ins only).

### Logging in from a remote / SSH box

`fons login` normally catches the OAuth redirect on a loopback port, which needs the
browser to be on the same machine as the CLI. On a remote or SSH session that loopback
is unreachable from your browser, so the CLI **auto-switches to a paste-back flow**: it
prints an authorization URL, you open it in a browser anywhere and approve, then paste
the resulting callback URL back into the terminal (your browser will show "This site
can't be reached" at `127.0.0.1` — that's expected; the code is in the address bar).

Force it either way with `fons login --no-browser` (paste-back) or `fons login
--browser` (loopback, e.g. after forwarding port 47100 to your local machine).

## Use

```bash
fons login                       # opens your browser to authorize, stores a token
fons whoami                      # who am I connected as
fons profile get                 # print your profile
fons profile get --json          # full structured JSON (for piping into your own tools)
fons profile set --headline "Founder, building X" --location "London"
fons profile set --tag ai --tag saas --open-to hiring --visibility public
fons company                     # print your company profile (read-only in v1)
fons company --json              # full structured JSON
fons readiness                   # your company's Decision Engine checklist (Must/Should/Could)
fons connections                 # list your verified connections (✓)
fons connect github              # get a browser link to verify an account
fons disconnect github           # remove a verified connection
fons logout                      # remove the local token
```

Only the fields you pass to `profile set` change — everything else is left untouched.

### Updating structured fields

Career, previous roles, display links, the FAQ, and per-field visibility take JSON so the
shape stays explicit (the server re-validates and returns a clear error on a bad shape):

```bash
fons profile set --current-role-json '[{"title":"Founder","company":"Acme","start":"2024-01"}]'
fons profile set --job-history-json  '[{"title":"PM","company":"Globex","start":"2020","end":"2023"}]'
fons profile set --links-json        '[{"label":"Personal site","url":"https://example.com"}]'
fons profile set --faq-json          '[{"q":"What are you building?","a":"An agentic listing site"},{"q":"What are you looking for?","a":"Design partners"}]'
fons profile set --youtube "https://www.youtube.com/@yourchannel"
```

FAQ is your own ordered list of `{ "q": "...", "a": "..." }` pairs (up to 10) — `--faq-json`
replaces the whole list. A legacy `{ "<key>": "<answer>" }` object is still accepted and
converted. `open-to` values: `hiring`, `looking-for-work`, `raising`, `co-founder`, `advising`, `investing`.

### Connections (verify by OAuth)

A connection is proof you own an account, so it can't be set by a flag — `fons connect
<provider>` prints a link you open in your logged-in browser to approve the OAuth link;
the ✓ is written server-side once you approve. Providers: `linkedin`, `github`, `x`,
`twitch`, `discord`, `youtube`. `fons disconnect` removes one (all except `youtube`, which
is managed on fons.vc). `fons connections` shows what's verified.

## Where the token lives

A mode-`0600` file at `~/.config/fons/credentials.json` (override with
`FONS_CONFIG_DIR`). It holds your OAuth access + refresh tokens — treat it like an
SSH key. `fons logout` deletes it locally; to fully revoke access, also remove the
CLI under **Settings → Connected apps** on fons.vc.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `FONS_BASE` | `https://fons.vc` | API + OAuth discovery base (use a dev host for testing) |
| `FONS_CONFIG_DIR` | `~/.config/fons` | Where the token file is stored |
| `FONS_CLI_PORT` | `47100` | Loopback port for the OAuth redirect |

## How auth works

1. `fons login` reads `https://fons.vc/.well-known/oauth-protected-resource` to find
   the authorization server (Supabase), then its metadata.
2. It dynamically registers as a public native client (cached after first run) and
   runs the authorization-code + PKCE flow, catching the redirect on a loopback port.
3. Tokens are exchanged and stored; the access token is sent as a `Bearer` to
   `/api/v1/*`. Refresh happens transparently.

The CLI never sees your password and never holds a Supabase service key. It can only
do what your granted scopes allow, enforced server-side by RLS.

> **Note:** requires the Fons OAuth Server to be enabled (Supabase dashboard →
> Authentication → OAuth Server, with dynamic registration on). Until then `fons
> login` will report that the authorization server is unavailable.
