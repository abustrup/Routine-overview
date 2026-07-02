#!/usr/bin/env node
// collect.mjs — reconstruct each routine's REAL health from artifacts on disk.
// Zero dependencies, no scheduler access: reads git history, log-file tails and
// date-stamped output files. Writes data/status.json (consumed by render.mjs).
//
// The core idea: a routine is only healthy if it actually *produced* something on
// schedule. "It fired" (scheduler truth) is not enough — we check the artifact.
//
// PUBLIC-REPO RULE: raw commit subjects / log lines from a `private.roots` source
// (the local-only holdet-bot) are strategy-bearing. They are NEVER written to
// status.json — only a sanitized health phrase. Specifics belong in the private
// push notification, which the hourly routine composes from the local logs.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename } from 'node:path';
import { homedir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'projects.json'), 'utf8'));
const HOME = homedir();

// ---------- token expansion ----------
const todayStr = new Intl.DateTimeFormat('en-CA', {
  timeZone: cfg.timezone, year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date()); // en-CA => YYYY-MM-DD

function expand(p) {
  if (!p) return p;
  return p
    .replace(/\{HOME\}/g, HOME)
    .replace(/\{today\}/g, todayStr)
    .replace(/\{repo:([^}]+)\}/g, (_, k) => expand(cfg.repos[k] || `{repo:${k}}`));
}

// Sources under these roots are private (local-only, strategy-bearing) -> sanitize output.
const PRIVATE_ROOTS = (cfg.private?.roots || []).map(expand);
// Never read/emit lines from files that look like secrets — defence in depth against a
// mis-edited config redirecting a scan at credentials.
const SECRET_RE = /(^|\/)(auth|\.env|\.ssh)|holdet\.json|credential|token|secret|\.pem$/i;

// ---------- primitives ----------
const nowMs = Date.now();
const iso = (ms) => new Date(ms).toISOString();

function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000,
    }).trim();
  } catch { return null; }
}
function repoOk(dir) { return dir && existsSync(join(dir, '.git')); }

// Last commit (optionally whose subject matches an extended-regex). Returns {when, subject} or null.
const SEP = String.fromCharCode(31); // 0x1F unit separator
function lastCommit(dir, grep) {
  if (!repoOk(dir)) return null;
  const args = ['log', '-1', `--pretty=%cI${SEP}%s`];
  if (grep) args.push('-E', `--grep=${grep}`);
  const out = git(dir, args);
  if (!out) return null;
  const i = out.indexOf(SEP); // slice, don't destructure — a subject may itself contain SEP
  if (i < 0) return { when: out, subject: '' };
  return { when: out.slice(0, i), subject: out.slice(i + 1) };
}

function mtime(path) {
  try { return existsSync(path) ? statSync(path).mtimeMs : null; } catch { return null; }
}

function tail(path, n = 60) {
  try {
    if (!existsSync(path) || SECRET_RE.test(path)) return [];
    const lines = readFileSync(path, 'utf8').split('\n');
    return lines.slice(-n).filter((l) => l.length);
  } catch { return []; }
}

function ageHuman(ms) {
  if (ms == null) return '—';
  const d = nowMs - ms;
  if (d < 0) return 'in the future';
  const min = d / 6e4, hr = min / 60, day = hr / 24;
  if (min < 1) return 'just now';
  if (min < 60) return `${Math.round(min)} min ago`;
  if (hr < 24) return `${Math.round(hr)}h ago`;
  return `${Math.round(day)}d ago`;
}

// A trailing parenthetical on a commit subject is git-log rationale (e.g. this repo's own
// "(honesty/clarity)" improve-tags or "(… already notified)" status lines), not dashboard
// copy. Strip it so any commit subject shown on the public page — project "Latest" lines AND
// roster rows alike — stays skimmable and never argues with the hero verdict above it.
const cleanSubject = (s) => (s || '').replace(/\s*\([^()]*\)\s*$/, '').trim();

// ---------- privacy ----------
const underPrivate = (p) => !!p && PRIVATE_ROOTS.some((root) => p.startsWith(root));
function routineIsPrivate(r) {
  const f = r.freshness || {};
  const paths = [
    cfg.repos[f.repo], f.path, cfg.repos[f.fallback?.repo], f.fallback?.path, r.scan?.path,
  ].filter(Boolean).map(expand);
  return paths.some(underPrivate);
}

// ---------- freshness resolution ----------
// Returns { atMs, headline } — atMs is when the routine last demonstrably produced output.
function resolveFreshness(f) {
  if (!f) return { atMs: null, headline: '' };
  switch (f.type) {
    case 'gitAny': {
      const c = lastCommit(expand(cfg.repos[f.repo] || ''));
      return c ? { atMs: Date.parse(c.when), headline: cleanSubject(c.subject) } : { atMs: null, headline: '' };
    }
    case 'gitSubject': {
      const c = lastCommit(expand(cfg.repos[f.repo] || ''), f.match);
      return c ? { atMs: Date.parse(c.when), headline: cleanSubject(c.subject) } : { atMs: null, headline: '' };
    }
    case 'fileToday': {
      const p = expand(f.path);
      if (existsSync(p)) return { atMs: mtime(p), headline: `published ${todayStr}` };
      if (f.fallback) {
        const fb = resolveFreshness(f.fallback);
        return { atMs: fb.atMs, headline: fb.headline || `today (${todayStr}) not yet published` };
      }
      return { atMs: null, headline: `today (${todayStr}) not yet published` };
    }
    case 'fileMtime': {
      const p = expand(f.path);
      const m = mtime(p);
      return { atMs: m, headline: m ? `updated ${ageHuman(m)}` : 'no output file yet' };
    }
    case 'logMtime': {
      const p = expand(f.path);
      const m = mtime(p);
      const last = tail(p, 8).reverse().find((l) => l.trim() && !l.startsWith('==='));
      return { atMs: m, headline: last ? last.trim().slice(0, 120) : (m ? 'ran' : 'no log yet') };
    }
    case 'selfAlerting':
      return { atMs: null, headline: f.note || 'advisory — silent unless it fails', advisory: true };
    case 'retired':
      return { atMs: null, headline: 'one-time — completed', retired: true };
    default:
      return { atMs: null, headline: '' };
  }
}

// ---------- log error/warn/note scanning ----------
function scanLog(scan) {
  if (!scan) return [];
  const lines = tail(expand(scan.path), 80);
  const ignore = (scan.ignore || []).map((p) => new RegExp(p, 'i'));
  const hit = (pats, sev) => {
    const out = [];
    for (const pat of pats || []) {
      const re = new RegExp(pat, 'i');
      for (const l of lines) {
        if (re.test(l) && !ignore.some((ir) => ir.test(l))) {
          out.push({ severity: sev, line: l.trim().slice(0, 160) });
          break; // one hit per pattern is enough
        }
      }
    }
    return out;
  };
  const all = [...hit(scan.error, 'error'), ...hit(scan.warn, 'warn'), ...hit(scan.note, 'note')];
  const seen = new Map();
  for (const i of all) if (!seen.has(i.line)) seen.set(i.line, i);
  return [...seen.values()];
}

// ---------- health model ----------
const RANK = { green: 0, yellow: 1, red: 2 };
const worse = (a, b) => ((RANK[a] ?? -1) >= (RANK[b] ?? -1) ? a : b);

function healthFor(r, atMs, issues) {
  const fr = r._fr;
  if (fr.retired) return 'retired';
  if (r.enabled === false) return 'paused';
  if (fr.advisory) {
    return issues.some((i) => i.severity === 'error') ? 'red' : 'green';
  }
  let h;
  if (atMs == null) {
    h = 'unknown';
  } else {
    const ageH = (nowMs - atMs) / 36e5;
    const p = r.periodHours || 24;
    const { warnAt, staleAt } = cfg.thresholds;
    h = ageH > p * staleAt ? 'red' : ageH > p * warnAt ? 'yellow' : 'green';
  }
  if (issues.some((i) => i.severity === 'error')) h = 'red';
  else if (issues.some((i) => i.severity === 'warn') && h === 'green') h = 'yellow';
  return h;
}

// ---------- public-safe text (for private sources) ----------
function safeHeadline(r, health) {
  const fr = r._fr;
  if (fr.retired) return 'one-time — completed';
  if (fr.advisory) return fr.headline; // our own advisory copy, not artifact text
  if (r.enabled === false) return 'paused';
  if (health === 'red') return 'error detected in local log — details kept private';
  if (health === 'yellow') return 'ageing / warning — details kept private';
  if (fr.atMs == null) return 'no output signal';
  return 'ran — no errors detected';
}
function safeIssue(i, r) {
  const where = r.scan?.path ? basename(expand(r.scan.path)) : 'local log';
  if (i.severity === 'error') return { severity: 'error', line: `error detected in ${where} — details are local-only` };
  if (i.severity === 'warn') return { severity: 'warn', line: `warning in ${where} — details are local-only` };
  return { severity: 'note', line: 'a data source is degraded — details are local-only' };
}

// ---------- build routine records ----------
const knownProjectIds = new Set(cfg.projects.map((p) => p.id));
function buildRoutine(r) {
  r._fr = resolveFreshness(r.freshness);
  const rawIssues = scanLog(r.scan);              // real detection (health) uses raw
  const health = healthFor(r, r._fr.atMs, rawIssues);
  const priv = routineIsPrivate(r);
  const headline = priv ? safeHeadline(r, health) : r._fr.headline;      // public output sanitized
  const issues = priv ? rawIssues.map((i) => safeIssue(i, r)) : rawIssues;
  if (!knownProjectIds.has(r.project))
    console.warn(`collect: WARN routine "${r.id}" -> unknown project "${r.project}" (won't roll up)`);
  return {
    id: r.id, name: r.name, project: r.project, cadence: r.cadence, kind: r.kind,
    role: r.role, enabled: r.enabled !== false, does: r.does,
    health,
    private: priv,
    headline,
    logName: r.scan?.path ? basename(expand(r.scan.path)) : null,
    lastOutputAt: r._fr.atMs ? iso(r._fr.atMs) : null,
    lastOutputHuman: r._fr.advisory || r._fr.retired ? '—' : ageHuman(r._fr.atMs),
    issues,
    review: r.review || null,
  };
}

const routines = [...cfg.routines, ...cfg.launchd].map(buildRoutine);

// ---------- projects ----------
const projects = cfg.projects.map((p) => {
  const mine = routines.filter((r) => r.project === p.id);
  const active = mine.filter((r) => r.health !== 'retired' && r.health !== 'paused' && r.health !== 'unknown');
  let health = 'green';
  for (const r of active) {
    let c = ['green', 'yellow', 'red'].includes(r.health) ? r.health : 'green';
    // A broken support loop degrades a project to "attention", not "broken":
    // only a failing producer (fields the team, ships the brief) can make it red.
    if ((r.role === 'maintainer' || r.role === 'monitor') && c === 'red') c = 'yellow';
    health = worse(health, c);
  }
  const repoDir = expand(cfg.repos[p.healthFromRepo] || '');
  const repoCommit = lastCommit(repoDir);
  const repoAtMs = repoCommit ? Date.parse(repoCommit.when) : null;
  // Project "Now" line uses the public pages repo commit subject — safe by construction, but
  // guard anyway in case healthFromRepo ever points at a private root. cleanSubject strips the
  // git-log rationale so the "Latest" line never contradicts the hero verdict above it.
  const repoSubject = repoCommit ? (underPrivate(repoDir) ? 'updated' : cleanSubject(repoCommit.subject)) : null;
  const links = (p.links || []).map((l) => ({
    label: l.label,
    // Local links render as a plain label (no href); keep the absolute path out of the
    // public status.json by showing it home-relative.
    url: l.url.startsWith('local:') ? repoDir.split(HOME).join('~') : l.url,
  }));
  return {
    id: p.id, name: p.name, emoji: p.emoji, goal: p.goal, note: p.note || null,
    health, links,
    lastPublish: repoAtMs ? iso(repoAtMs) : null,
    lastPublishHuman: ageHuman(repoAtMs),
    lastPublishSubject: repoSubject,
    routineCount: mine.length,
    routines: mine.map((r) => r.id),
  };
});

// ---------- attention list (the whole point: what needs Alexander) ----------
const attention = [];
for (const r of routines) {
  for (const i of r.issues) {
    if (i.severity === 'error') attention.push({ severity: 'red', project: r.project, routine: r.name, message: i.line, kind: 'error' });
    if (i.severity === 'warn') attention.push({ severity: 'warn', project: r.project, routine: r.name, message: i.line, kind: 'warn' });
    if (i.severity === 'note') attention.push({ severity: 'info', project: r.project, routine: r.name, message: i.line, kind: 'note' });
  }
  const hasError = r.issues.some((i) => i.severity === 'error');
  if (r.health === 'red' && !hasError)
    attention.push({ severity: 'red', project: r.project, routine: r.name, message: `Stale — last output ${r.lastOutputHuman} (expected ${r.cadence}).`, kind: 'stale' });
  if (r.health === 'yellow' && !hasError && !r.issues.some((i) => i.severity === 'warn'))
    attention.push({ severity: 'warn', project: r.project, routine: r.name, message: `Ageing — last output ${r.lastOutputHuman} (expected ${r.cadence}).`, kind: 'ageing' });
  if (r.review && r.enabled !== false)
    attention.push({ severity: 'review', project: r.project, routine: r.name, message: r.review, kind: 'review' });
  if (r.review && r.enabled === false && r.role === 'producer')
    attention.push({ severity: 'review', project: r.project, routine: r.name, message: r.review, kind: 'paused-producer' });
}
const sevRank = { red: 0, warn: 1, review: 2, info: 3 };
attention.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

// ---------- one-click fix: a copy-paste prompt for a fresh session ----------
// Never embeds private log text — points the fix-session at the LOCAL log to read the
// real error itself, so it stays actionable and leak-safe. Home dir shown as "~".
const rByName = Object.fromEntries(routines.map((r) => [r.name, r]));
const projCfg = Object.fromEntries(cfg.projects.map((p) => [p.id, p]));
const tilde = (s) => (s ? s.split(HOME).join('~') : s);

// Public-page backstop: this text ships to a PUBLIC repo, so neutralise any residual
// sensitive detail (protected file paths, secrets, absolute home paths) even if a future
// config edit reintroduces it. Source strings are already public-safe; this is defence-in-depth.
const HOME_RE = new RegExp(HOME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
const SCRUB = [
  [/\bauth\/\S*/gi, 'its protected files'],
  [/\bsrc\/(?:login|execute)\.js\b/gi, 'its protected files'],
  [/\.env\b/gi, 'secrets'],
  [/publish token/gi, 'credentials'],
  [HOME_RE, '~'],
];
const scrubPublic = (s) => (s ? SCRUB.reduce((acc, [re, rep]) => acc.replace(re, rep), s) : s);

function fixFor(a) {
  if (!['red', 'warn', 'review'].includes(a.severity)) return null;
  const r = rByName[a.routine];
  const known = knownProjectIds.has(a.project);
  const p = known ? projCfg[a.project] : {};
  const cwd = known ? tilde(expand(p.fixCwd || cfg.repos.overview)) : null;
  const where = cwd ? `Working dir: ${cwd}.` : `First identify which project this routine belongs to, then work there.`;
  const constraints = p.constraints || 'Make a change only if you can verify it is safe and does not break anything, then commit.';
  const logName = r?.logName || null;
  const does = r?.does ? ` (${r.does})` : '';
  let guide, prompt;
  if (a.kind === 'error') {
    guide = `${a.routine} logged an error — it may be broken.`;
    prompt = `The scheduled routine "${a.routine}"${does} is erroring. ${where} ${logName ? `Read ${logName} for the exact error, then find` : 'Find'} the root cause, fix it, add a guard or test so it can't recur, verify by re-running the step, and commit. ${constraints}`;
  } else if (a.kind === 'stale' || a.kind === 'ageing') {
    guide = `${a.routine} hasn't produced output when expected (${r?.cadence || 'on schedule'}).`;
    prompt = `The scheduled routine "${a.routine}"${does} was expected to run ${r?.cadence || 'on schedule'} but produced no recent output. ${where} Investigate why it stopped (check its scheduler run and its log), fix the cause, verify a fresh run produces output, and commit. ${constraints}`;
  } else {
    guide = a.message;
    prompt = `About the scheduled routine "${a.routine}"${does}. ${where} Decision to make: ${a.message} Investigate, decide the best action, and implement it if warranted; otherwise briefly explain why to leave it as-is. ${constraints}`;
  }
  return { guide: scrubPublic(guide), prompt: scrubPublic(prompt.replace(/\s+/g, ' ').trim()), cwd: scrubPublic(cwd) };
}
for (const a of attention) {
  const f = fixFor(a);
  if (f) a.fix = f;
}

// ---------- summary counts (enabled, non-retired routines) ----------
const counted = routines.filter((r) => r.health !== 'retired' && r.enabled !== false);
// `total` is the sum the hero's counts row breaks down (green+yellow+red+paused),
// so it must exclude retired one-time routines — otherwise the four chips visibly
// under-sum the total beside them. Retired routines still appear in the roster.
const nonRetired = routines.filter((r) => r.health !== 'retired');
const summary = {
  green: counted.filter((r) => r.health === 'green').length,
  yellow: counted.filter((r) => r.health === 'yellow').length,
  red: counted.filter((r) => r.health === 'red').length,
  paused: routines.filter((r) => r.enabled === false && r.health !== 'retired').length,
  total: nonRetired.length,
  needsAttention: attention.filter((a) => a.severity === 'red' || a.severity === 'warn').length,
};

// Stable content hash of the actionable set — lets the routine de-dupe notifications by
// *content*, so a persistent red item that was already notified never re-pushes.
const attentionKey = attention
  .filter((a) => a.severity === 'red' || a.severity === 'warn')
  .map((a) => `${a.severity}:${a.routine}:${a.kind}`)
  .sort()
  .join('|');

const nowLocal = new Intl.DateTimeFormat('en-GB', {
  timeZone: cfg.timezone, dateStyle: 'medium', timeStyle: 'short',
}).format(new Date());

const status = {
  generatedAt: iso(nowMs),
  generatedAtLocal: `${nowLocal} ${cfg.timezone}`,
  owner: cfg.owner,
  attentionKey,
  summary, attention, projects, routines,
};

writeFileSync(join(ROOT, 'data', 'status.json'), JSON.stringify(status, null, 2));
console.log(`collect: ${summary.green}🟢 ${summary.yellow}🟡 ${summary.red}🔴 ${summary.paused}⏸  · ${attention.length} attention item(s)`);
if (attention.length) for (const a of attention.slice(0, 8)) console.log(`  [${a.severity}] ${a.routine}: ${a.message}`);
