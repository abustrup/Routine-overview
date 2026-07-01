# Overview self-improvement — assessment journal

Newest first. Each entry: **Assessment** (the biggest gap seen) → **Move** (what shipped, or "none")
→ **Result**. This is the routine's memory: don't rebuild what's shipped or retry what's declined.

### 2026-07-01 17:30 — surface note-level degradations (honesty)
- **Assessment:** Two private holdet routines (evening pass, DNS guard) carry an info/note-level
  "a data source is degraded" issue, but `render.mjs` dropped note-severity entirely — showing
  them as spotless green "ran — no errors detected" rows. A known degradation rendered as a clean
  green is a soft **charter value #1 (honesty)** miss ("uncertainty shown, not hidden"). The
  `infos` variable in `render.mjs` was the dead vestige of an intent to render them.
- **Move:** In `routineRow`, when no error/warn issue exists, fall back to a note issue and show
  its (already-sanitized) line in the muted headline slot with a new `.row__head--note` class
  (warm amber `--amber`, dimmer than a warn; health dot stays green — honest two-truths). Deleted
  the dead `infos` variable. `collect.mjs` untouched; note text is the sanitized "details are
  local-only" phrase — no leak.
- **Result:** shipped. Verified: collect+render clean; no template leaks; no private text on the
  public page ("captain" grep hit is a pre-existing benign `does` description in status.json only,
  never on the page); note rows render amber+green-dot on desktop and wrap on mobile.

### seed — 2026-07-01
- **Assessment:** v1 is live: dependency-free collector reconstructs health from artifact-truth,
  a renderer produces a calm editorial page, hourly secretary + this self-improve routine run it.
  The dashboard was just redesigned toward the Anthropic aesthetic (warm ivory, clay accent) with
  a copy-paste "fix prompt" per attention item. Known open product questions live in the "Worth a
  decision" section of the live page.
- **Move:** none — this run seeds the Charter + journal so future runs self-direct rather than
  consume a task list.
- **Result:** seeded `CHARTER-overview.md`, `routines/overview-improve.md`, and this journal.
