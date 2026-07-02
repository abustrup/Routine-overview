# Overview self-improvement — assessment journal

Newest first. Each entry: **Assessment** (the biggest gap seen) → **Move** (what shipped, or "none")
→ **Result**. This is the routine's memory: don't rebuild what's shipped or retry what's declined.

### 2026-07-02 20:41 — stale-banner threshold tracks the secretary's real cadence, not a hard-coded 90 min (honesty)
- **Provenance (read first):** Found **uncommitted WIP** in the tree at run start (not journaled, not
  committed) — a `staleAfterMin` feature (`collect.mjs` + `render.mjs`) plus a stray one-line
  `config/projects.json` edit. I did **not** commit blindly: I read all 16 lines, re-derived the
  computation against live config, exercised both banner branches + the fallback, and judged the feature
  on its merits as if writing it fresh. The stray projects.json edit I **reverted** (see below). Adopting
  a verified, self-contained, interrupted-WIP improvement is legitimate; a future run should not treat this
  as licence to commit unread working-tree changes — the gate (understand every line + verify) is the bar.
- **Assessment:** Viewed live (collect+render, judged against the Charter). Fleet healthy (19🟢/0🟡/1🔴/1⏸
  — the lone red is the familiar sanitized holdet `improve.log` error, out of this routine's safe scope).
  The genuine miss was a **charter value #1 (honesty — no false alarm)** one baked into render: the "This
  overview may be out of date" banner used a hard-coded `ageMin > 90`. That constant was correct when the
  secretary ran hourly, but it moved **hourly → every-5h** (commit `18aef07`), so the page is *expected* to
  be up to 5h old on a perfectly healthy schedule — yet the banner fired after 90 min, crying wolf on every
  normal refresh gap and eroding the one signal that's supposed to mean "the secretary actually stopped."
  The banner copy also still said "hourly secretary," now factually wrong.
- **Move:** Kept + completed the WIP (verified sound). In `collect.mjs`: derive the threshold from the
  secretary's *own* configured period — `staleAfterMin = round((secretary.periodHours + 1h grace) * 60)`,
  looking the routine up in `[...routines, ...launchd]` by id, falling back to 5h if the id ever changes;
  write it into `status.json`. In `render.mjs`: `isStale = ageMin > (s.staleAfterMin || 360)` (6h fallback
  for any older status.json predating the field), and fixed the copy "hourly secretary" → "secretary."
  Now the banner's threshold and the schedule co-vary — they can't silently drift apart again. **Reverted**
  the stray `projects.json` edit (self-improve routine `cadence "Every 3h"→"Every 2h"` while `periodHours`
  stayed `3`): internally inconsistent, unrelated to the feature, and it would reintroduce the exact
  cadence-drift the secretary just cleared in `e7c8bb8`; cadence↔scheduler-truth alignment is the
  secretary's lane, not verifiable from here. Contract preserved: no change to `private.roots`
  sanitisation, `attentionKey`, the two-truths health model, or render's escaping/fix-prompt UX.
- **Result:** shipped `480bd1c`. Verified: collect+render clean; `staleAfterMin=360` in status.json
  (secretary periodHours 5 → (5+1)·60 ✓); simulated a 5h-old page → **not** stale and a 7h-old page →
  stale (old 90-min threshold false-alarmed both); field-absent fallback → 360. No template leaks
  (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`/`{HOME}` = 0 in index.html); `hourly secretary` = 0 on
  page; no private text on page (`/Users/`/`fatal:`/`topByEv`/`feltet=ERR`/rider/captain/EV = 0). The one
  `captain` in status.json is the pre-existing benign `Holdet Team B cycle` `does` field (status.json only,
  never rendered, owner-only reclassification decision) — unchanged by this run. Counts unchanged.

### 2026-07-02 17:30 — strip the secretary's status-line prefix from public commit subjects (clarity)
- **Assessment:** Viewed live (collect+render, judged against the Charter). The fleet is healthy
  (19🟢/0🟡/1🔴/1⏸ — the lone red is the familiar sanitized holdet `improve.log` error, out of this
  routine's safe scope). With no broken/flaky element, the one genuine remaining **clarity** miss was
  this routine-family's *own* commits looking noisy on the calm surface. The secretary now commits in
  the format `overview: <date> — <counts> · <what changed>` (e.g. `overview: 2026-07-02 16:42 — 19🟢
  0🟡 1🔴 · fix secretary cadence drift …`). That subject renders verbatim in **two** public places —
  the roster row "Routine secretary (this)" and the Routine Overview project's "Latest" line — and both
  the `19🟢 0🟡 1🔴` counts (exact duplicate of the hero chips) and the date (duplicate of the "Updated"
  stamp) are pure restatement; only the text after ` · ` is signal. Two prior runs (`00:45`, `05:00`)
  already judged raw secretary status-line commits a clarity miss and stripped them, but they targeted
  the *old* format where the noise sat in a **trailing paren** (`… 5🔴 (4 reds are false …)`);
  `cleanSubject`'s trailing-`(…)` regex no longer catches the new leading-prefix format. A charter
  value #2 (skimmability) miss — the same principle, evading the existing fix.
- **Move:** In `collect.mjs` only — extended the single `cleanSubject` helper (the one home already
  applied at every public commit-subject boundary: `resolveFreshness`'s gitAny/gitSubject and the
  project "Latest" line, so both surfaces inherit the fix from one edit). Added a first pass: when a
  subject contains **both** a health-dot emoji (`🟢🟡🔴⏸`) **and** a ` · `, keep only the part after the
  final ` · `. The dual guard makes it fire *only* on status-line commits — producer subjects
  (`brief: 2026-07-02`, `refactor: unify …`, `improve: …`) carry no health emoji, so they pass through
  structurally untouched (no allowlist to maintain). Verified against the real HEAD (extracts `fix
  secretary cadence drift (hourly→every-5h) to clear false-stale red`) and all four project subjects
  (only `meta` changed). The trailing-paren strip is preserved as pass 2. Used alternation
  `/🟢|🟡|🔴|⏸/` not a char class (those emoji are surrogate pairs — a `[…]` class matches individual
  surrogate halves). Contract preserved: no change to `private.roots` sanitisation, `attentionKey`, the
  two-truths health model, or render's escaping/fix-prompt UX (render untouched).
- **Result:** shipped `284756d`. Verified: collect+render clean; DOM-confirmed both the roster row and
  the Routine Overview "Latest" line now read `fix secretary cadence drift …` (no date, no emoji counts);
  the other three project "Latest" lines unchanged (holdet dashboard / stock refactor / news rolling
  weekly). No template leaks (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`/`{HOME}` = 0); no private
  text on page or in status.json (`/Users/`/`fatal:`/`topByEv`/`feltet=ERR`/rider/captain = 0); no
  status-line count strings (`19🟢 … 1🔴 ·`) left in index.html; no console errors. Counts unchanged.

### 2026-07-02 — dismissible "Needs your attention" flags (owner request — NOT an autonomous self-improve run)
- **Provenance (read this first):** Requested directly by Alexander — *"make it possible to hide or delete
  the red flags if I feel they are fixed or don't need my attention any more."* Implemented via Claude Code,
  not a self-improve judgement call. Logged here only so a future self-improve run doesn't mistake the dismiss
  UI for cruft and simplify it away, or rebuild it from scratch. Do not treat it as precedent for the routine
  editing render's interaction model on its own.
- **Assessment:** The overview could surface attention flags but gave the owner no way to clear one he'd
  judged handled (e.g. the standing cadence-vs-scheduler false positives). Because the page is static and
  rebuilt hourly from artifact-truth, a "delete" can't touch the source — the next `collect` reconstructs it.
  So the honest shape is a client-side, per-device suppression layer that only decides what to *show*.
- **Move:** `render.mjs` only (output regenerated). Each attention + review card gets `data-akey` +
  a dismiss `×`. A self-cleaning `localStorage` controller (`routine-overview:dismissed:v1`) hides dismissed
  cards, keyed by **`severity:routine:kind`** — the same identity `collect` already uses for `attentionKey`
  notification de-dupe — so a stale flag whose "16h ago" text drifts hour-to-hour stays dismissed, while a
  genuinely different problem gets a new key and resurfaces. On load it **prunes** any dismissal whose flag is
  absent from the current page (issue resolved upstream) or older than 30 days, so a real recurrence is never
  silently re-hidden. Per-section "Show hidden" restore + an Undo toast; a distinct honest empty state when a
  whole section is hidden. The hero verdict and factual count chips are deliberately **untouched** — hiding
  declutters the cards only, never the numbers. No change to `collect`, `status.json`, the two-truths model,
  `attentionKey`, or the fix-prompt UX; stores only the key locally, ships no new data to the public JSON.
- **Result:** shipped `c627757`. Verified in-browser: dismiss persists across reload; self-clean prunes
  absent + aged keys while keeping valid ones; per-section restore, cleared-state restore, and Undo all work;
  no console errors; the pristine (no-dismissal) view is unchanged.

### 2026-07-02 08:40 — sanitize private routines' `does` so holdet strategy stops shipping publicly (trust/honesty)
- **Assessment:** Viewed live (collect+render, judged against the Charter; fleet in its known batch-stale
  15🟢/1🟡/4🔴/1⏸, the reds the familiar config-cadence-vs-scheduler false positives + one sanitized holdet
  error, all out of this routine's safe scope). The genuine miss was a **charter value #1** one that six prior
  runs had waved through as "benign — status.json only, never rendered": the routine `does` description. It's
  never page copy, but it reaches the **public surface two ways** — (a) `data/status.json` is a *tracked file
  in a public repo*, so its raw contents are published regardless of the HTML; and (b) `fixFor` splices `does`
  into the rendered copy-fix **prompt** whenever a routine is broken. The result: seven private (holdet) routines
  were shipping strategy-bearing descriptions publicly — `"Red-team audit + fixer of the holdet bot (third
  brain)"`, `"…collect → decide → notify+veto → execute+verify on holdet.dk"`, `"Backtest + optimize weights…"`
  — and two of them (Holdet LLM brain, Holdet improve loop), being red right now, had that text **live in their
  rendered fix prompts**. `scrubPublic` misses these because they're strategy phrasing, not auth-paths/secrets/
  home. The existing privacy model already sanitizes `headline` and `issues` for private routines; `does` was
  simply the field it forgot.
- **Move:** In `collect.mjs` only — one line in `buildRoutine`: `does: r.does` → `does: priv ? null : r.does`
  (`priv` = the existing `routineIsPrivate(r)`), sanitizing `does` alongside `headline`/`issues`. `does`'s only
  consumer is `fixFor` (in-memory), so nulling it for private routines cleanly drops the leak from **both** the
  public JSON and the rendered prompt (fixFor's `r?.does ? …` guard already yields no parenthetical) — the prompt
  stays fully actionable (routine name + cadence/cwd + "read the local log"). All 15 public routines keep their
  descriptions untouched. Contract preserved: no change to `private.roots` sanitisation, `attentionKey`, the
  two-truths health model, or render's escaping/fix-prompt UX (render untouched).
- **Result:** shipped `2325d9d`. Verified: collect+render clean; the 7 private `does` are now `null` in
  status.json and all 15 public ones retained; the two private broken routines' rendered prompts no longer carry
  their descriptions; `third brain`/`notify+veto`/`Backtest`/`execute+verify`/`re-deciding`/`new captain` = 0 in
  index.html. No template leaks (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`/`{HOME}` = 0); no private text on
  the page (`/Users/`/`fatal:`/`topByEv`/`feltet=ERR` = 0). Counts unchanged (15🟢/1🟡/4🔴/1⏸, 21 total).
- **Noted for a future run (flag, not this run — needs an owner call):** `Holdet Team B cycle` is `private:false`
  (its artifact isn't under `private.roots`), so its `does` — `"Forced swap + new captain each run on the Team B
  entry; auto-stops when the Tour starts."` — still ships in status.json. Closing it means either reclassifying
  the routine (touching `private.roots`, an owner-only rail) or rewriting the config `does` prose — a judgment
  call, not a collector-logic fix. Left for Alexander to decide.

### 2026-07-02 06:15 — delete the dead `summary.needsAttention` field (simplify/restraint)
- **Assessment:** Viewed live (collect+render, judged against the Charter). The page itself is deeply
  polished — the fleet is in its known batch-stale state (15🟢/0🟡/5🔴/1⏸), and those 5 reds are the
  familiar config-cadence-vs-scheduler false positives the secretary already flags for a decision, out
  of this routine's safe scope (false-green danger) so left untouched. With no genuine live *visual*
  miss to fix, the highest-leverage safe move was the simplify the **prior run explicitly teed up**:
  `summary.needsAttention` in `collect.mjs` was dead — written to the public `status.json` but read by
  **nothing**. Proof of deadness is complete here because the producer/consumer contract is closed:
  `collect.mjs` writes `status.json`; the only two consumers are `render.mjs` (line 55 destructures just
  `{green,yellow,red,paused,total}`) and `publish.sh` (reads only `green yellow red paused`). A repo-wide
  grep found the field in exactly two places — the collect definition and its own output. It also put a
  stray, un-rendered `5` in the public JSON that reconciles with nothing a reader sees. A charter value #3
  (restraint — simplify/remove before adding) tidy.
- **Move:** In `collect.mjs` only — removed the single `needsAttention:` line from the `summary` object.
  The value isn't lost: the identical `red||warn` filter predicate lives on right below in `attentionKey`,
  which is the field that's actually consumed (notification de-dupe). `summary` now = `{green, yellow,
  red, paused, total}`, every field with a live consumer. Contract fully preserved: no change to
  `private.roots` sanitisation, the `attentionKey` de-dupe, the two-truths health model, or render's
  escaping/fix-prompt UX (render untouched).
- **Result:** shipped `4cc3768`. Verified: collect+render run clean; `needsAttention` gone from
  `status.json` (`grep -c` = 0); summary chips still reconcile (15+0+5+1 = 21 = total). No template leaks
  (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`/`{HOME}` = 0 in index.html); no private text on the page
  or in status.json (`/Users/`/`fatal:`/`topByEv`/`feltet=ERR` = 0 in both).

### 2026-07-02 05:00 — roster rows get the same commit-subject cleaning as project cards (clarity/unify)
- **Assessment:** Viewed live (desktop, then DOM-verified). The page is deeply polished; the one genuine
  live miss was in the **roster**. The `Overview self-improve` row rendered its own last commit subject
  verbatim — `improve: hero 'routines total' excludes retired so it reconciles with the counts chips
  **(honesty/clarity)**` — trailing git-log rationale on the public page, on the *self-improvement
  routine's own row* no less. This is exactly the parenthetical a prior run (`b68948e`, 2026-07-02 00:45)
  identified as "git-log rationale, not dashboard copy" and stripped — but only from **project cards**.
  The fix never reached the roster because `cleanSubject` was a *local* const inside the projects loop,
  so the roster's git-derived headlines (`gitAny`/`gitSubject` in `resolveFreshness`) still shipped raw.
  A charter value #2/#3 miss (skimmability + the same principle applied inconsistently in two places).
  The 5🔴/1🟡 are the known config-cadence-vs-scheduler false positives the secretary flags — out of
  this routine's safe scope, left untouched.
- **Move:** In `collect.mjs` only — hoisted `cleanSubject` to module scope (one home) and applied it at
  the *source*: `resolveFreshness` now cleans `gitAny`/`gitSubject` subjects, so `status.json` itself is
  honest and every consumer (roster today, any future view) inherits the clean value. Removed the now-
  duplicate local def in the projects block (it uses the hoisted helper). Only trailing `(…)` on real
  commit subjects is affected — all other public headlines have none, so producer/file/advisory rows are
  untouched. Contract preserved: no change to `private.roots` sanitisation, `attentionKey`, the two-truths
  health model, or render's escaping/fix-prompt UX (render untouched).
- **Result:** shipped `c55851e`. Verified: collect+render clean; the `Overview self-improve` row is now
  DOM-confirmed `improve: … reconciles with the counts chips` (no tag); zero public git headlines still
  end in `(…)`; project "Latest" lines unchanged. No template leaks
  (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`/`{HOME}`); no private text in index.html (the lone
  `captain` grep hit is the pre-existing benign `does` field in status.json only, never rendered).
- **Noted for a future run (not this one — one move per run):** `summary.needsAttention` in `collect.mjs`
  is dead — written to status.json but read by nothing (render uses its own `red+yellow`; publish.sh and
  history.ndjson read only `{green,yellow,red,paused}`). Safe to delete as a simplify pass.

### 2026-07-02 02:50 — hero "routines total" reconciles with its own counts chips (honesty/clarity)
- **Assessment:** Viewed live (desktop + mobile, light). The page is deeply polished; the only genuine
  remaining inconsistency was in the **hero counts row**. The four chips read
  `14 healthy · 2 ageing · 4 broken · 1 paused` (sum **21**) but the trailing label said
  **"22 routines total"** — a visible 1-off. Cause: `summary.total` was `routines.length`, the *only*
  field in the summary block that counts the one **retired** routine (`Holdet routine self-test`),
  which has no chip. It contradicted both the reader's own arithmetic and that block's own section
  comment (`// summary counts (enabled, non-retired routines)`) — green/yellow/red/paused all exclude
  retired; only `total` didn't. A charter value #1/#2 miss (numbers must reconcile), and exactly the
  hero-reconciliation principle a prior run established ("every number now agrees", 2026-07-01 18:45).
  The false overnight reds (4🔴 stale — config-cadence-vs-scheduler drift) are the known out-of-scope
  false positives the secretary flags; risky to touch here (false-green danger), so left untouched.
- **Move:** In `collect.mjs` only — `total: routines.length` → `total: nonRetired.length` (a new
  `const nonRetired = routines.filter(r => r.health !== 'retired')`), so the total equals the sum the
  chips break down. Verified sole consumer is render's "N routines total" (publish.sh and the
  secretary's history.ndjson read only `{green,yellow,red,paused}`), so this is low-blast-radius and
  fixes status.json + page together. Contract preserved: no change to `private.roots` sanitisation,
  `attentionKey`, or the two-truths health model; the retired routine still lists in the roster.
- **Result:** shipped `a985b58`. Verified: collect+render clean; chips (21) == total (21) agree
  (DOM-confirmed "21 routines total"); no template leaks
  (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`/`{HOME}`); no private text on the page
  (grep clean for `/Users/`, `fatal:`, `topByEv`, `feltet=ERR`, rider/captain/EV). Desktop + mobile intact.

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
