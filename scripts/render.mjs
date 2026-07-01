#!/usr/bin/env node
// render.mjs — status.json -> index.html. Self-contained, no build step, no deps.
// Editorial and calm: one column, one type scale, health as a single coloured dot.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const s = JSON.parse(readFileSync(join(ROOT, 'data', 'status.json'), 'utf8'));

const esc = (x) => String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const DOT = { green: '#1a9d5a', yellow: '#c67c0a', red: '#cf3b2f', paused: '#9aa0a6', unknown: '#9aa0a6', retired: '#c3c7cc' };
const LABEL = { green: 'ok', yellow: 'ageing', red: 'needs attention', paused: 'paused', unknown: 'unknown', retired: 'retired' };
const dot = (h) => `<span class="dot" style="background:${DOT[h] || DOT.unknown}" title="${LABEL[h] || h}"></span>`;

// Liveness: if the page's own generatedAt is old, the secretary itself may be down —
// say so loudly rather than showing a frozen (and now misleading) green.
const ageMin = (Date.now() - Date.parse(s.generatedAt)) / 6e4;
const staleBanner = ageMin > 90
  ? `<div class="stale-banner">⚠ This overview last updated ${Math.round(ageMin / 60)}h ago — the hourly secretary may not be running. Health below may be out of date.</div>`
  : '';

const byId = Object.fromEntries(s.routines.map((r) => [r.id, r]));
const projName = Object.fromEntries(s.projects.map((p) => [p.id, `${p.emoji} ${p.name}`]));
projName.unassigned = '❓ Unassigned';

// ---- verdict line ----
const verdict = s.summary.red > 0
  ? `${s.summary.red} routine${s.summary.red > 1 ? 's need' : ' needs'} attention.`
  : s.summary.yellow > 0
    ? `${s.summary.yellow} routine${s.summary.yellow > 1 ? 's' : ''} ageing — nothing broken.`
    : 'All routines healthy. Nothing needs you right now.';

// ---- attention buckets ----
const urgent = s.attention.filter((a) => a.severity === 'red' || a.severity === 'warn');
const reviews = s.attention.filter((a) => a.severity === 'review');
const infos = s.attention.filter((a) => a.severity === 'info');

const attnRow = (a) => `<div class="attn ${a.severity}">
  <span class="attn-dot"></span>
  <div><div class="attn-msg">${esc(a.message)}</div>
  <div class="attn-meta">${esc(a.routine)}${a.project ? ' · ' + esc(projName[a.project] || a.project) : ''}</div></div>
</div>`;

// ---- project cards ----
const projCard = (p) => `<article class="proj">
  <header><span class="proj-name">${esc(p.emoji)} ${esc(p.name)}</span>${dot(p.health)}</header>
  <p class="goal">${esc(p.goal)}</p>
  <p class="status-line"><span class="k">Now</span> ${esc(p.lastPublishSubject || '—')} <span class="ago">· ${esc(p.lastPublishHuman)}</span></p>
  ${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
  <p class="links">${(p.links || []).map((l) => l.url.startsWith('http') ? `<a href="${esc(l.url)}">${esc(l.label)} ↗</a>` : `<span class="local">${esc(l.label)}</span>`).join(' · ')}</p>
</article>`;

// ---- routine table, grouped by project ----
const order = [...s.projects.map((p) => p.id), 'unassigned'];
const groups = order.map((pid) => ({ pid, rows: s.routines.filter((r) => r.project === pid) })).filter((g) => g.rows.length);

const routineRow = (r) => {
  const muted = r.enabled === false || r.health === 'retired';
  const issue = r.issues.find((i) => i.severity === 'error') || r.issues.find((i) => i.severity === 'warn');
  return `<tr class="${muted ? 'muted' : ''}">
    <td class="c-dot">${dot(r.health)}</td>
    <td class="c-name">${esc(r.name)}${r.kind === 'launchd' ? ' <span class="tag">launchd</span>' : ''}${r.enabled === false ? ' <span class="tag off">paused</span>' : ''}</td>
    <td class="c-cad">${esc(r.cadence)}</td>
    <td class="c-ago">${esc(r.lastOutputHuman)}</td>
    <td class="c-head">${esc(issue ? issue.line : r.headline)}</td>
  </tr>`;
};

const table = groups.map((g) => `
  <tr class="grp"><td colspan="5">${esc(projName[g.pid] || g.pid)}</td></tr>
  ${g.rows.map(routineRow).join('\n')}`).join('\n');

const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Routine Overview — ${esc(s.owner)}</title>
<style>
  :root{
    --bg:#faf9f7; --panel:#ffffff; --ink:#1c1b19; --soft:#6b6862; --line:#e7e3dc;
    --accent:#1c1b19; --urgent:#cf3b2f; --warn:#c67c0a; --review:#5b6b8c;
  }
  @media (prefers-color-scheme:dark){:root{
    --bg:#161513; --panel:#1e1d1a; --ink:#ece9e3; --soft:#a19d95; --line:#302e2a;
    --accent:#ece9e3; --review:#9fb0d0;
  }}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);
    font:16px/1.55 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
    -webkit-font-smoothing:antialiased}
  .wrap{max-width:820px;margin:0 auto;padding:44px 22px 80px}
  .stale-banner{background:#cf3b2f;color:#fff;padding:11px 16px;border-radius:9px;margin-bottom:24px;
    font:600 14px/1.4 ui-sans-serif,system-ui,sans-serif}
  .kicker{font:600 12px/1 ui-sans-serif,-apple-system,system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--soft)}
  h1{font-size:31px;margin:.28em 0 .1em;letter-spacing:-.01em}
  .sub{color:var(--soft);margin:0 0 26px}
  .verdict{font-size:20px;margin:0 0 6px}
  .counts{font:13px/1.6 ui-sans-serif,system-ui,sans-serif;color:var(--soft);margin:0 0 34px}
  .counts b{color:var(--ink);font-weight:600}
  .dot{display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:middle}
  section{margin:34px 0}
  .lbl{font:600 12px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.13em;text-transform:uppercase;color:var(--soft);
    padding-bottom:9px;border-bottom:1px solid var(--line);margin-bottom:16px}
  .attn{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--line)}
  .attn-dot{width:8px;height:8px;border-radius:50%;margin-top:8px;flex:0 0 auto;background:var(--soft)}
  .attn.red .attn-dot{background:var(--urgent)} .attn.warn .attn-dot{background:var(--warn)}
  .attn.review .attn-dot{background:var(--review)} .attn.info .attn-dot{background:var(--soft)}
  .attn-msg{font-size:15.5px} .attn.red .attn-msg{font-weight:600}
  .attn-meta{font:12px/1.4 ui-sans-serif,system-ui,sans-serif;color:var(--soft);margin-top:2px}
  .quiet{color:var(--soft);font-style:italic}
  .projs{display:grid;gap:16px;grid-template-columns:1fr}
  @media(min-width:680px){.projs{grid-template-columns:1fr 1fr}}
  .proj{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:17px 18px}
  .proj header{display:flex;justify-content:space-between;align-items:center;gap:10px}
  .proj-name{font-weight:600;font-size:17px}
  .goal{font-style:italic;color:var(--ink);margin:.5em 0 .7em;font-size:15px}
  .status-line{font:13px/1.5 ui-sans-serif,system-ui,sans-serif;margin:.2em 0;color:var(--ink)}
  .status-line .k{color:var(--soft);text-transform:uppercase;letter-spacing:.08em;font-size:11px;margin-right:6px}
  .status-line .ago{color:var(--soft)}
  .note{font:12.5px/1.5 ui-sans-serif,system-ui,sans-serif;color:var(--soft);margin:.5em 0 0}
  .links{font:13px/1.5 ui-sans-serif,system-ui,sans-serif;margin:.7em 0 0}
  .links a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--line)}
  .links a:hover{border-color:var(--soft)} .links .local{color:var(--soft)}
  table{width:100%;border-collapse:collapse;font:13.5px/1.4 ui-sans-serif,system-ui,sans-serif}
  td{padding:8px 8px;border-bottom:1px solid var(--line);vertical-align:top}
  tr.grp td{padding-top:20px;font-weight:600;letter-spacing:.02em;border-bottom:1px solid var(--ink);font-size:13px}
  .c-dot{width:16px} .c-cad{color:var(--soft);white-space:nowrap} .c-ago{color:var(--soft);white-space:nowrap}
  .c-head{color:var(--soft)} .muted{opacity:.5}
  .tag{font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--soft);border:1px solid var(--line);border-radius:4px;padding:1px 5px;margin-left:4px}
  .tag.off{color:var(--warn)}
  footer{margin-top:48px;padding-top:18px;border-top:1px solid var(--line);
    font:12.5px/1.6 ui-sans-serif,system-ui,sans-serif;color:var(--soft)}
  footer a{color:var(--soft)}
</style></head>
<body><div class="wrap">
  ${staleBanner}
  <div class="kicker">Personal routine secretary</div>
  <h1>Routine Overview</h1>
  <p class="sub">Every scheduled routine across ${esc(s.owner)}'s projects, in one glance.</p>

  <p class="verdict">${esc(verdict)}</p>
  <p class="counts">
    <b>${s.summary.green}</b> healthy &nbsp;·&nbsp; <b>${s.summary.yellow}</b> ageing &nbsp;·&nbsp;
    <b>${s.summary.red}</b> need attention &nbsp;·&nbsp; <b>${s.summary.paused}</b> paused
    &nbsp;·&nbsp; ${s.summary.total} routines total
  </p>

  <section>
    <div class="lbl">Needs your attention</div>
    ${urgent.length ? urgent.map(attnRow).join('\n') : '<p class="quiet">Nothing broken or overdue. Enjoy your day.</p>'}
    ${reviews.length ? `<div class="lbl" style="margin-top:26px">Worth a decision</div>${reviews.map(attnRow).join('\n')}` : ''}
    ${infos.length ? `<div class="lbl" style="margin-top:26px">Good to know</div>${infos.map(attnRow).join('\n')}` : ''}
  </section>

  <section>
    <div class="lbl">Projects</div>
    <div class="projs">${s.projects.map(projCard).join('\n')}</div>
  </section>

  <section>
    <div class="lbl">All routines</div>
    <table><tbody>${table}</tbody></table>
  </section>

  <footer>
    Generated ${esc(s.generatedAtLocal)} · health is reconstructed from each routine's real output
    (git commits, run-logs, published files) — not just whether it fired.
    <br>Silent by design: you get a push only when something needs you.
    <a href="https://github.com/abustrup/Routine-overview">source</a>.
  </footer>
</div></body></html>`;

writeFileSync(join(ROOT, 'index.html'), html);
console.log(`render: index.html (${(html.length / 1024).toFixed(1)} kB)`);
