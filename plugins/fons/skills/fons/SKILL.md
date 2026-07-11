---
name: fons
description: >-
  Read and update the user's Fons (fons.vc) presence — founder profile, company
  profile, product page, investment-readiness checklist, and verified account
  connections — through the Fons MCP server, and connect that server if it isn't
  connected yet. Use this whenever the user mentions Fons or fons.vc in any form,
  wants to edit their founder/company/product profile there, asks about getting
  their company "investment ready", wants their data room, key metrics, or
  readiness checklist, wants to verify/connect an account (LinkedIn, GitHub, X,
  Twitch, Discord, YouTube) on their profile, or asks what they can do on Fons —
  even if they don't name a specific feature.
---

# Fons

Fons (fons.vc) gives a company a living, agent-readable profile that gets it ready
for investment: one profile that works as its data room, its due-diligence evidence,
and the way investors and their agents discover it. This skill lets you act on the
user's own Fons account through the Fons MCP server.

## Step 0 — check the connection

The Fons MCP server is the **only** doorway into the user's account. Everything below
depends on it, so settle this before anything else.

**Tools present** (`whoami`, `get_profile`, …) → call `whoami` first. It confirms which
account you're acting as, which matters when people hold work and personal accounts.

**Tools absent** → the server isn't usable yet, and you cannot fix that from here. Work
out which of the two states it's in, give the user that one step, and **stop**:

| State | What the user does |
|---|---|
| **Not added** | Claude Code: `claude mcp add --transport http fons https://fons.vc/mcp` · claude.ai: Settings → Connectors → Add custom connector → `https://fons.vc/mcp` · other hosts: add a Streamable HTTP server at that URL (standard OAuth, dynamic client registration) |
| **Added but unauthorized** — the host says the server "needs authentication", or a call comes back 401 | Claude Code: `/mcp` → **fons** → authenticate · claude.ai: reconnect the connector under Settings → Connectors |

The OAuth handles itself: a browser consent screen inside their logged-in Fons session.
There is **nothing for anyone to copy** — no token, no key, no callback URL. It signs in as
whoever is logged into fons.vc in that browser, so if they hold two accounts, tell them to
check they're on the right one. They need a Fons account: free at https://fons.vc/app.

**Don't go hunting for another way in.** No reading credential files or `~/.config`, no
stored tokens, no CLI binaries, no calling the API directly. If a side door like that ever
worked, it would mean an agent could reach a founder's account without their consent — which
is precisely what this product exists to prevent. Being blocked is a perfectly good answer;
routing around authentication is not, and a user watching you search their filesystem for
credentials has every reason to be alarmed.

**While you're blocked, still be useful.** If the request was also missing something you'd
need anyway — the actual new headline text, which company they meant — ask for it in the
same message as the connect step. They come back once, and you can act immediately.

## What you can and can't do — by plan

Authorization is enforced by the Fons server per call; you cannot exceed the user's
own permissions, so never pre-filter what they ask for — try the call and relay the
server's answer. The shape to expect:

| Plan | Agent surface |
|---|---|
| Free | Personal profile read/write + account connections. Company/product tools return "no company yet" — creating or claiming a company requires Fons Pro (£49/month per company). |
| Fons Pro | Everything above, plus their company, product, and readiness checklist. Company **writes** also depend on the user's team tier: owners and managers can write, viewers are read-only — the server enforces this. |
| Anyone (no auth) | Public profiles are open: any founder/company/product page has an agent-readable twin at the same URL + `.md` (e.g. `https://fons.vc/c/acme.md`). Use plain fetches for *other* companies — the MCP tools are for the user's *own* data. |

If a call returns a 403 about membership, say so plainly and point at
https://fons.vc/account/billing — don't retry or work around it.

## Hard rules

1. **Never accept credentials in chat.** No API keys, tokens, or passwords — for
   anything. Account verification and connector setup always happen through a link
   the user opens in their own browser (`connect_account` returns it). If a user
   pastes a secret anyway, tell them not to, tell them to rotate it, and use the
   link flow instead.
2. **There are no scores to show.** Fons deliberately exposes readiness as
   statuses and bands, never numbers. If asked for "my score", explain that Fons
   shows what's captured/missing (the readiness checklist), not a numeric score —
   don't invent one.
3. **Two fields are effectively permanent — warn before first write.** The product's
   public URL slug is minted from the *first saved* product name and never changes;
   profile handle changes are website-only. Confirm spelling before a first
   `update_product` name save. Feed notes are also permanent (append-only trail) —
   confirm wording before `post_feed_note`.
4. **Verified badges can't be written — and edits can void them.** `links`/
   `linkedin`/`youtube` are display links; a ✓ comes only from the browser-verified
   connection. Metric provenance `connected` comes only from a live connector —
   manual entries are self-attested by design. And changing a company's name,
   website, or company number voids the matching verification badge (it attested
   the old value) — warn before those edits.
5. **Fons never provides capital.** Don't describe it as funding companies — it
   makes companies ready for investment and discoverable by investors.
6. **More than one company? CONFIRM which one before you write — every time, no exceptions.**
   Plenty of founders own one company and manage another (a portfolio company, a friend's
   startup). If `get_company` returns more than one, then before **any** write — company,
   product, metric, feed note, connector — **ask them which company you should update, and
   wait for the answer.** Do not infer it from what you were just discussing, and do not
   proceed on your own best guess, even when the guess feels obvious.

   This is not caution for its own sake. Omitting `company: <slug>` is **not** an error: the
   server silently falls back to their *primary* company, which is frequently **not** the one
   in the conversation. So a wrong guess doesn't fail loudly — it quietly edits the wrong
   company's public page, and nobody finds out until an investor reads it. One short question
   costs a few seconds; a bad edit costs their credibility with whoever reads it next.

   Once they've told you, pass `company: <slug>` explicitly and name the company in your
   message as you write ("Updating the tagline on **acme** …"). Their tier can differ per
   company too — owning one grants nothing on another, so read `access_tier` per company
   rather than assuming the one from the previous turn still applies.

## Doing the work

- **Field-level details, validators, and gotchas for every tool:** read
  [references/tools.md](references/tools.md) before multi-field updates.
- **Common end-to-end flows** (get investment ready, publish the product page,
  verify accounts, fill readiness gaps): read
  [references/workflows.md](references/workflows.md).

Quick orientation — the tools:

| Tool | What for |
|---|---|
| `whoami` | Which account this session acts as |
| `get_profile` / `update_profile` | The user's personal founder profile |
| `get_company` / `update_company` | Company profile + data room overview; field edits (same validators as the workspace) |
| `get_product` / `update_product` | The company's product + its public `/p/` page |
| `get_company_readiness` | The Must/Should/Could evidence checklist — what's captured, unclear, missing |
| `get_metrics` / `update_metric` / `delete_metric` | Key metrics with the provenance ladder (manual = self-attested; verified comes from connectors) |
| `list_documents` | Data-room document slots — metadata only, never file contents |
| `get_feed` / `post_feed_note` | The append-only audit feed; post permanent dated notes |
| `list_company_connections` / `sync_company_connection` / `connect_company_source` | Company data sources (Stripe, Search Console…) — status, re-sync, and browser-link connect |
| `list_connections` / `connect_account` / `disconnect_account` | Verified ✓ account connections (browser link flow) |

## When it happens on the website, send them to the exact control

A real part of Fons is deliberately browser-only: uploading a photo, a CV or a diligence
document, claiming a company, inviting a team, changing a handle, billing, MFA. Those need
a logged-in human, which is the point — an agent holding a token should not be able to do
them. Saying so is not an apology, it's the design.

But don't stop at the page. You know exactly what they're trying to do, so hand them the
**precise destination**: every page below takes a fragment that opens that section and puts
the cursor on the control. "You can't set a photo from here — open
https://fons.vc/profile#photo and it's the picker at the top" is a good answer. "Go to
fons.vc/profile" is a shrug.

| They want to… | Send them to |
|---|---|
| Change their photo / avatar | `https://fons.vc/profile#photo` |
| Upload a CV (autofills the profile) | `https://fons.vc/profile#cv` |
| Change their handle (Pro) | `https://fons.vc/profile#handle` |
| Publish / hide their profile | `https://fons.vc/profile#visibility` |
| Verify an account (LinkedIn, GitHub…) | `https://fons.vc/profile#connections` |
| Upload a data-room document | `https://fons.vc/company#documents` |
| Invite a teammate / manage the team | `https://fons.vc/company#team` |
| Connect a data source (Stripe…) | `https://fons.vc/company#connections` |
| Publish the company page | `https://fons.vc/company#visibility` |
| Turn on two-factor auth | `https://fons.vc/account/settings#mfa` |
| Revoke an agent's access | `https://fons.vc/account/settings#apps` |
| Export or delete their data | `https://fons.vc/account/settings#privacy` |
| Billing, plan, seats | `https://fons.vc/account/billing` |

The complete vocabulary — every section of every page — is in
[references/links.md](references/links.md). Use a fragment from that list or none at all:
an invented one (`#avatar-upload`) silently lands on the page root, which is worse than
linking the root openly, because you'll have told them a specific thing that wasn't true.
