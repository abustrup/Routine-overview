#!/usr/bin/env node
// collect.mjs — reconstruct each routine's REAL health from artifacts on disk.
// Zero dependencies, no scheduler access: reads git history, log-file tails and
// date-stamped output files. Writes data/status.json (consumed by render.mjs).
//
// The core idea: a routine is only healthy if it actually *produced* something on
// schedule. "It fired" (scheduler truth) is not enough — we check the artifact.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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
function lastCommit(dir, grep) {
  if (!repoOk(dir)) return null;
  const args = ['log', '-1', '--pretty=%cI%x1f%s'];
  if (grep) args.push('-E', `--grep=${grep}`);
  const out = git(dir, args);
  if (!out) return null;
  const [when, subject] = out.split('');
  return when ? { when, subject: subject || '' } : null;
}

function mtime(path) {
  try { return existsSync(path) ? statSync(path).mtimeMs : null; } catch { return null; }
}

function tail(path, n = 60) {
  try {
    if (!existsSync(path)) return [];
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

// ---------- freshness resolution ----------
// Returns { atMs, headline } — atMs is when the routine last demonstrably produced output.
function resolveFreshness(f) {
  if (!f) return { atMs: null, headline: '' };
  switch (f.type) {
    case 'gitAny': {
      const c = lastCommit(expand(cfg.repos[f.repo] || ''));
      return c ? { atMs: Date.parse(c.when), headline: c.subject } : { atMs: null, headline: '' };
    }
    case 'gitSubject': {
      const c = lastCommit(expand(cfg.repos[f.repo] || ''), f.match);
      return c ? { atMs: Date.parse(c.when), headline: c.subject } : { atMs: null, headline: '' };
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
  // de-dupe identical lines, keep worst severity
  const all = [...hit(scan.error, 'error'), ...hit(scan.warn, 'warn'), ...hit(scan.note, 'note')];
  const seen = new Map();
  for (const i of all) if (!seen.has(i.line)) seen.set(i.line, i);
  return [...seen.values()];
}

// ---------- health model ----------
const RANK = { green: 0, yellow: 1, red: 2 };
const worse = (a, b) => (RANK[a] >= RANK[b] ? a : b);

function healthFor(r, atMs, issues) {
  const fr = r._fr;
  if (fr.retired) return 'retired';
  if (r.enabled === false) return 'paused';
  if (fr.advisory) {
    // monitors / self-alerting producers: green unless their own log shows an error
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

// ---------- build routine records ----------
function buildRoutine(r) {
  r._fr = resolveFreshness(r.freshness);
  const issues = scanLog(r.scan);
  const health = healthFor(r, r._fr.atMs, issues);
  return {
    id: r.id, name: r.name, project: r.project, cadence: r.cadence, kind: r.kind,
    role: r.role, enabled: r.enabled !== false, does: r.does,
    health,
    headline: r._fr.headline,
    lastOutputAt: r._fr.atMs ? iso(r._fr.atMs) : null,
    lastOutputHuman: r._fr.advisory || r._fr.retired ? '—' : ageHuman(r._fr.atMs),
    issues,
    review: r.review || null,
  };
}

const routines = [...cfg.routines, ...cfg.launchd].map(buildRoutine);
const byId = Object.fromEntries(routines.map((r) => [r.id, r]));

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
  const links = (p.links || []).map((l) => ({
    label: l.label,
    url: l.url.startsWith('local:') ? repoDir : l.url,
  }));
  return {
    id: p.id, name: p.name, emoji: p.emoji, goal: p.goal, note: p.note || null,
    health, links,
    lastPublish: repoAtMs ? iso(repoAtMs) : null,
    lastPublishHuman: ageHuman(repoAtMs),
    lastPublishSubject: repoCommit ? repoCommit.subject : null,
    routineCount: mine.length,
    routines: mine.map((r) => r.id),
  };
});

// ---------- attention list (the whole point: what needs Alexander) ----------
const attention = [];
for (const r of routines) {
  for (const i of r.issues) {
    if (i.severity === 'error') attention.push({ severity: 'red', project: r.project, routine: r.name, message: i.line, kind: 'error' });
    if (i.severity === 'note') attention.push({ severity: 'info', project: r.project, routine: r.name, message: i.line, kind: 'note' });
  }
  if (r.health === 'red' && !r.issues.some((i) => i.severity === 'error'))
    attention.push({ severity: 'red', project: r.project, routine: r.name, message: `Stale — last output ${r.lastOutputHuman} (expected ${r.cadence}).`, kind: 'stale' });
  if (r.health === 'yellow' && !r.issues.length)
    attention.push({ severity: 'warn', project: r.project, routine: r.name, message: `Ageing — last output ${r.lastOutputHuman} (expected ${r.cadence}).`, kind: 'ageing' });
  if (r.review && r.enabled !== false)
    attention.push({ severity: 'review', project: r.project, routine: r.name, message: r.review, kind: 'review' });
  if (r.review && r.enabled === false && r.role === 'producer')
    attention.push({ severity: 'review', project: r.project, routine: r.name, message: r.review, kind: 'paused-producer' });
}
const sevRank = { red: 0, warn: 1, review: 2, info: 3 };
attention.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);

// ---------- summary counts (enabled, non-retired routines) ----------
const counted = routines.filter((r) => r.health !== 'retired' && r.enabled !== false);
const summary = {
  green: counted.filter((r) => r.health === 'green').length,
  yellow: counted.filter((r) => r.health === 'yellow').length,
  red: counted.filter((r) => r.health === 'red').length,
  paused: routines.filter((r) => r.enabled === false && r.health !== 'retired').length,
  total: routines.length,
  needsAttention: attention.filter((a) => a.severity === 'red' || a.severity === 'warn').length,
};

const nowLocal = new Intl.DateTimeFormat('en-GB', {
  timeZone: cfg.timezone, dateStyle: 'medium', timeStyle: 'short',
}).format(new Date());

const status = {
  generatedAt: iso(nowMs),
  generatedAtLocal: `${nowLocal} ${cfg.timezone}`,
  owner: cfg.owner,
  summary, attention, projects, routines,
};

writeFileSync(join(ROOT, 'data', 'status.json'), JSON.stringify(status, null, 2));
console.log(`collect: ${summary.green}🟢 ${summary.yellow}🟡 ${summary.red}🔴 ${summary.paused}⏸  · ${attention.length} attention item(s)`);
if (attention.length) for (const a of attention.slice(0, 8)) console.log(`  [${a.severity}] ${a.routine}: ${a.message}`);
