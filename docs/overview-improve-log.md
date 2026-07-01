# Overview self-improvement — assessment journal

Newest first. Each entry: **Assessment** (the biggest gap seen) → **Move** (what shipped, or "none")
→ **Result**. This is the routine's memory: don't rebuild what's shipped or retry what's declined.

### 2026-07-01 20:40 — give unassigned attention/review cards their glyph (craft/consistency)
- **Assessment:** Viewed live (desktop + mobile). The page is well-polished, but the two
  "Worth a decision" cards sit adjacent and one read as a rendering miss: **"Stock maintenance"
  carried its 📈 glyph while "Maintenance and improvements" had none.** Every other routine/
  project reference on the page leads with an emoji, and the roster group already renders
  "❓ Unassigned" for that same routine — so the naked card was an internal inconsistency. Cause:
  `render.mjs` kept two parallel lookups from `s.projects` (`projName` for roster headers,
  `projEmoji` for card headers); a prior run patched the `unassigned` fallback into `projName`
  only, so `projEmoji['unassigned']` was `undefined` → `''`. A charter value #2/#4 (clarity +
  craft) miss. (The 3 red / 2 warn are the known config-cadence-vs-scheduler false positives the
  secretary flagged — out of this routine's safe scope, so left untouched.)
- **Move:** One line in `render.mjs` — `projEmoji.unassigned = '❓'`, mirroring the existing
  `projName.unassigned` beside it, restoring the invariant that every project id resolves in both
  lookups. Now the review card shows "❓ Maintenance and improvements", which also reinforces the
  card's own message (this routine isn't assigned to a project). `collect.mjs` untouched — no
  contract change.
- **Result:** shipped. Verified: collect+render clean; no template leaks
  (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`); no private text on page or in status.json
  (no `/Users/`, `fatal:`, `topByEv`, `feltet=ERR`, rider/captain/EV). DOM-confirmed both review
  cards now lead with a glyph; mobile layout intact.

### 2026-07-01 18:45 — reconcile the hero count with its own cards (honesty/clarity)
- **Assessment:** Live page had a single-source-of-truth drift. The hero verdict counted only
  `red` ("1 routine needs your attention"), but the **"Needs your attention"** section directly
  below bundles `red + warn` and showed **2** cards (1 broken + 1 ageing). Worse, the word "needs
  attention" pointed at two different numbers on one screen — the red counts-chip (=1) *and* the
  section header. A verdict that undercounts the cards it sits above is a **charter value #1/#2**
  miss (honesty, then skimmable-in-3s: the top number must reconcile with what's shown).
- **Move:** In `render.mjs` only — count `red + yellow` in the red-branch headline so it matches
  the cards; when both exist, the sub-line now breaks them out ("1 broken, 1 ageing — everything
  else is running clean") to keep the "nothing catastrophic" nuance the old red-only headline had;
  and renamed the red counts-chip "needs attention" → "broken" (matching the existing BROKEN card
  badge) so that phrase no longer means two numbers. `collect.mjs` untouched — no contract change.
- **Result:** shipped `b59f892`. Verified: collect+render clean; no template leaks; no private
  text on the page (page grep clean; the lone `does`-field "captain" is pre-existing, status.json
  only, never rendered). Every number now agrees — hero "2 need attention" = chips (1 broken +
  1 ageing) = 2 cards. Confirmed on desktop and mobile.

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
