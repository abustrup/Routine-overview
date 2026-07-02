#!/usr/bin/env node
// render-console.mjs — status.json -> console.html
// DIRECTION B — "Anthropic product console": sans-forward, crisp card-based layout,
// app-like and instantly skimmable. Coral used precisely for the fix action only.
// Self-contained, no build step, no deps, no external assets.

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const s = JSON.parse(readFileSync(join(ROOT, 'data', 'status.json'), 'utf8'));

// ---- escaping -------------------------------------------------------------
// esc(): for text nodes and double-quoted attributes. Newlines are legal inside a
// double-quoted HTML attribute, so an escaped multi-line prompt round-trips verbatim
// through getAttribute() — no JSON wrapper needed. We escape " as well so the value
// can never terminate its own attribute.
const esc = (x) =>
  String(x ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- health vocabulary ----------------------------------------------------
const HEALTH_LABEL = {
  green: 'Healthy',
  yellow: 'Ageing',
  red: 'Needs attention',
  paused: 'Paused',
  retired: 'Retired',
  unknown: 'Idle',
};
const dot = (h) => `<span class="dot dot--${esc(h || 'unknown')}" title="${esc(HEALTH_LABEL[h] || h || 'unknown')}" aria-hidden="true"></span>`;

// ---- liveness -------------------------------------------------------------
const ageMin = (Date.now() - Date.parse(s.generatedAt)) / 6e4;
// Threshold is derived by collect from the secretary's configured refresh period (so it tracks the
// real cadence instead of a hard-coded minute count that drifts when the schedule changes); fall
// back to 6h if an older status.json predates the field.
const staleAfterMin = s.staleAfterMin || 360;
const isStale = ageMin > staleAfterMin;
const staleBanner = isStale
  ? `<div class="stale" role="alert">
      <span class="stale__dot" aria-hidden="true"></span>
      <div>
        <strong>This overview may be out of date.</strong>
        Last refreshed ${esc(ageMin >= 120 ? Math.round(ageMin / 60) + 'h' : Math.round(ageMin) + ' min')} ago — the secretary may not be running, so the health below could be frozen.
      </div>
    </div>`
  : '';

// ---- lookups --------------------------------------------------------------
const projName = Object.fromEntries(s.projects.map((p) => [p.id, `${p.emoji} ${p.name}`]));
projName.unassigned = '❓ Unassigned';
const projEmoji = Object.fromEntries(s.projects.map((p) => [p.id, p.emoji]));
projEmoji.unassigned = '❓'; // mirror projName.unassigned so attention/review cards get a glyph too

// ---- verdict --------------------------------------------------------------
// The "Needs your attention" section below bundles red + warn, so the headline
// count must too — otherwise the verdict undercounts the cards it sits above.
const { green, yellow, red, paused, total } = s.summary;
const needing = red + yellow;
const verdict =
  red > 0
    ? `${needing} routine${needing > 1 ? 's need' : ' needs'} your attention`
    : yellow > 0
      ? `${yellow} routine${yellow > 1 ? 's' : ''} ageing — nothing broken`
      : 'All routines healthy';
const verdictSub =
  red > 0
    ? yellow > 0
      ? `${red} broken, ${yellow} ageing — everything else is running clean.`
      : 'Everything else is running clean.'
    : yellow > 0
      ? 'No errors detected across the fleet.'
      : 'Nothing needs you right now.';
const verdictTone = red > 0 ? 'alert' : yellow > 0 ? 'warn' : 'calm';

// ---- attention buckets ----------------------------------------------------
const urgent = s.attention.filter((a) => a.severity === 'red' || a.severity === 'warn');
const reviews = s.attention.filter((a) => a.severity === 'review');

let uid = 0;

// A "fix" affordance: copy button + expandable prompt block. Only when a.fix exists.
const fixBlock = (a, variant) => {
  if (!a.fix) return '';
  const id = `fix-${++uid}`;
  const cwd = a.fix.cwd ? `<div class="fix__cwd"><span class="fix__cwd-k">cwd</span> <code>${esc(a.fix.cwd)}</code></div>` : '';
  return `<div class="fix">
    <div class="fix__actions">
      <button type="button" class="btn btn--copy${variant === 'review' ? ' btn--ghost' : ''}"
              data-copy="${esc(a.fix.prompt)}">
        <span class="btn__label">Copy fix prompt</span>
        <span class="btn__done" aria-hidden="true">Copied&nbsp;✓</span>
      </button>
      <button type="button" class="btn btn--link" data-toggle="${id}" aria-expanded="false" aria-controls="${id}">
        View prompt
      </button>
    </div>
    <div class="fix__body" id="${id}" hidden>
      <pre class="fix__prompt">${esc(a.fix.prompt)}</pre>
      ${cwd}
    </div>
  </div>`;
};

// The card header already names the routine, so the body shows `message` (not the
// fix `guide`, which restates the name): message never repeats the header and, for
// stale/ageing, carries the concrete age ("last output 6h ago") the guide drops —
// more honest and more skimmable. For a private source it reads "…details are
// local-only", keeping the two-truths honesty visible on the card itself.
// A stable per-item identity — `severity:routine:kind`, the same shape collect uses for
// its notification de-dup key. Deliberately excludes the message text (which carries the
// ever-changing "last output 16h ago"), so a persistent flag stays dismissed hour to hour,
// while a genuinely different problem (severity/kind change) gets a new key and resurfaces.
const attnKey = (a) => `${a.severity}:${a.routine}:${a.kind}`;

// The dismiss affordance: a small "×" the user clicks when they've judged an item fixed or
// not worth their attention. It only hides client-side (localStorage) — the next collect
// still reconstructs real health — so this never edits the artifact truth underneath.
const dismissBtn = `<button type="button" class="dismiss-x" data-dismiss aria-label="Hide this alert" title="Hide — it comes back if the issue is still there next refresh">×</button>`;

const attnCard = (a) => `<article class="attn attn--${esc(a.severity)}" data-attn data-akey="${esc(attnKey(a))}">
  <div class="attn__bar" aria-hidden="true"></div>
  <div class="attn__main">
    <div class="attn__head">
      <span class="attn__sev">${a.severity === 'red' ? 'Broken' : 'Warning'}</span>
      <span class="attn__where">${esc(projEmoji[a.project] || '')} ${esc(a.routine)}</span>
      ${dismissBtn}
    </div>
    <p class="attn__msg">${esc(a.message)}</p>
    ${fixBlock(a, 'attn')}
  </div>
</article>`;

const reviewCard = (a) => `<article class="review" data-attn data-akey="${esc(attnKey(a))}">
  <div class="review__head">
    <span class="review__where">${esc(projEmoji[a.project] || '')} ${esc(a.routine)}</span>
    ${dismissBtn}
  </div>
  <p class="review__msg">${esc(a.message)}</p>
  ${fixBlock(a, 'review')}
</article>`;

// A "Show N hidden" pill for the section head, and the honest empty state shown when every
// card in a section has been hidden — distinct from the server-rendered "nothing broke"
// empty, and explicit that hiding is per-device and reversible. Both start hidden and are
// revealed by the dismissal controller below.
const restorePill = `<button type="button" class="sec-restore" data-restore hidden><span data-restore-count>0</span> hidden · Show</button>`;
const clearedEmpty = (noun) => `<div class="empty empty--cleared" data-cleared hidden>
  <span class="empty__dot" aria-hidden="true"></span>
  <div><strong>You've hidden ${esc(noun)}.</strong> <span>They'll come back after the next refresh if the issue is still there. <button type="button" class="linkbtn" data-restore>Show hidden</button></span></div>
</div>`;

// ---- project cards --------------------------------------------------------
const projCard = (p) => {
  const links = (p.links || [])
    .map((l) =>
      /^https?:/.test(l.url)
        ? `<a class="chip" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}<span class="chip__ext" aria-hidden="true">↗</span></a>`
        : `<span class="chip chip--local">${esc(l.label)}</span>`
    )
    .join('');
  return `<article class="proj">
    <header class="proj__head">
      <span class="proj__emoji" aria-hidden="true">${esc(p.emoji)}</span>
      <h3 class="proj__name">${esc(p.name)}</h3>
      ${dot(p.health)}
    </header>
    <p class="proj__goal">${esc(p.goal)}</p>
    <div class="proj__now">
      <span class="proj__now-k">Latest</span>
      <span class="proj__now-v">${esc(p.lastPublishSubject || '—')}</span>
      <span class="proj__now-ago">${esc(p.lastPublishHuman || '')}</span>
    </div>
    ${p.note ? `<p class="proj__note">${esc(p.note)}</p>` : ''}
    <div class="proj__links">${links}</div>
  </article>`;
};

// ---- routine roster -------------------------------------------------------
const order = [...s.projects.map((p) => p.id), 'unassigned'];
const groups = order
  .map((pid) => ({ pid, rows: s.routines.filter((r) => r.project === pid) }))
  .filter((g) => g.rows.length);

const routineRow = (r) => {
  const muted = r.enabled === false || r.health === 'retired';
  const issues = r.issues || [];
  const issue =
    issues.find((i) => i.severity === 'error') || issues.find((i) => i.severity === 'warn');
  // A note-level issue (e.g. a degraded data source) doesn't change the health dot, but
  // hiding it would show a known degradation as a spotless green row. Surface it in the
  // headline slot, dimmer than a warn — honest, not alarming.
  const note = issue ? null : issues.find((i) => i.severity === 'note');
  const tags = [];
  if (r.enabled === false) tags.push('<span class="tag tag--off">paused</span>');
  if (r.kind === 'launchd') tags.push('<span class="tag">launchd</span>');
  if (r.kind === 'oneshot') tags.push('<span class="tag">one-time</span>');
  const line = issue ? issue.line : note ? note.line : r.headline;
  const headMod = issue ? ' row__head--issue' : note ? ' row__head--note' : '';
  return `<li class="row${muted ? ' row--muted' : ''}">
    <span class="row__dot">${dot(r.health)}</span>
    <span class="row__name">${esc(r.name)}${tags.length ? ' ' + tags.join(' ') : ''}</span>
    <span class="row__cadence">${esc(r.cadence)}</span>
    <span class="row__ago">${esc(r.lastOutputHuman || '—')}</span>
    <span class="row__head${headMod}">${esc(line || '')}</span>
  </li>`;
};

const roster = groups
  .map(
    (g) => `<div class="rgroup">
      <div class="rgroup__head">${esc(projName[g.pid] || g.pid)}<span class="rgroup__count">${g.rows.length}</span></div>
      <ul class="rlist">${g.rows.map(routineRow).join('')}</ul>
    </div>`
  )
  .join('');

// ---- document -------------------------------------------------------------
const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="color-scheme" content="light dark">
<title>Routine Overview — ${esc(s.owner)}</title>
<style>
  :root{
    --bg:#FAF9F5; --surface:#FFFFFF; --surface-2:#FCFBF8;
    --ink:#1A1915; --muted:#6A675F; --line:#EAE6DD;
    --accent:#CC785C; --accent-strong:#B5624A; --accent-ink:#FFFFFF;
    --ok:#6A8A5B; --amber:#C88A3C; --red:#BE5137; --grey:#B4B0A8;
    --red-wash:#FBF1EE; --amber-wash:#FBF5EC;
    --radius:12px; --radius-sm:9px;
    --shadow:0 1px 2px rgba(26,25,21,.04);
  }
  @media (prefers-color-scheme:dark){:root{
    --bg:#262624; --surface:#201F1D; --surface-2:#1C1B19;
    --ink:#ECEAE3; --muted:#A5A199; --line:#393732;
    --accent:#D9866A; --accent-strong:#D9866A; --accent-ink:#1A1915;
    --ok:#7FA06E; --amber:#D6A055; --red:#D06B50; --grey:#8B8781;
    --red-wash:#2E2320; --amber-wash:#2C271F;
    --shadow:0 1px 2px rgba(0,0,0,.2);
  }}
  *{box-sizing:border-box}
  html{-webkit-text-size-adjust:100%}
  body{
    margin:0;background:var(--bg);color:var(--ink);
    font-family:ui-sans-serif,-apple-system,"Segoe UI",system-ui,sans-serif;
    font-size:15px;line-height:1.55;
    -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;
  }
  .wrap{max-width:960px;margin:0 auto;padding:40px 24px 96px}
  @media(max-width:520px){.wrap{padding:26px 16px 72px}}
  a{color:inherit}
  :focus-visible{outline:2px solid var(--accent-strong);outline-offset:2px;border-radius:6px}
  /* Components below set their own display (flex/inline), which would beat the UA [hidden]
     rule — so hide explicitly. is-hidden persists a dismissal; is-collapsing animates it out. */
  [hidden]{display:none!important}
  .is-hidden{display:none!important}

  /* ---- stale banner ---- */
  .stale{display:flex;gap:12px;align-items:flex-start;
    background:var(--red-wash);border:1px solid var(--red);border-radius:var(--radius);
    padding:13px 16px;margin-bottom:28px;color:var(--ink);line-height:1.45}
  .stale strong{display:block;font-weight:650}
  .stale__dot{width:9px;height:9px;border-radius:50%;background:var(--red);margin-top:6px;flex:0 0 auto}

  /* ---- header ---- */
  .topline{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap}
  .eyebrow{font-size:12px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);margin:0}
  h1{font-family:ui-serif,"Iowan Old Style",Palatino,Georgia,serif;
     font-weight:600;font-size:32px;line-height:1.1;letter-spacing:-.01em;margin:6px 0 0}
  .subtitle{color:var(--muted);margin:8px 0 0;max-width:52ch}
  .stamp{font-size:12.5px;color:var(--muted);white-space:nowrap}
  .stamp b{color:var(--ink);font-weight:600}

  /* ---- hero verdict ---- */
  .hero{margin:30px 0 8px;padding:24px 26px;background:var(--surface);
    border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow)}
  .hero__row{display:flex;align-items:center;gap:14px}
  .hero__mark{width:12px;height:12px;border-radius:50%;flex:0 0 auto}
  .hero--calm .hero__mark{background:var(--ok)}
  .hero--warn .hero__mark{background:var(--amber)}
  .hero--alert .hero__mark{background:var(--red)}
  .hero__verdict{font-family:ui-serif,"Iowan Old Style",Palatino,Georgia,serif;
    font-size:24px;font-weight:600;letter-spacing:-.01em;margin:0;line-height:1.2}
  .hero__sub{color:var(--muted);margin:6px 0 0 26px;font-size:14.5px}

  .counts{display:flex;flex-wrap:wrap;gap:10px;margin:20px 0 0}
  .stat{display:flex;align-items:center;gap:8px;padding:7px 13px 7px 11px;
    background:var(--surface-2);border:1px solid var(--line);border-radius:999px;font-size:13.5px}
  .stat b{font-variant-numeric:tabular-nums;font-weight:650}
  .stat span{color:var(--muted)}
  .stat--total{margin-left:auto;background:transparent;border-color:transparent;color:var(--muted)}
  @media(max-width:520px){.stat--total{margin-left:0}}

  /* ---- section scaffolding ---- */
  section{margin:40px 0 0}
  .sec-head{display:flex;align-items:baseline;gap:10px;margin:0 0 16px}
  .sec-head h2{font-size:13px;font-weight:650;letter-spacing:.12em;text-transform:uppercase;
    color:var(--muted);margin:0}
  .sec-head .rule{flex:1;height:1px;background:var(--line)}

  /* ---- needs attention ---- */
  .attn{display:flex;background:var(--surface);border:1px solid var(--line);
    border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow);margin-bottom:14px}
  .attn__bar{width:4px;flex:0 0 auto}
  .attn--red .attn__bar{background:var(--red)}
  .attn--warn .attn__bar{background:var(--amber)}
  .attn--red{background:linear-gradient(var(--red-wash),var(--red-wash)) padding-box}
  .attn__main{padding:16px 20px;flex:1;min-width:0}
  .attn__head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
  .attn__sev{font-size:11px;font-weight:650;letter-spacing:.06em;text-transform:uppercase;
    padding:2px 8px;border-radius:6px;color:#fff}
  .attn--red .attn__sev{background:var(--red)}
  .attn--warn .attn__sev{background:var(--amber);color:#3A2C14}
  .attn__where{font-weight:600;font-size:14.5px}
  .attn__msg{margin:10px 0 0;line-height:1.5}

  /* ---- fix affordance ---- */
  .fix{margin-top:14px}
  .fix__actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .btn{font:inherit;font-size:13.5px;cursor:pointer;border-radius:8px;
    border:1px solid transparent;padding:8px 15px;transition:background .12s,border-color .12s,color .12s}
  .btn--copy{background:var(--accent-strong);color:var(--accent-ink);border-color:var(--accent-strong);
    font-weight:600;position:relative}
  .btn--copy:hover{filter:brightness(1.05)}
  .btn--copy .btn__done{display:none;position:absolute;inset:0;align-items:center;justify-content:center}
  .btn--copy.is-copied{background:var(--ok);border-color:var(--ok);color:#fff}
  .btn--copy.is-copied .btn__label{visibility:hidden}
  .btn--copy.is-copied .btn__done{display:flex}
  .btn--ghost{background:transparent;color:var(--accent-strong);border-color:var(--accent-strong)}
  .btn--ghost:hover{background:var(--surface-2)}
  .btn--ghost.is-copied{background:var(--ok);border-color:var(--ok);color:#fff}
  .btn--link{background:transparent;color:var(--muted);border-color:transparent;padding:8px 6px;font-weight:500}
  .btn--link:hover{color:var(--ink)}
  .btn--link[aria-expanded="true"]::after{content:" ▲"}
  .btn--link[aria-expanded="false"]::after{content:" ▾"}
  .fix__body{margin-top:12px}
  .fix__prompt{margin:0;padding:14px 16px;background:var(--surface-2);border:1px solid var(--line);
    border-radius:var(--radius-sm);font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;
    font-size:12.5px;line-height:1.6;color:var(--ink);white-space:pre-wrap;word-break:break-word;
    max-height:340px;overflow:auto}
  .fix__cwd{margin-top:8px;font-size:12.5px;color:var(--muted)}
  .fix__cwd-k{text-transform:uppercase;letter-spacing:.08em;font-size:10.5px;margin-right:4px}
  .fix__cwd code{font-family:ui-monospace,"SF Mono",Menlo,Consolas,monospace;font-size:12px;color:var(--ink)}

  /* ---- empty state ---- */
  .empty{display:flex;align-items:center;gap:14px;background:var(--surface);
    border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--shadow)}
  .empty__dot{width:11px;height:11px;border-radius:50%;background:var(--ok);flex:0 0 auto}
  .empty strong{font-weight:600}
  .empty span{color:var(--muted)}

  /* ---- reviews ---- */
  .review{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
    padding:15px 18px;margin-bottom:12px;box-shadow:var(--shadow)}
  .review__where{font-weight:600;font-size:14px}
  .review__msg{margin:8px 0 0;color:var(--ink);line-height:1.5;font-size:14px}

  /* ---- projects ---- */
  .projs{display:grid;grid-template-columns:1fr;gap:16px}
  @media(min-width:680px){.projs{grid-template-columns:1fr 1fr}}
  .proj{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
    padding:18px 20px;box-shadow:var(--shadow);display:flex;flex-direction:column}
  .proj__head{display:flex;align-items:center;gap:10px}
  .proj__emoji{font-size:20px;line-height:1}
  .proj__name{font-size:16px;font-weight:650;margin:0;flex:1;letter-spacing:-.005em}
  .proj__goal{color:var(--ink);margin:12px 0 0;font-size:14px;line-height:1.5}
  .proj__now{margin:14px 0 0;padding-top:13px;border-top:1px solid var(--line);
    display:flex;flex-direction:column;gap:2px}
  .proj__now-k{font-size:10.5px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}
  .proj__now-v{font-size:13px;line-height:1.45}
  .proj__now-ago{font-size:12px;color:var(--muted)}
  .proj__note{margin:12px 0 0;padding:9px 12px;background:var(--surface-2);border:1px solid var(--line);
    border-radius:var(--radius-sm);font-size:12.5px;color:var(--muted);line-height:1.5}
  .proj__links{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px;padding-top:2px}
  .chip{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;text-decoration:none;
    padding:5px 11px;border:1px solid var(--line);border-radius:999px;color:var(--ink);
    background:var(--surface-2);transition:border-color .12s,color .12s}
  .chip:hover{border-color:var(--accent);color:var(--accent)}
  .chip__ext{font-size:11px;opacity:.7}
  .chip--local{color:var(--muted)}
  .chip--local:hover{border-color:var(--line);color:var(--muted)}

  /* ---- routine roster ---- */
  .rgroup{margin-bottom:22px}
  .rgroup__head{display:flex;align-items:center;gap:10px;font-size:14px;font-weight:650;
    padding:0 4px 9px;border-bottom:1px solid var(--line);margin-bottom:2px}
  .rgroup__count{font-size:11.5px;font-weight:600;color:var(--muted);background:var(--surface-2);
    border:1px solid var(--line);border-radius:999px;padding:1px 8px;font-variant-numeric:tabular-nums}
  .rlist{list-style:none;margin:0;padding:0}
  .row{display:grid;grid-template-columns:16px minmax(150px,1.3fr) auto auto minmax(0,2fr);
    align-items:baseline;gap:14px;padding:9px 4px;border-bottom:1px solid var(--line)}
  .row:last-child{border-bottom:0}
  .row__dot{align-self:center}
  .row__name{font-weight:550;font-size:13.5px;min-width:0}
  .row__cadence{font-size:12.5px;color:var(--muted);white-space:nowrap;font-variant-numeric:tabular-nums}
  .row__ago{font-size:12.5px;color:var(--muted);white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums}
  .row__head{font-size:12.5px;color:var(--muted);line-height:1.45;min-width:0;
    overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .row__head--issue{color:var(--red);font-weight:500}
  .row__head--note{color:var(--amber)}
  .row--muted{opacity:.52}
  .tag{font-size:10px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);
    border:1px solid var(--line);border-radius:5px;padding:1px 5px;vertical-align:middle}
  .tag--off{color:var(--amber);border-color:var(--amber)}
  @media(max-width:640px){
    .row{grid-template-columns:16px 1fr auto;grid-template-areas:"dot name ago" "space head head";
      row-gap:3px}
    .row__dot{grid-area:dot}.row__name{grid-area:name}.row__ago{grid-area:ago}
    .row__cadence{display:none}
    .row__head{grid-area:head;white-space:normal;padding-left:0}
    .row__head::before{content:none}
  }

  /* ---- health dots ---- */
  .dot{display:inline-block;width:9px;height:9px;border-radius:50%;vertical-align:middle;flex:0 0 auto}
  .dot--green{background:var(--ok)} .dot--yellow{background:var(--amber)}
  .dot--red{background:var(--red)} .dot--paused{background:var(--grey)}
  .dot--retired{background:var(--grey);opacity:.6} .dot--unknown{background:var(--grey)}

  /* ---- dismiss / restore ---- */
  .review__head{display:flex;align-items:center;gap:10px}
  .dismiss-x{margin-left:auto;flex:0 0 auto;width:26px;height:26px;display:inline-flex;
    align-items:center;justify-content:center;border:1px solid transparent;border-radius:7px;
    background:transparent;color:var(--muted);font-size:19px;line-height:1;cursor:pointer;
    transition:background .12s,color .12s,border-color .12s}
  .dismiss-x:hover{background:var(--surface-2);color:var(--ink);border-color:var(--line)}
  .attn--red .dismiss-x:hover{color:var(--red);border-color:var(--red)}
  .attn.is-collapsing,.review.is-collapsing{opacity:0;transform:translateX(10px);
    transition:opacity .18s ease,transform .18s ease}
  @media(prefers-reduced-motion:reduce){.attn.is-collapsing,.review.is-collapsing{transition:none}}
  .sec-restore{align-self:center;font:inherit;font-size:12px;font-weight:600;letter-spacing:.02em;
    cursor:pointer;color:var(--muted);background:transparent;border:1px solid var(--line);
    border-radius:999px;padding:3px 12px;transition:color .12s,border-color .12s}
  .sec-restore:hover{color:var(--accent);border-color:var(--accent)}
  .sec-restore [data-restore-count]{font-variant-numeric:tabular-nums;font-weight:700;color:var(--ink)}
  .empty--cleared .empty__dot{background:var(--grey)}
  .linkbtn{font:inherit;font-size:inherit;color:var(--accent-strong);background:transparent;
    border:0;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
  .linkbtn:hover{color:var(--accent)}

  /* ---- undo toast ---- */
  .toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:50;
    display:flex;align-items:center;gap:16px;background:var(--ink);color:var(--bg);
    padding:11px 18px;border-radius:10px;box-shadow:0 6px 22px rgba(0,0,0,.22);font-size:13.5px;
    max-width:calc(100vw - 32px)}
  .toast__undo{font:inherit;font-size:13px;font-weight:700;color:var(--accent);background:transparent;
    border:0;cursor:pointer;padding:0}
  .toast__undo:hover{text-decoration:underline}

  /* ---- footer ---- */
  footer{margin-top:52px;padding-top:20px;border-top:1px solid var(--line);
    font-size:12.5px;color:var(--muted);line-height:1.6}
  footer a{color:var(--muted);text-decoration:underline;text-decoration-color:var(--line);
    text-underline-offset:2px}
  footer a:hover{color:var(--accent);text-decoration-color:var(--accent)}
  footer .foot-sep{margin:0 8px;opacity:.5}
</style></head>
<body><div class="wrap">
  ${staleBanner}

  <header>
    <div class="topline">
      <div>
        <p class="eyebrow">Personal routine secretary</p>
        <h1>Routine Overview</h1>
      </div>
      <div class="stamp">Updated <b>${esc(s.generatedAtLocal)}</b></div>
    </div>
    <p class="subtitle">The health of every scheduled routine across ${esc(s.owner)}'s projects — so you never have to open them one by one.</p>
  </header>

  <div class="hero hero--${verdictTone}">
    <div class="hero__row">
      <span class="hero__mark" aria-hidden="true"></span>
      <p class="hero__verdict">${esc(verdict)}</p>
    </div>
    <p class="hero__sub">${esc(verdictSub)}</p>
    <div class="counts">
      <span class="stat"><span class="dot dot--green" aria-hidden="true"></span><b>${green}</b><span>healthy</span></span>
      <span class="stat"><span class="dot dot--yellow" aria-hidden="true"></span><b>${yellow}</b><span>ageing</span></span>
      <span class="stat"><span class="dot dot--red" aria-hidden="true"></span><b>${red}</b><span>broken</span></span>
      <span class="stat"><span class="dot dot--paused" aria-hidden="true"></span><b>${paused}</b><span>paused</span></span>
      <span class="stat stat--total">${total} routines total</span>
    </div>
  </div>

  <section aria-labelledby="sec-attn" data-attn-section>
    <div class="sec-head"><h2 id="sec-attn">Needs your attention</h2><span class="rule"></span>${restorePill}</div>
    <div class="attn-list" data-attn-list>
    ${
      urgent.length
        ? urgent.map(attnCard).join('')
        : `<div class="empty"><span class="empty__dot" aria-hidden="true"></span>
             <div><strong>Nothing broken or overdue.</strong> <span>Every routine is producing real output — enjoy your day.</span></div>
           </div>`
    }
    </div>
    ${clearedEmpty('these alerts')}
  </section>

  ${
    reviews.length
      ? `<section aria-labelledby="sec-review" data-attn-section>
          <div class="sec-head"><h2 id="sec-review">Worth a decision</h2><span class="rule"></span>${restorePill}</div>
          <div class="attn-list" data-attn-list>${reviews.map(reviewCard).join('')}</div>
          ${clearedEmpty('these items')}
        </section>`
      : ''
  }

  <section aria-labelledby="sec-proj">
    <div class="sec-head"><h2 id="sec-proj">Projects</h2><span class="rule"></span></div>
    <div class="projs">${s.projects.map(projCard).join('')}</div>
  </section>

  <section aria-labelledby="sec-roster">
    <div class="sec-head"><h2 id="sec-roster">All routines</h2><span class="rule"></span></div>
    ${roster}
  </section>

  <footer>
    Health is reconstructed from each routine's real artifacts — git commits, run-logs and published files — not just whether the scheduler fired. Silent by design: you get a push only when something needs you.
    <br>
    Generated ${esc(s.generatedAtLocal)}
    <span class="foot-sep">·</span>
    <a href="https://github.com/abustrup/Routine-overview" target="_blank" rel="noopener">github.com/abustrup/Routine-overview</a>
  </footer>
</div>

<div class="toast" data-toast hidden role="status" aria-live="polite">
  <span data-toast-msg>Alert hidden</span>
  <button type="button" class="toast__undo" data-toast-undo>Undo</button>
</div>

<script>
(function(){
  // Copy fix prompt -> clipboard, with a graceful fallback for non-secure contexts.
  function legacyCopy(text){
    return new Promise(function(resolve, reject){
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly','');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        if (ok) { resolve(); } else { reject(new Error('execCommand copy failed')); }
      } catch (e) { reject(e); }
    });
  }
  function copyText(text){
    // Prefer the async Clipboard API; fall back to execCommand if it rejects
    // (e.g. the tab isn't focused) or isn't available (non-secure context).
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function(){ return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  document.querySelectorAll('[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var text = btn.getAttribute('data-copy');
      copyText(text).then(function(){
        btn.classList.add('is-copied');
        btn.setAttribute('aria-live','polite');
        clearTimeout(btn._t);
        btn._t = setTimeout(function(){ btn.classList.remove('is-copied'); }, 1600);
      }).catch(function(){
        var lbl = btn.querySelector('.btn__label');
        if (lbl) lbl.textContent = 'Copy failed — select manually';
      });
    });
  });

  // Expand/collapse the full prompt.
  document.querySelectorAll('[data-toggle]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var body = document.getElementById(btn.getAttribute('data-toggle'));
      if (!body) return;
      var open = body.hasAttribute('hidden');
      if (open) { body.removeAttribute('hidden'); btn.setAttribute('aria-expanded','true'); btn.textContent = 'Hide prompt'; }
      else { body.setAttribute('hidden',''); btn.setAttribute('aria-expanded','false'); btn.textContent = 'View prompt'; }
    });
  });
})();

// ---- dismissible attention flags -----------------------------------------
// Hiding an alert is a per-device, reversible convenience — never a change to the truth
// underneath. The page is rebuilt hourly from real artifacts, so this layer only decides
// what to *show*. Persistence + self-cleaning live in localStorage, keyed by data-akey.
(function(){
  var KEY = 'routine-overview:dismissed:v1';
  var MAXAGE = 30 * 24 * 3600 * 1000; // backstop: forget a dismissal after 30 days
  function load(){
    try { var o = JSON.parse(localStorage.getItem(KEY) || '{}'); return (o && typeof o === 'object') ? o : {}; }
    catch (e) { return {}; }
  }
  function save(m){ try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (e) {} }

  var sections = [].slice.call(document.querySelectorAll('[data-attn-section]'));
  if (!sections.length) return;
  var dismissed = load();

  function keyOf(card){ return card.getAttribute('data-akey'); }
  function cardsOf(sec){ return [].slice.call(sec.querySelectorAll('[data-attn]')); }

  // Self-clean: forget any dismissal whose alert is no longer on the page (the issue
  // resolved upstream, so collect stopped emitting it) or that has aged past the backstop.
  // This is what makes a genuine *recurrence* resurface instead of being silently re-hidden.
  var present = {};
  sections.forEach(function(sec){ cardsOf(sec).forEach(function(c){ present[keyOf(c)] = true; }); });
  var changed = false, t = Date.now();
  Object.keys(dismissed).forEach(function(k){
    var ts = Date.parse(dismissed[k]);
    if (!present[k] || (isFinite(ts) && (t - ts) > MAXAGE)) { delete dismissed[k]; changed = true; }
  });
  if (changed) save(dismissed);

  function setHidden(card, on){ card.classList.toggle('is-hidden', !!on); }

  function updateSection(sec){
    var cards = cardsOf(sec);
    var hiddenN = cards.filter(function(c){ return dismissed[keyOf(c)]; }).length;
    var allHidden = cards.length > 0 && hiddenN === cards.length;
    var cleared = sec.querySelector('[data-cleared]');
    var restore = sec.querySelector('.sec-head [data-restore]');
    if (cleared) cleared.hidden = !allHidden;
    if (restore) {
      restore.hidden = !(hiddenN > 0 && !allHidden); // cleared state carries its own Show link
      var cnt = restore.querySelector('[data-restore-count]');
      if (cnt) cnt.textContent = String(hiddenN);
    }
  }

  // Apply persisted dismissals on first paint.
  sections.forEach(function(sec){
    cardsOf(sec).forEach(function(c){ if (dismissed[keyOf(c)]) setHidden(c, true); });
    updateSection(sec);
  });

  // ---- undo toast (single, shared) ----
  var toast = document.querySelector('[data-toast]');
  var toastMsg = toast && toast.querySelector('[data-toast-msg]');
  var toastUndo = toast && toast.querySelector('[data-toast-undo]');
  var toastTimer = null, pendingUndo = null;
  function showToast(msg, onUndo){
    if (!toast) return;
    if (toastMsg) toastMsg.textContent = msg;
    pendingUndo = onUndo;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, 6000);
  }
  function hideToast(){ if (toast) toast.hidden = true; pendingUndo = null; }
  if (toastUndo) toastUndo.addEventListener('click', function(){ var f = pendingUndo; hideToast(); if (f) f(); });

  function dismissCard(card, sec){
    var k = keyOf(card); if (!k) return;
    dismissed[k] = new Date().toISOString(); save(dismissed);
    card.classList.add('is-collapsing');
    card._undone = false;
    function finalize(){
      if (card._undone) return;
      card.removeEventListener('transitionend', finalize);
      clearTimeout(card._collapseTimer);
      card.classList.remove('is-collapsing');
      setHidden(card, true);
      updateSection(sec);
    }
    card.addEventListener('transitionend', finalize);
    card._collapseTimer = setTimeout(finalize, 240); // fallback when transitions don't fire
    showToast('Alert hidden', function(){
      card._undone = true;
      card.removeEventListener('transitionend', finalize);
      clearTimeout(card._collapseTimer);
      delete dismissed[k]; save(dismissed);
      card.classList.remove('is-collapsing');
      setHidden(card, false);
      updateSection(sec);
    });
  }

  function restoreSection(sec){
    cardsOf(sec).forEach(function(c){
      var k = keyOf(c);
      if (dismissed[k]) { delete dismissed[k]; setHidden(c, false); }
    });
    save(dismissed);
    updateSection(sec);
  }

  // One delegated listener per section handles both the per-card × and the Show-hidden links.
  sections.forEach(function(sec){
    sec.addEventListener('click', function(e){
      if (!e.target.closest) return;
      var d = e.target.closest('[data-dismiss]');
      if (d) { var card = d.closest('[data-attn]'); if (card) dismissCard(card, sec); return; }
      if (e.target.closest('[data-restore]')) restoreSection(sec);
    });
  });
})();
</script>
</body></html>`;

writeFileSync(join(ROOT, 'index.html'), html);
console.log(`render: index.html (${(html.length / 1024).toFixed(1)} kB)`);
