# Deep links — the exact destination for every website-only action

Read this when you're about to say "that happens on the website." Every page below accepts
a **fragment** that opens the right section and focuses the control. Use one, and the
founder lands on the thing instead of hunting for it.

Two rules, and they matter more than the table:

1. **Only use a fragment from this list.** An invented one (`#avatar-upload`,
   `#profile-photo`) is not an error — the page quietly loads at its root. So the founder
   follows a specific, confident instruction and lands somewhere general, and you sound
   wrong about something you were right about. If the destination isn't here, link the
   page root and say plainly where to look.
2. **These are stable.** They're a published contract, checked on every deploy against the
   app itself (`website/scripts/deep-link-lint.mjs`). You can hand one out and trust it.

---

## `https://fons.vc/profile` — the personal profile

| Fragment | Opens |
|---|---|
| `#details` | Your details — name, handle, headline, about, location, photo |
| `#photo` (or `#avatar`) | Your details, cursor on the **photo picker** |
| `#name` | Your details, cursor on **full name** |
| `#handle` | Your details, cursor on **handle** (choosing your own needs Fons Pro) |
| `#headline` | Your details, cursor on **headline** |
| `#about` (or `#bio`) | The About editor — bio + the open-to ticks |
| `#status` | Status — the ONE promoted open-to signal + its one-line note |
| `#location` | Your details, cursor on **location** |
| `#career` | Career — current role and job history |
| `#jobs` | Career, cursor on **add a past role** |
| `#expertise` | Expertise — sectors worked in (≤3) + skills (typeahead, free text allowed) |
| `#faq` | FAQ — their own Q&A block |
| `#credentials` | Credentials — certifications |
| `#connections` | Connections — the verified-account rail |
| `#linkedin` `#github` `#x` `#youtube` `#twitch` `#discord` | Connections, on that provider's row |
| `#links` | Additional links — website, blog, and the CV |
| `#cv` | Additional links, on the **CV upload** (a CV autofills most of the profile) |
| `#visibility` | Visibility — public / unlisted / private |

## `https://fons.vc/company` — the company workspace + data room

| Fragment | Opens |
|---|---|
| `#details` | Details — identity, narrative, sector/stage/location, links |
| `#team` | Team — headcount evidence, the member roster, and invites |
| `#connections` | Connections — company data sources and platform profiles |
| `#visibility` | Visibility — publish or unlist the public `/c/` page |
| `#primary` | Primary organization — which company they're mainly building |

The evidence and diligence sections moved to their own pages (below, IA-1). The old
`/company#metrics`, `/company#documents`, `/company#dataroom`, and `/company#legal` links
**keep working forever** — they forward — but hand out the new ones.

There is deliberately **no fragment for creating a company**. Creating or claiming one is a
paid, consequential act — let them arrive at it themselves, don't deep-link them into it.

## The Data Room and Due Diligence — every section is its own PAGE

Since 2026-07-16 these sections are real pages — **hand out the page URL, no fragment
needed**. The old fragment forms (`/dataroom#metrics`, `/diligence#legal`, …) keep
working forever — they redirect to the page — but the clean URLs below are canonical.

| Page | What's there |
|---|---|
| `https://fons.vc/dataroom/metrics` | Key Metrics — the numbers, and the connectors that verify them |
| `https://fons.vc/dataroom/documents` | Documents — the diligence document slots (**upload is browser-only**) |
| `https://fons.vc/diligence/preparation` | Preparation — the investor-question checklist (Must/Should/Could gap map). Link it for "what's missing before I approach investors". (Old `/diligence/readiness` URL 301s here forever) |
| `https://fons.vc/diligence/legal` | Legal & admin — entity, company number, incorporation, accreditations |
| `https://fons.vc/diligence/capital` | Capital / Raising — raise status + target investors (a signal only, never amounts or terms) |
| `https://fons.vc/diligence/market` | Market & positioning — TAM/SAM/SOM with method, competition & moat, team & fit |
| `https://fons.vc/diligence/references` | Customer references — consenting customers who'll confirm they're buying |
| `https://fons.vc/messages/requests` | Investor requests — what vetted investors asked the data room for (moved under Messages) |
| `https://fons.vc/insights/profile` | Profile insights — views + interactions on the public profile |
| `https://fons.vc/insights/company` | Company insights — vetted investor views of the company page |

## `https://fons.vc/product` — the product page behind `/p/<slug>`

| Fragment | Opens |
|---|---|
| `#details` | Logo, name, tagline, stage, website |
| `#about` | Description + topics |
| `#launch` | Pricing, launch date, demo video |
| `#distribution` (or `#connections`) | Where the product is listed and launched |

## `https://fons.vc/account/settings` — the account

| Fragment | Opens |
|---|---|
| `#notifications` | Product-update opt-in |
| `#mfa` (or `#two-factor`) | Two-factor authentication (required for investor + admin accounts) |
| `#apps` (or `#connected-apps`) | Connected apps — **revoke an agent's access here**, including yours |
| `#privacy` (or `#export`) | Privacy & data — export or delete the account |
| `#voice` | Voice input (admin accounts only — the card is hidden otherwise) |

Settings fragments **scroll to the card and stop there** — they never put the cursor on a
button. That's on purpose: landing on a page and pressing Space is how people scroll, and
Space activates a focused button. A link someone else sent you should never be one keystroke
from an action you didn't choose. So there is no fragment that pre-arms account deletion, and
none that fires the export — the founder clicks it themselves.

## `https://fons.vc/account/billing` — plan, £49/mo company subscription, manager seats

No fragments — it's a single page.

## Other links worth knowing

| | |
|---|---|
| Sign up (free) | `https://fons.vc/app` |
| Their public profile | `https://fons.vc/<handle>` · agent twin `https://fons.vc/<handle>.md` |
| Their company page | `https://fons.vc/c/<slug>` · agent twin `https://fons.vc/c/<slug>.md` |
| Their product page | `https://fons.vc/p/<slug>` · agent twin `https://fons.vc/p/<slug>.md` |

The `connect_account` and `connect_company_source` tools already return a **bridge URL**
(`https://fons.vc/profile?connect=<provider>`) that starts the browser link flow on arrival.
Pass those through exactly as given — don't rewrite them into a fragment from this table.
