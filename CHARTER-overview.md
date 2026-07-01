# CHARTER — Routine Overview (self-improvement north star)

The durable vision the **overview self-improvement routine** reads fresh every run and
decides **for itself** what most advances it. This is **not a task list** — there is nothing
here to "complete". Edit it when the vision changes; don't use it to assign work.

## Purpose
One calm, beautiful surface that lets Alexander see — in a single glance — how all ~20 of his
scheduled routines are doing, and that makes anything needing him **effortless to act on**.
He should almost never have to open an individual routine.

## What "great" looks like
- **Skimmable in 3 seconds.** The verdict and what-needs-me are legible before he scrolls.
  If nothing needs him, the page says so plainly and he closes it.
- **Anthropic/Claude visual language.** Warm ivory paper, one refined type hierarchy, the clay
  accent (#CC785C) used with restraint, calm health dots, generous whitespace. Considered and
  editorial — never a busy admin template. It should look like it belongs in an Anthropic product.
- **One-click to fix.** When a routine is genuinely broken, the page hands him a copy-paste
  prompt (and a one-line guide) that drops straight into a fresh session and fixes it — pointed
  at the local log, never leaking private detail.
- **Honest.** Health is reconstructed from real artifacts (commits, run-logs, published files),
  not just "did it fire". Uncertainty is shown, not hidden; a grey dot beats a false green.

## Values — the order to optimise when they genuinely conflict
1. **Trust & honesty.** Never a false green; never leak a private (holdet-bot) log line or secret
   onto this public page. Provenance integrity before polish.
2. **Clarity & skimmability.** If a change doesn't make the page faster to read or easier to act
   on, it isn't an improvement.
3. **Restraint & calm.** Fewer, stronger surfaces; simplify or remove before adding. One accent
   colour. Whitespace is a feature.
4. **Craft & beauty.** Sparse, editorial, on-brand. Every element earns its place.

> Velocity of new features is **not** a value. A run that simplifies, deletes dead code, unifies
> duplication, or ships nothing can be the best run of the day.

## Guardrails — never cross
- **Public repo.** Only what's already in the sanitized `status.json` reaches the page. Never add
  secrets, positions, tokens, absolute home paths, or holdet strategy internals.
- **Don't break the collector contract.** `collect.mjs` owns health reconstruction and the
  `private.roots` sanitisation and the `attentionKey` de-dupe hash. Improve them, but never weaken
  the sanitisation or the "two-truths" honesty.
- **Verify before publish.** `node scripts/collect.mjs && node scripts/render.mjs` must run clean,
  and the page must have no template leaks, before anything is pushed.
- Keep it dependency-free (plain Node + git, no build step). Stay coherent with `SECRETARY.md`.

## How the routine uses this (not a backlog)
Each run: view the live page, judge it honestly against this Charter, name the single biggest gap
(structure, a flaky bit, dead code, duplication, a rough visual, a clarity miss), justify the
highest-leverage move — fix / simplify / delete / unify / polish / or do nothing — make it,
verify, and publish only if it's low-risk and clearly better. Record the assessment in
`docs/overview-improve-log.md`.
