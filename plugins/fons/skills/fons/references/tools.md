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
- `primary_status` — the ONE `open_to` value promoted to the top of the public page
  as the headline status ("Looking for work", "Hiring", …). Must also be present in
  `open_to`; an empty string clears it. This is the primary engagement signal —
  read it before suggesting how someone should be approached.
- `status_note` — a one-line status in the person's own words (max 80 chars, e.g.
  "looking for product management roles"). Shown with the promoted `primary_status`,
  or **entirely on its own** — a freehand status needs no promoted action. Empty
  string clears it.
- `links` — free-text display links: `label` + `url` + optional `description` (a
  one-line "what is this link" shown under it on the public page, ≤160 chars).
  These are UNVERIFIED. A verified ✓ (LinkedIn, GitHub, X, Twitch, Discord,
  YouTube) comes only from `connect_account`.
- `faq` — question/answer pairs shown on the public profile. Good for the questions
  investors actually ask ("Why this team?", "What's the moat?").
- `certifications` — from a curated catalogue; unknown entries are rejected.
- `linkedin`, `youtube` — display URLs for those profiles (again: display, not ✓).
- `sectors` — up to **3** sectors the person has worked in, as allowlisted directory
  sector slugs (`financial_services`, `ai_ml`, `healthcare_services`, … — the same
  vocabulary as a company's `sector_id`). Unknown slugs are dropped, not errors.
- `skills` — up to **12** skills as short display strings (≤40 chars each, e.g.
  `"Product management"`, `"Welding"`). This is an **open** vocabulary: any string is
  accepted — write what the person actually says, don't force it into tech terms.
- `open_to` — what the person is open to: `looking-for-work`, `hiring`, `raising`,
  `investing`, `co-founder`, `advising`, `mentoring`, `looking-for-mentor`,
  `freelance`, `board-roles`, `speaking`, `intro-calls`. This drives discovery
  (investors, recruiters and coaches filter on it) — worth setting. `intro-calls`
  is also the OPT-IN for receiving call invites: only a public profile carrying it
  can be found by `search_profiles` filters and invited with `request_call`.
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
- Diligence raise signal: `use_of_funds` (≤1000 — what the raise buys + milestones to the
  next round), `next_milestone` (≤200 — the one committed milestone; a change is logged to
  the activity feed), `next_milestone_date` (`YYYY-MM-DD`). Signal-level only — never
  amounts, valuation, or terms. The two diligence **attestations** ("no pending litigation",
  "all officers full-time") are deliberately **not** settable here: affirming a legal fact is
  a human act, so the founder makes them in the /diligence editor, not via an agent.
- Published diligence answers (Stage F — these render on the public page + `.md`, so they're
  what an investor's agent reads): market sizing — `market_tam` / `market_sam` / `market_som`
  (a value with its unit, e.g. "$5B", ≤80 each), `market_method` (allowlisted enum), a
  `market_capture` rate (≤300) and `market_assumptions` (≤1000) — a size with no method or
  assumptions gets discounted; plus `competition` (competition & moat) and `team_fit`
  (team & founder-market fit), ≤1500 each. Market sizing is MARKET size, never a raise or
  valuation figure.
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

- ⚠️ **Badge death is by design:** changing `website`, `company_number`, or the
  `grants` list voids the matching verification badge — it attested the OLD
  value. Warn the user before such an edit; re-verify happens on the website.
  Changing `name` is **badge-safe**: the registry badge keys to the company
  number, and the registered legal name shown beside it comes from the register
  itself (a trading name differing from the legal name is expected).
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
- **Registry** (Companies House, UKRI): keyless — Fons reads a public register. The
  **company number** is the link: an active register entry verifies, and the company's
  **registered legal name comes back from the register** and is displayed beside the badge
  (trading names are expected to differ from the legal name — that's fine). Grants confirm
  when the awardee is the company's display name **or** its registered legal name. There is
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

## `search_profiles` — find Fons members (public cards only)

Search public, **listed** member profiles by the closed-vocabulary fields. Filters
(all optional, AND-combined): `q` (name/headline free text), `open_to` (values from
the list above, e.g. `["intro-calls"]`, `["raising"]`), `sectors` (directory sector
slugs), `location` (substring), `limit` (default 20, cap 50).

Each result is the public card — `name`, `handle`, `headline`, `location`,
`open_to`, `sectors`, `skills` — plus `profile_url` (`https://fons.vc/<handle>`)
and `profile_md` (the agent-readable twin). `invitable: true` means the member has
opted into intro calls and can be invited with `request_call`. Private/unlisted
profiles never appear; no contact details, no scoring data. The intended loop:
search → hand the human the profile URLs → they pick → `get_member_availability`
→ `request_call`.

## `get_member_availability` / `get_availability` — offered call slots

- `get_member_availability` (`handle`, optional `days` ≤21): another member's
  **offered slots** — their working hours ∩ live calendar free/busy, as bookable
  30-minute `{start,end}` times. Opt-in only (`intro-calls`); raw busy patterns
  and event contents are never exposed. When the CALLER's own calendar is
  connected the slots are the **mutual intersection** (`mutual: true`) — any of
  them works for both sides. A member with no calendar connected returns
  `calendar_connected: false` — propose a time blind and they can counter.
- `get_availability` (own): the signed-in user's connection state, timezone,
  working hours, meeting venue, and own offered slots. Everything is managed at
  `https://fons.vc/calendar` (connect Google Calendar, set working hours, set the
  meeting-venue link that gets stamped into confirmed calls).

## `request_call` / `list_call_invites` / `cancel_call_invite` — Fons-relayed calls

The network loop's write half. Fons is the middleman: **no email addresses or
contact details are ever exchanged** — the invite lands in the recipient's Fons
workspace (/messages), where they accept, decline, or propose a new time; on
accept both sides get the `.ics` (plus an Add-to-Google-Calendar link) carrying
the requester's configured venue link.

- `request_call` (`handle`, `slots` = 1–5 `{start, end?}` ISO times — `end`
  defaults to start+30min, `message` ≤500 chars, `timezone` display-only): pick
  the times from `get_member_availability` when it returns slots. The proposal is
  validated against BOTH calendars at send time where connected; a conflict comes
  back with the nearest mutually-free alternatives instead of sending. Sending
  caps are server-enforced: **Free 4/month · Plus 20/month · Investor uncapped**.
  An agent gets no more reach than its human — blocks, cooldowns and caps apply
  identically here and are decided in the database.
- `list_call_invites` (`direction`: `all`/`sent`/`received`): status tracking —
  `pending` / `accepted` / `declined` / `proposed_new_time` / `expired` (7 days) /
  `cancelled`. Accepted rows carry `chosen_slot`, `venue_url`, `ics_url` and
  `google_calendar_link`.
- `cancel_call_invite` (`id`): cancels one of the user's own pending SENT
  invites. Responding to a RECEIVED invite is a human act on fons.vc — never
  attempt it from the agent.
