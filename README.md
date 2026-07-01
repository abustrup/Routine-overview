# Routine Overview

One calm dashboard for every scheduled routine across Alexander's projects — so he never has
to click into 15–20 routines to see how they did. Live: **https://abustrup.github.io/Routine-overview/**

A personal "secretary" that, every hour, reconstructs each routine's real health from the
**artifacts it produces** (git commits, run-logs, published files) — not just whether the
scheduler fired it — and pushes a notification **only** when something needs attention.

## What it watches
- 🚴 **Holdet TDF bot** — daily fantasy-cycling bot (+ its launchd jobs)
- 📈 **Personal stock dashboard** — self-improving decision instrument
- 📰 **Alexanders Brief** — daily Danish morning brief (+ rolling weekly/monthly/yearly)

Full mapping of every routine → project → where its output lands is in
[`config/projects.json`](config/projects.json).

## How it works
1. [`scripts/collect.mjs`](scripts/collect.mjs) — dependency-free; scans each routine's output
   source and writes [`data/status.json`](data/status.json). Health = *did it actually produce
   output on time?*, plus a log error/warn scan. No scheduler access needed.
2. [`scripts/render.mjs`](scripts/render.mjs) — turns `status.json` into a self-contained
   `index.html`.
3. The hourly **secretary routine** ([`routines/secretary-hourly.md`](routines/secretary-hourly.md))
   runs both, overlays scheduler truth (`list_scheduled_tasks`), applies judgement, commits &
   pushes, and notifies only on exceptions. Policy: [`SECRETARY.md`](SECRETARY.md).

## Run it by hand
```sh
npm run collect     # rebuild data/status.json from artifacts
npm run render      # rebuild index.html
npm run update      # collect + render + commit + push
```
No dependencies — plain Node ≥ 18 and git.

## Design notes
- **Silent by design.** The dashboard always refreshes; you get a push only when it matters.
- **Two truths.** "Fired" (scheduler) and "produced output" (artifact) are tracked separately;
  their disagreement is the most valuable signal (a routine firing but shipping nothing).
- **Public repo.** Health/status only — no secrets, positions, or strategy internals.
