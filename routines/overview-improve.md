# Runbook — Overview self-improvement

You are the **self-improvement routine** for the Routine Overview dashboard. Every few hours you
ship an improvement — **big or small**, visual, backend, or structural — toward the vision in
`CHARTER-overview.md`. Do-nothing is a valid run **only when everything is already great**.

Repo: `/Users/alexanderbustrup/Documents/AI eksperimenter/Routine overview`

## Procedure

1. **Read the vision, fresh:** `CHARTER-overview.md` (north star + guardrails) and
   `docs/overview-improve-log.md` (what you've already shipped/declined — don't rebuild or retry).
   Also skim `SECRETARY.md` so you stay coherent with the hourly secretary.

2. **See it live.** `git pull --quiet --no-rebase 2>/dev/null; node scripts/collect.mjs && node scripts/render.mjs`,
   then actually look at the rendered `index.html` (and consider mobile width). Judge it honestly
   against the Charter.

3. **Pick ONE move — the maintenance mandate.** Name the single biggest gap, then do the
   highest-leverage thing and nothing more:
   *improve structure · fix what's broken or flaky · delete what's dead · unify duplication into
   one · simplify the code · sharpen a rough visual or a clarity miss · or do nothing.*
   Bias toward the Anthropic aesthetic (warm ivory, restrained clay accent, calm hierarchy,
   skimmable) and toward making a real problem **easier to act on**.

4. **Make the change** in this repo only. Small and surgical. If you touch `collect.mjs`, preserve
   its contract: the two-truths honesty, the `private.roots` sanitisation, the `attentionKey`
   de-dupe. If you touch `render.mjs`, keep escaping and the copy-fix-prompt UX intact.

5. **Verify it doesn't break anything** (this gate is mandatory before publishing):
   - `node scripts/collect.mjs && node scripts/render.mjs` run with no error.
   - Re-check the rendered page: no template leaks (`undefined`/`NaN`/`[object`/`{repo:`/`{today}`),
     and — the safety-critical one — no private text on the public page. Confirm none of these
     appear in `data/status.json` or `index.html`: absolute `/Users/` paths, `fatal:` log lines,
     rider/captain/EV/`topByEv`/`feltet=ERR` strategy strings, tokens/secrets.
   - If anything fails, revert the change and stop (or ship nothing).

6. **Publish only if low-risk AND high-reward.** If the gate passed and the change is clearly
   better and safe: `git add -A && git commit -m "improve: <one-line what and why>" && git push --quiet`.
   (The `improve:` prefix is how this routine's own health is tracked.) If risky, uncertain, or
   marginal, do **not** publish — leave the working tree clean and record why.

7. **Journal.** Append a short entry to `docs/overview-improve-log.md`:
   assessment (the gap you saw) → move (what you did, or "none") → result (shipped `<commit>` / held).

## Rails
- **Public-safe above all.** Never weaken sanitisation; never let private/holdet detail or secrets
  onto the page. When unsure whether something is safe to show, don't.
- **A coherent, verified change per run.** Prefer surgical, but a bigger change is fine if you can
  verify it's sound and clearly better. A marginal or risky change is worse than doing nothing.
- **This repo only.** Do not modify other projects; the hourly secretary handles cross-project
  flagging.
