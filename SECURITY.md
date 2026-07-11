# Security

## Reporting a vulnerability

**Do not open a public issue.** Email **admin@fons.vc** with:

- what you found, and where (a file here, or an endpoint on fons.vc),
- how to reproduce it,
- what an attacker could actually do with it.

We will acknowledge within **72 hours** and keep you updated until it is closed. If you want
credit, say so and you'll get it. If you'd rather stay anonymous, that's fine too.

Please don't test against other people's accounts or companies. Use your own — a free account
at [fons.vc/app](https://fons.vc/app) gives you a profile to attack, and we would much rather
you find it than someone else.

## What's in scope

Everything in this repository, plus the surface it talks to:

- `https://fons.vc/mcp` — the MCP server (OAuth 2.1, PKCE, dynamic client registration)
- `https://fons.vc/api/v1/*` — the Bearer-token resource API the CLI uses
- `https://fons.vc/oauth/consent` — the consent screen
- the `fons` CLI's token handling

Particularly interesting to us — these are the invariants the product depends on:

- **Cross-account access.** Any path by which a token issued to one account touches another
  account's data. Authorization is enforced by row-level security in the database, not by the
  client; a hole in that is the most serious thing you can find here.
- **Provenance forgery.** Any way to make a self-entered metric appear `connected` (verified),
  to write a trust badge, or to post a verification event to the append-only feed. These
  assertions are what an investor relies on; being able to fake one is a critical bug even
  though it touches no one else's data.
- **Credential leakage through an agent session.** Anything that causes a key, token or
  document *content* to flow back through a third-party AI conversation. The Skill is written
  to refuse credentials outright — if you can make it accept or emit one, we want to know.
- **Permission escalation.** A view-only team member writing; a lapsed subscription still
  editing; an agent editing a company the user doesn't belong to.

## What's out of scope

- Anything requiring physical access, a compromised device, or social engineering of a user.
- Rate-limiting or volumetric denial of service. Please don't.
- Missing hardening headers with no demonstrated impact, and automated-scanner output with no
  working proof of concept.
- Reports that a public profile is public. Profiles are private by default and their owners
  choose to publish them; `fons.vc/<handle>.md` being readable by an agent is the product, not
  a leak.

## What we do on our side

Not a claim of certification — just the controls that are actually in place, so you know what
you're looking at:

- Authorization is enforced **server-side** on every call (RLS + explicit checks). Client-side
  gates are UX only, never the boundary.
- Sessions live in `httpOnly`, `Secure`, `SameSite` cookies the browser's JavaScript cannot
  read. Tokens never appear in URLs or logs.
- The agent surface runs **as you** — a user-scoped token, never a privileged one. The
  service-role key is never on a path a user can reach.
- Fail closed: an error, a timeout, or an unexpected state denies the request.
- An enforcing Content-Security-Policy, rate limiting, CAPTCHA, and server-side validation sit
  in front of the auth surface. Removing any one of them must not open the door.
