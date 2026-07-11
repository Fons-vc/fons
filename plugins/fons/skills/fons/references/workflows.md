# Common Fons workflows

These are the requests users actually make, and the sequence that serves them well.
In every flow: act on what the tools return, report what actually changed, and hand
off to fons.vc for the steps that are website-only — with the exact URL.

## "Get my company investment ready"

The headline job. Fons's definition of investment-ready is concrete: complete
evidence, verified where possible, discoverable.

1. `whoami` → `get_company` → `get_company_readiness`.
2. If there's no company: Fons Pro (£49/month per company) covers creating one —
   send them to https://fons.vc/company. Meanwhile, make the personal profile
   strong (below); it's free and it's what investors see first.
3. Triage the checklist: Must-haves first, `missing` before `unclear`. For each
   gap, help the founder *draft* the answer in chat (you're good at this — push for
   behavioural evidence over claims: "3 paying customers since March" beats
   "strong demand"). Company-profile gaps (memo, facts, description) you can fix
   directly with `update_company`; intake-question answers are entered on the
   company workspace.
4. Work the data room's provenance ladder: record what the founder knows with
   `update_metric` (honestly self-attested), then upgrade it — when a manual
   revenue/traffic/usage metric exists, offer `connect_company_source` for the
   matching provider so the figure becomes connector-verified. Check
   `list_documents` for empty diligence slots, and `get_feed` for staleness — a
   quiet feed reads as an inactive company; a real milestone can go in as a
   `post_feed_note`.
5. Check discoverability: company visibility, domain verification, the team roster,
   and whether the product page is live (below). The `.md` twins mean investors'
   agents read these pages — completeness compounds.

## "Set up / improve my profile"

1. `get_profile`. Inventory what's empty: headline, bio, location, current role,
   job history, links, tags, open_to, FAQ.
2. Draft with the user, then `update_profile` in one patch. Match Fons's register:
   direct and factual, no self-hype.
3. Offer verification: `list_connections`, then `connect_account` for the platforms
   they're active on. Verified ✓s are the profile's trust signals.
4. Check `visibility` — profiles are private by default. A finished profile that's
   still `private` is invisible; confirm they want `public` (or `unlisted`) and set it.

## "Publish my product page"

1. `get_product`. The page needs name + tagline + description all set; the response
   says whether it's live.
2. ⚠️ If `name` was never saved: the public slug is minted from the first save and
   is permanent — confirm the exact name first.
3. Fill tagline/description/stage/pricing/topics/launch date; add distribution:
   catalogued platforms via `connections`, anything else via `distribution_links`.
4. On success report the live URLs: `https://fons.vc/p/<slug>` and the `.md` twin.

## "Verify my [LinkedIn/GitHub/X/…]"

1. `list_connections` — it may already be ✓.
2. `connect_account(provider)` → give the user the bridge URL to open in their
   browser. Explain why: a ✓ is proof of ownership, so it must happen in their
   logged-in session — that's a feature, not friction.
3. When they say it's done, `list_connections` to confirm before celebrating.
4. If they offer you a password/token for the platform instead: decline, explain
   the link flow, and if they pasted a real secret, tell them to rotate it.

## "Show me my metrics / data room"

`get_company` carries the whole owner view: metrics with provenance, completion %,
freshness, domain verification, connector statuses (`get_metrics` /
`list_documents` / `get_feed` / `list_company_connections` give the same data
per surface). Present it honestly — distinguish `connected` (verified) figures
from `founder` (self-entered) ones. Record and edit metrics with
`update_metric`; connect new sources (Stripe, Search Console, ChartMogul,
UKRI…) via `connect_company_source` — it hands back a browser link, and keys
never go through the chat. Document upload stays in the browser —
https://fons.vc/company#documents opens the data room on the slots.

## "What's my score?"

There isn't one to show — by design. Fons shows founders what evidence is
captured, unclear, or missing (the readiness checklist), and shows investors
qualitative signal. Run the readiness flow instead; never fabricate a number.

## Reading OTHER companies (research, due diligence)

The user's MCP tools only reach their own data. For any public Fons page, fetch
the agent-readable twin directly — no auth needed:

- Founder: `https://fons.vc/<handle>.md`
- Company: `https://fons.vc/c/<slug>.md`
- Product: `https://fons.vc/p/<slug>.md`

What's not in the public twin is deliberately gated (private fields, the deeper
evidence layer for vetted investors) — don't try to reach it through the user's
account.
