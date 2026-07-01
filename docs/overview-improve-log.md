# Overview self-improvement — assessment journal

Newest first. Each entry: **Assessment** (the biggest gap seen) → **Move** (what shipped, or "none")
→ **Result**. This is the routine's memory: don't rebuild what's shipped or retry what's declined.

### 2026-07-02 00:45 — project "Latest" line no longer ships raw git-log rationale that argues with the hero (clarity/honesty)
- **Assessment:** Viewed live (desktop + mobile, light). Page is well-polished; the single worst
  element was the **Routine Overview** project card's *Latest* line, which rendered this dashboard's
  own last commit subject verbatim: `overview: … 16🟢 0🟡 4🔴 (4 red false: 3 config-cadence drift
  vs daily scheduler + 1 flagged holdet error, already notified)`. Two problems: (1) it's a wall of
  internal operational chatter on an otherwise calm editorial surface — the three producer projects
  show clean subjects (`brief: 2026-07-01`), so only the meta project exposed this; and (2) the
  parenthetical literally says **"4 red false"** directly under a hero verdict reading **"4 routines
  need your attention / 4 broken"** — the page argues with itself. A charter value #1 (honesty
  coherence) + #2/#4 (skimmability/craft) miss. Cause: `lastPublishSubject` is a derived view of a
  commit subject, so the secretary's verbose status-line commit style leaked onto the public page.
- **Move:** In `collect.mjs` only — strip a *trailing* parenthetical (`/\s*\([^()]*\)\s*$/`) from the
  public project subject before it's written to `status.json`. General, not a meta special-case: a
  trailing `(…)` in a commit subject is git-log rationale, not dashboard copy. The three producer
  subjects have no trailing paren, so they're untouched; the meta line becomes the clean
  `overview: 2026-07-02 00:19 — 16🟢 0🟡 4🔴`. Fixing in collect (not render) keeps the public
  `status.json` honest too. Contract preserved: no change to `private.roots` sanitisation (private
  repos still render `updated`), `attentionKey`, or the two-truths health model.
- **Result:** shipped. Verified: collect+render clean; no template leaks
  (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`/`{HOME}`); no private text on the page (index.html
  grep clean for `/Users/`, `fatal:`, `captain`, `topByEv`, `feltet=ERR`, rider/EV — the residual
  grep hits are benign: "secretary" contains "secret", "secrets" is intentional prompt copy, and the
  lone "captain" is the pre-existing `does`-field in status.json only, never rendered). DOM-confirmed
  all four project cards now carry clean, consistent Latest lines on desktop; mobile intact.

### 2026-07-01 22:47 — attention cards show the concrete condition, not a name-repeating guide (honesty/skimmability)
- **Assessment:** Viewed live (desktop + light/dark). The fleet had gone into a batch-stale
  state (5🔴 1🟡), so the "Needs your attention" section was a stack of near-identical cards —
  and each one **stated the routine name twice**: the card header already renders
  `📈 Dashboard self-improve`, then the body rendered `a.fix.guide`, which *starts with the same
  name* ("Dashboard self-improve hasn't produced output when expected (Every 2h)."). Worse, the
  guide **dropped the concrete age**: the more-informative `a.message` ("Stale — last output
  **6h ago** (expected Every 2h).") was sitting unused. A charter value #1/#2 miss — honesty
  (show *when*, per "uncertainty shown, not hidden") plus skimmability ("every element earns its
  place"). The two card renderers were the only consumers of `guide`, and for review cards
  `guide === message` already, so this was also latent duplication.
- **Move:** In `render.mjs` only — both `attnCard` and `reviewCard` now render `a.message`
  instead of `a.fix ? a.fix.guide : a.message`. Result: no card repeats the header's name; every
  stale/ageing card shows the real age ("last output 6h ago"); the private error card reads
  "error detected in improve.log — details are local-only", keeping the two-truths honesty visible
  on the card. The copy-fix-prompt affordance (`fixBlock`, which uses `a.fix.prompt`) is untouched;
  `guide` stays in `status.json` (harmless). `collect.mjs` untouched — no contract change.
- **Result:** shipped. Verified: collect+render clean; no template leaks
  (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`/`{HOME}`); no private text on the page (grep of
  index.html clean for `/Users/`, `fatal:`, `topByEv`, `feltet=ERR`, rider/captain/EV — the lone
  "captain" hit is the pre-existing benign `does` field in status.json only, never rendered).
  DOM-confirmed all six attention-card bodies render the concrete condition on desktop; light+dark
  intact.

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
