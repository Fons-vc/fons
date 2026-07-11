# Contributing

Thanks for looking. A few things worth knowing before you spend time.

## This repo is generated

`plugins/fons/skills/fons/` and `cli/` are **published from the Fons monorepo**, which is
private. That means:

- **Pull requests are welcome and we will land them** — we apply the patch upstream and it
  flows back here on the next release. You'll be credited on the commit.
- **A direct push to `main` here would be overwritten** by the next publish. Don't rely on it.
- Everything else in the repo — `README.md`, `SECURITY.md`, the plugin manifests, the banner —
  lives here and can be edited directly.

## The most useful bug you can file

**A bad instruction.** The Skill's job is to make an agent act correctly on a founder's real
company data. If your agent did something wrong-headed while using it — edited the wrong
company, invented a field, claimed something was verified when it wasn't, asked you for a
credential, or sent you to a page that doesn't have the control it promised — that is a real
defect and we want it.

Please include:

- the prompt you gave it,
- what the agent did,
- what it should have done.

A transcript is worth more than a description. Redact anything private first.

## What we will say no to

- **Anything that widens what an agent may assert.** Verified connections, trust badges and
  `connected` metric provenance are written by a live connector or a proven browser session,
  never by an agent. This isn't a limitation to route around — it's the reason the data is
  worth anything to an investor.
- **Anything that surfaces a score.** Fons reports readiness as statuses and bands. There is no
  number to expose, and adding one would make the rubric a target.
- **Credential handling in-session.** Keys and tokens go into a browser, on a Fons page, in the
  user's own logged-in session. A PR that accepts an API key through a chat message will be
  closed, however convenient it is.

## Style

The Skill is written to be *read by a model*: direct, technical, honest, and explicit about
*why* a rule exists — a model that understands the reason will generalise it to the case we
didn't anticipate. No motivational filler, no hedging, no invented capability. If you're adding
guidance, explain the failure it prevents.

## Licence

By contributing you agree that your contribution is licensed under
[Apache-2.0](LICENSE), like the rest of the repository.
