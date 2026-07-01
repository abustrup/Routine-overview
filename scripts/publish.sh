#!/usr/bin/env bash
# Commit + push the refreshed dashboard. Deterministic, no LLM — safe for launchd or manual use.
# The LLM secretary routine does its own richer commit; this is the plain backbone.
set -euo pipefail
cd "$(dirname "$0")/.."

read -r G Y R P < <(node -e '
  const s=require("./data/status.json").summary;
  console.log(`${s.green} ${s.yellow} ${s.red} ${s.paused}`);
')

git add -A
if git diff --cached --quiet; then
  echo "publish: nothing changed"
  exit 0
fi
STAMP=$(TZ=Europe/Copenhagen date "+%Y-%m-%d %H:%M")
git commit -q -m "overview: ${STAMP} — ${G}🟢 ${Y}🟡 ${R}🔴 ${P}⏸"
git push -q
echo "publish: pushed (${G}🟢 ${Y}🟡 ${R}🔴)"
