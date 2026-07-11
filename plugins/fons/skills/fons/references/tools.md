# Fons MCP tools — field-level reference

The tool schemas themselves are authoritative (the server validates everything and
returns the validation message on rejection — relay it verbatim). This file adds the
context and gotchas the schemas can't carry.

## `whoami`

Returns the account's name, @handle, and email. Call it once at the start of Fons
work; if the user seems surprised by the account, they may be logged into the wrong
one — reconnecting the MCP server re-runs the OAuth consent.

## `get_profile` / `update_profile` — the personal founder profile

`update_profile` is a patch: only fields you send change. Fields:

- `name`, `headline`, `bio`, `location` — plain strings. `headline` is the one-line
  role summary shown everywhere; keep it under ~90 chars.
- `current_role` — structured object: the person's present position (title, company,
  start date, plus employment type, location, arrangement, summary, highlights,
  skill tags).
- `job_history` — array of past roles, same shape as `current_role`.
- `links` — free-text display links (label + URL). These are UNVERIFIED. A verified
  ✓ (LinkedIn, GitHub, X, Twitch, Discord, YouTube) comes only from
  `connect_account`.
- `faq` — question/answer pairs shown on the public profile. Good for the questions
  investors actually ask ("Why this team?", "What's the moat?").
- `certifications` — from a curated catalogue; unknown entries are rejected.
- `linkedin`, `youtube` — display URLs for those profiles (again: display, not ✓).
- `tags` — allowlisted skill/sector tags; invalid tags come back in the validation
  error with the allowed set.
- `open_to` — what the person is open to: `hiring`, `looking-for-work`, `raising`,
  `co-founder`, `advising`, `investing`. This drives discovery — worth setting.
- `field_visibility` — per-field privacy. Today only `cv` is toggleable.
- `visibility` — whole-profile: `public` | `unlisted` | `private`. New accounts are
  **private by default**; a founder who wants to be found must set `public`. Flag
  this if their profile is filled in but still private.

**Not writable here** — all browser-only, each with a link that lands on the control:
`handle` (https://fons.vc/profile#handle — choosing your own needs Pro), the CV file
(https://fons.vc/profile#cv), avatar/photos (https://fons.vc/profile#photo), and verified
connections (https://fons.vc/profile#connections — or use `connect_account`, which returns
the bridge URL for you). Full list: [links.md](links.md).

## `get_company` / `update_company` — the company profile

`get_company` returns every company the user belongs to, each with:

- Identity: `name`, slug (public page `https://fons.vc/c/<slug>` + `.md` twin),
  `tagline` (≤120), `description` (≤2000), `website`, `location` (≤120),
  `founded_year`, `team_size`, `sector_id`, `stage`, `business_model`,
  `raise_status`, `target_investor_type`. The last five are allowlisted enums — send
  anything else and the validation error comes back listing the values it accepts, which
  is the fastest way to learn them.
- Narrative: `problem` / `solution` / `why_now` — the memo fields (≤1000 each). These are
  what an investor's agent actually reads; a company with none is a company with no story.
- Legal facts: `entity_type`, `company_number`, `incorporation_year`,
  `registered_address` — the register-corroborated identity of the company. See the badge
  warning below before editing any of them.
- `data_room`: key-metric rows (metric, value, unit, period, **provenance** —
  `manual` self-entered vs `connected` written by a verified connector like Stripe;
  connected figures are the trustworthy ones), profile completion %, freshness
  stamp, domain-control verification state, and connector statuses.
- `team`: linked member profiles (with evidence flags like domain corroboration)
  and pending invites. Membership is mutual-consent — you can't add people, only
  the invite flow on the website can.

`update_company` is a patch (only the fields you send change) with the same
validators as the workspace. Writing needs an owner or manager seat on a paid
company — relay a refusal honestly, never suggest a workaround.

- 🚨 **If `get_company` returns MORE THAN ONE company, ASK which one before every write,
  and wait for the answer.** Then pass `company: <slug>` explicitly and name the company as
  you write it. Plenty of founders own one company and help run another (a portfolio
  company, a friend's startup). Omitting the slug does **not** raise an error — the server
  falls back to their *primary* organisation, which is very often **not** the company you
  were just discussing. So "update the tagline", said while talking about the company they
  manage, will quietly edit the company they own. Nothing warns anyone; the wrong company
  simply changes, and it's their public page. Never infer the target from conversational
  context alone — ask, even when it feels obvious.
- Their **tier can differ per company** (`access_tier`: owner / manager / viewer). Owning
  one company grants nothing on another. Read the tier from `get_company` rather than
  assuming the tier they had a moment ago still applies to the company you're about to
  touch.
- Entitlement follows the **company, not the person**: they can edit a company they pay
  nothing for (someone else pays for it), and paying for one company does not unlock
  another. So "they're a paying customer" never implies "they can write here."

- ⚠️ **Badge death is by design:** changing `name`, `website`, `company_number`,
  or the `grants` list voids the matching verification badge — it attested the
  OLD value. Warn the user before such an edit; re-verify happens on the website.
- Structured lists (`links` ≤6, `connections`, `certifications`, `grants`) each
  **replace the whole list** — read first, edit, write back.
- **Not writable here:** company visibility/publishing, claiming, deletion,
  ownership, trust badges, and the team roster (all website-only).

**Never present, by design:** numeric scores, weights, rankings, connector tokens.

## `get_metrics` / `update_metric` / `delete_metric` — key metrics

The data room's Key Metrics, with the **provenance ladder** as the anti-fraud
boundary:

- Manual entry writes provenance `founder` (self-attested). The verified
  `connected` tier is written ONLY by a live connector — an agent can never
  assert it. When a user wants a figure to show as verified, connect the source
  (`connect_company_source`) instead of typing the number.
- A metric currently managed by an active connector refuses value edits and
  deletion (visibility-only changes allowed) — that's the honesty contract, not
  an error to work around.
- Sensitive metrics (burn, cash, runway, CAC, LTV, margin) can never be
  `public`; `gated` shows them to vetted investor seats only. Default is
  `private` — confirm with the user before setting anything more visible.

## `list_documents` — data-room document slots (metadata only)

Lists each diligence document's slot, filename, size, and date, plus which slots
are still empty (useful for readiness triage). File CONTENTS are deliberately
unreadable here — confidential documents must not flow through a third-party
session. Uploads happen on the website; Google Drive/Dropbox/Notion ingestion is
planned (EVID-4).

## `get_feed` / `post_feed_note` — the audit trail

The company feed is **append-only**: every metric/document/connector/verification
event lands as a dated, immutable entry, and its freshness tier is investor-facing.
`post_feed_note` adds a plain dated note ("Pilot with Acme signed") — notes are
permanent, so confirm wording with the user first. Verification events can't be
posted (server-enforced), so the feed can't be forged from a session.

## `list_company_connections` / `sync_company_connection` / `connect_company_source`

Company data-source connectors (Stripe, Search Console, ChartMogul, PostHog,
UKRI, GitHub…). The list shows status + last sync + the registry of what's
connectable; sync queues a refresh of an existing connection.

`connect_company_source` mirrors `connect_account`: it returns a **bridge URL** into the
user's logged-in workspace. Never guess the steps — `list_company_connections` returns each
provider's class and status, and the bridge URL's own instructions are authoritative. Five
classes, one rule (**the proving act always happens in their browser, never in this chat**):

- **OAuth** (Search Console, LinkedIn, GitHub…): consent runs on the provider's own screen.
- **Key-paste** (Stripe, ChartMogul, PostHog, Plausible, Mixpanel…): a **read-only** key,
  typed into the connector panel the link opens — **never into the chat**. If a user pastes
  a key at you anyway, refuse it, tell them to rotate it, and send them the link.
- **DNS** (domain control): they add a **TXT record** on their own domain, then hit verify.
  This is the one that isn't instant — DNS takes minutes to propagate, and telling them to
  expect that is the difference between "it's broken" and "it's working".
- **Registry** (Companies House, UKRI): keyless — Fons reads a public register. It matches
  on the **company's own name/number**, so it only confirms what's already true; there is
  nothing for the user to paste and nothing for you to assert on their behalf.
- **Public** (GitHub repo, npm, PyPI): keyless — one click on the opened panel.

## `get_product` / `update_product` — the company's product

Each company has one product; `update_product` takes `company` (slug) when the
user belongs to several. Writing needs an owner or manager seat on that company —
a view-only member gets a clear refusal (relay it; the owner can upgrade their
seat), and a company whose subscription lapsed is locked until it's reactivated.

- `name` — ⚠️ the public `/p/` slug is minted from the FIRST saved name and never
  changes. Confirm before the first save.
- `tagline` (≤120), `description` (≤2000) — with `name`, these three publish the
  public page: once all are set, `/p/<slug>` and its `.md` twin go live
  automatically. The tool's response tells you whether the page is live.
- `stage`, `pricing` (`free` | `freemium` | `paid`), `website`, `topics` (≤6,
  replaces the whole list), `launched_on` (`YYYY-MM-DD`), `video_url` (YouTube or
  Vimeo https only).
- `connections` — launch-platform links (Product Hunt, G2, App Store, ~300
  catalogued platforms, by catalogue id). Replaces the whole set; unknown ids are
  rejected and the error lists valid options. The `verified` flag is server-written.
- `distribution_links` — free-entry custom links, max 10, replaces the whole set.

Empty string clears clearable fields (`tagline`, `description`, `launched_on`,
`video_url`).

## `get_company_readiness` — the evidence checklist

Takes `company` (slug) when the user belongs to several companies; omit it
otherwise. The Decision Engine's readiness view: every evidence field grouped
Must-have / Should-have / Could-have, each `captured` / `unclear` / `missing`,
plus overall completeness and suggested next actions. Statuses and labels ONLY —
no scores exist on this surface, ever (see Hard rule 2).

Answers are entered on fons.vc (the company workspace), not through a tool — your
job is triage: read the checklist, help the founder draft strong answers, then
send them to the site to enter them.

## `list_connections` / `connect_account` / `disconnect_account`

Verified ✓ connections: `linkedin`, `github`, `x`, `twitch`, `discord`, `youtube`.

- `connect_account` returns a **bridge URL** — the user opens it in their own
  browser, approves in their logged-in Fons session, done. No credential ever
  passes through the chat. After they say they've approved, call
  `list_connections` to confirm the ✓ before reporting success.
- `disconnect_account` works directly (removing proof needs no proof). It refuses
  to remove the only sign-in identity; YouTube disconnect is website-only.
