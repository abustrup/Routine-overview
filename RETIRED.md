# RETIRED — 2026-09-03

Alexander ended this project on **2026-09-03**. Nothing here runs any more. The repo is
kept as an archive, not as a live system.

The dashboard it published is stamped retired so it cannot be mistaken for current.
The scheduled task `routine-overview-secretary` is disabled and relabelled RETIRED.
Nothing was deleted.

---

## What it was

One page that reconstructed the health of ~23 scheduled routines from **artifact truth**
(git commits, run logs, published files) rather than from "did the scheduler fire", overlaid
**scheduler truth** on top, and interrupted him only when the two disagreed.

Live **2026-07-01 → 2026-09-03, 64 days**. 80 recorded runs, 147 commits, 28 runs that sent
a push — so it stayed silent on **65% of runs**, which was the design.

## What it actually caught

Honest accounting, from `data/history.ndjson`:

- **A silent crash loop nothing else in the fleet could see** (2026-08-30). `com.abustrup.sendefladen.serve`
  had restarted 2199 times, every one of them the same EADDRINUSE crash against an orphan
  process, with not a single successful start in 2197 log entries. KeepAlive made it look alive.
  This is the single clearest thing the project paid for.
- **The GitHub Actions cron blackout** (2026-08-26 → 08-30). Both briefs' cloud scheduler
  delivered zero runs for days. It was found here because this watcher ran on a different
  scheduler than the thing it was watching — which turned out to be the whole point, and
  became a recorded lesson: *an alarm must differ in mechanism, not location.*
- **Two stalled holdet watch sentinels** restarted automatically (2026-07-12, 2026-07-15).
- **Amphetamine relaunched** after its sleep assertion lapsed (2026-08-27), which is what
  keeps lid-closed nightly routines running at all.
- **A retired stock-maintenance task burning a run a day for three weeks** (2026-07-26).
- **Its own false greens, twice**, both caught by verifying the verifier — a crash-loop check
  that fired on an already-fixed job, and a fleet audit that passed everything by iterating
  the wrong array.

## What it never solved

- **The rollups (Ugen / Måneden / Året) died on 2026-07-27 and were never revived.** Flagged
  for ten consecutive runs. Flagging is not fixing, and this is the clearest evidence of that:
  a red that persists for 38 days is furniture, not an alarm.
- **The cloud trigger was never enrolled**, despite four flags, and was the fleet's real single
  point of failure to the last day.
- **It could not fix another project's code**, by design. So the things it found in other repos
  waited for Alexander regardless — which was the honest limit of a flag-only watcher.
- **It failed at its own job twice in its final four days** (2026-08-31 and 2026-09-02): produced
  a complete build, published nothing, raised no alarm. Fixed in its own prompt on 2026-09-03,
  hours before being retired.

## The lesson worth keeping

**A watcher that can only flag converges on furniture.** Its catch rate was real and its
reasoning was sound, but the items it could *act* on (restart a service, sync a flag) got fixed
within a day, and the items it could only *report* sat red for weeks. The value was concentrated
in the narrow allowlist, not in the reporting surface.

The general form, and the thing to carry into the next system: **the useful half of a monitor is
the half that is allowed to act.** Widen the grant or accept that the rest is a diary.

Second lesson, cheaper to state and just as expensive to learn: **artifact truth beats scheduler
truth**, and a health check that reads "did it fire" is a false green generator. That one is
already load-bearing across the fleet.

## What is now unwatched

Ending this leaves these genuinely unobserved. Nothing else looks at them:

1. **`com.abustrup.brief-cloud-trigger`** — the launchd job that fires both morning briefs.
   On 2026-09-03 it was the only path that published either edition; GitHub's own cron delivered
   nothing that day and was hours late the day before. If it fails silently, both briefs stop.
2. **`sendefladen-refresh`** — its failure detector watches for `exit=1` while the job fails with
   `exit=2`. It will report green through its own failures. Unfixed at retirement.
3. **The three rollup editions** — dead since 2026-07-27, no runner anywhere.

## Full record

- `data/history.ndjson` — all 80 runs, with the reasoning behind every push and every action.
- `SECRETARY.md` — the operating doctrine.
- `CHARTER-overview.md` — the design north star.
- `harness-priorities.md` (in `~/AI eksperimenter/`) — the generalised lessons, which outlive this repo.
