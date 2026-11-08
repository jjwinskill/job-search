#!/usr/bin/env node
// The rule-bound half of /job-search:check-status. The skill reads the mail and judges each thread; this script
// owns every rule: the mail window, matching mail to Applications, Status changes (never backward), the 30-day
// ghosted rule, the Inbound pay floor, and the report's six fixed sections. The input format is in
// skills/check-status/run-input.md.
//
//   check-status.mjs window [--today D]                              the mail window, as JSON
//   check-status.mjs apps                                            one line per Application, for matching mail
//   check-status.mjs run <input.json> [--today D] [--dry-run]        apply the mail, write reports/D.md, print it
//   check-status.mjs set <folder> <status> [--date D] [--note text]  record the candidate's own decision or correction
//
// Exit codes: 0 done, 1 bad input, 2 not set up.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STATUSES, buildIndex, parseFrontmatter } from './build-index.mjs';
import { ConfigError, loadConfig } from './config.mjs';

export const GHOST_DAYS = 30;
// When an open Application shows up under "Going quiet": days since it was last heard from (drafted: since created).
export const QUIET_DAYS = { applied: 21, active: 14, drafted: 7 };
// Inbound older than this is listed together in Needs you rather than one line each.
export const STALE_INBOUND_DAYS = 30;
export const FIRST_RUN_MONTHS = 6;
export const EVENT_TYPES = ['applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'contact'];
const RANK = { inbound: 0, drafted: 1, applied: 2, screening: 3, interviewing: 4, offer: 5 };
const OPEN = Object.keys(RANK);
const ACTIVE = ['screening', 'interviewing', 'offer'];
const CLOSED = ['rejected', 'withdrawn', 'passed'];
const CHECKS = {
  level: ['pass', 'fail', 'unknown'],
  focus: ['pass', 'fail', 'unknown'],
  location: ['pass', 'fail', 'unknown'],
  type: ['full-time', 'contract', 'fail', 'unknown'],
  legitimacy: ['pass', 'unverified', 'fail'],
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REPORT = /^(\d{4}-\d{2}-\d{2})(?:-(\d+))?\.md$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class InputError extends Error {}

// ---- dates (YYYY-MM-DD strings, compared as calendar days) ----

const dayNumber = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 86400000;
export const daysBetween = (from, to) => dayNumber(to) - dayNumber(from);
export const addDays = (d, n) => new Date((dayNumber(d) + n) * 86400000).toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');
export const localToday = (now = new Date()) => `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const latest = (...dates) => dates.filter((d) => DATE.test(d ?? '')).sort().at(-1) ?? '';

export function monthsBefore(d, months) {
  let year = +d.slice(0, 4);
  let month = +d.slice(5, 7) - months;
  while (month < 1) { month += 12; year -= 1; }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(+d.slice(8, 10), lastDay))}`;
}

export function formatDate(d, today) {
  if (!DATE.test(d ?? '')) return '–';
  const text = `${MONTHS[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;
  return today && d.slice(0, 4) === today.slice(0, 4) ? text : `${text}, ${d.slice(0, 4)}`;
}

// ---- the mail window ----

export function reportFiles(reportsDir) {
  if (!existsSync(reportsDir)) return [];
  return readdirSync(reportsDir)
    .map((name) => REPORT.exec(name))
    .filter(Boolean)
    .map((m) => ({ name: m[0], date: m[1], n: Number(m[2] ?? 1) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.n - b.n);
}

// No reports yet: the last 6 months. Otherwise from the newest report's date, which overlaps that day on purpose:
// mail already applied changes nothing, so the overlap is free.
export function mailWindow(reportsDir, today) {
  const last = reportFiles(reportsDir).at(-1);
  const since = last ? last.date : monthsBefore(today, FIRST_RUN_MONTHS);
  return { since, until: today, firstRun: !last, lastReport: last?.name ?? null, query: `after:${since.replaceAll('-', '/')}` };
}

export function reportPath(reportsDir, today) {
  const sameDay = reportFiles(reportsDir).filter((r) => r.date === today);
  const n = sameDay.length ? Math.max(...sameDay.map((r) => r.n)) + 1 : 1;
  return join(reportsDir, n === 1 ? `${today}.md` : `${today}-${n}.md`);
}

// ---- Status rules ----

// What one email does to a Status. `newer` means the email is dated after the Application was last heard from.
// Mail never moves a Status backward. Mail that would reopen a closed Application is a conflict for the candidate.
export function nextStatus(current, type, newer) {
  if (CLOSED.includes(current)) {
    if (['contact', 'rejected', 'withdrawn', current].includes(type)) return { status: current };
    return newer ? { status: current, conflict: true } : { status: current };
  }
  if (current === 'ghosted') {
    if (type === 'applied' || type === 'contact') return { status: newer ? 'applied' : 'ghosted' };
    return { status: type };
  }
  if (type === 'contact') return { status: current };
  if (type === 'rejected' || type === 'withdrawn') return { status: type };
  return { status: RANK[type] > (RANK[current] ?? Infinity) ? type : current };
}

const heardFrom = (fields) => latest(fields.applied, fields.last_contact) || fields.created || '';

// The date the 30-day clock started, when an applied Application has run out of it.
export function ghostDue(fields, today) {
  if (fields.status !== 'applied') return null;
  const since = heardFrom(fields);
  return DATE.test(since) && daysBetween(since, today) >= GHOST_DAYS ? since : null;
}

export function quietNote(fields, today) {
  const since = heardFrom(fields);
  if (!DATE.test(since)) return null;
  const days = daysBetween(since, today);
  const { status } = fields;
  if (status === 'applied' && days >= QUIET_DAYS.applied) return { status, since, days, ghostOn: addDays(since, GHOST_DAYS) };
  if (ACTIVE.includes(status) && days >= QUIET_DAYS.active) return { status, since, days };
  if (status === 'drafted' && days >= QUIET_DAYS.drafted) return { status, since, days };
  return null;
}

// ---- Inbound screening ----

// The top of a posted range, per year. Hourly rates count as 2,080 hours, monthly ones as 12 months.
// Only dollar amounts count when the text has any, so "401k" or "10% bonus" can't pose as pay. null when nothing parses.
export function parsePayTop(range) {
  if (!range) return null;
  const text = String(range).toLowerCase().replaceAll(',', '').replace(/401\s*\(?k\)?/g, '');
  const hourly = /\/\s*h(ou)?r\b|per hour|hourly|an hour/.test(text);
  const monthly = /\/\s*mo(nth)?\b|per month|monthly|a month/.test(text);
  const amounts = [...text.matchAll(/(\$)?\s*(\d+(?:\.\d+)?)(?![\d.])\s*(k\b|m\b)?(?!\s*%)/g)]
    .map(({ 1: dollar, 2: n, 3: unit, index }) => ({
      // The far end of a range ("$85-95") carries the first end's dollar sign.
      dollar: !!dollar || /\$\s*[\d.]+\s*[km]?\s*(-|–|—|to)\s*$/.test(text.slice(0, index)),
      value: Number(n) * (unit?.[0] === 'k' ? 1e3 : unit?.[0] === 'm' ? 1e6 : 1),
    }))
    .filter((a) => a.value > 0);
  const values = (amounts.some((a) => a.dollar) ? amounts.filter((a) => a.dollar) : amounts).map((a) => a.value);
  if (!values.length) return null;
  const top = Math.max(...values);
  if (hourly) return Math.round(top * 2080);
  if (monthly) return Math.round(top * 12);
  return top < 1000 ? top * 1000 : top;
}

// The floor from the criteria file's "Pay floor: $150k" line, per year. null when the file names none.
export function payFloor(criteriaText) {
  const m = /pay floor[^\n$]*\$\s*(\d+(?:[.,]\d+)?)\s*(k)?/i.exec(criteriaText ?? '');
  if (!m) return null;
  const n = Number(m[1].replaceAll(',', ''));
  return m[2] ? n * 1000 : n;
}

const money = (n) => (n % 1000 === 0 ? `$${n / 1000}k` : `$${Math.round(n).toLocaleString('en-US')}`);

// The skill judges each criterion; this turns the judgments into an outcome. Any fail screens the Inbound out.
// Contracts, unverified senders, unknowns and a missing pay range are flagged, never rejected.
export function screen(item, floor) {
  const checks = item.checks ?? {};
  const reasons = item.reasons ?? {};
  const out = [];
  const flags = [];
  for (const key of Object.keys(CHECKS)) {
    const value = checks[key] ?? 'unknown';
    if (value === 'fail') out.push(`${key}: ${reasons[key] ?? 'outside the criteria'}`);
    else if (value === 'contract' || value === 'unverified') flags.push(value);
    else if (value === 'unknown') flags.push(`${key} unknown`);
  }
  const top = parsePayTop(item.pay_range);
  if (top == null) flags.push('pay unknown');
  else if (floor != null && top < floor) out.push(`pay: the top of the range, ${money(top)}, is under the ${money(floor)} floor`);
  return out.length ? { outcome: 'screened-out', reasons: out, flags } : { outcome: 'inbound', flags };
}

// ---- matching mail to Applications ----

const COMPANY_NOISE = new Set(['inc', 'llc', 'ltd', 'corp', 'corporation', 'co', 'company', 'the', 'plc', 'gmbh']);
const ROLE_NOISE = new Set([
  'senior', 'sr', 'staff', 'principal', 'lead', 'software', 'engineer', 'engineering', 'developer', 'development',
  'sde', 'swe', 'i', 'ii', 'iii', 'iv', 'and', 'of', 'the', 'for', 'a', 'an', 'to', 'with', 'in', 'at', 'role', 'position',
]);

const words = (s) => String(s ?? '')
  .normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/\b(full|front|back)[\s-]+(stack|end)\b/g, '$1$2')
  .split(/[^a-z0-9]+/)
  .filter(Boolean);

// Same company when one name's words start the other's: "Example" matches "Example Labs Inc".
export function sameCompany(a, b) {
  const x = words(a).filter((w) => !COMPANY_NOISE.has(w));
  const y = words(b).filter((w) => !COMPANY_NOISE.has(w));
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((w, i) => long[i] === w);
}

// Overlap of the distinctive words in two role titles, 0 to 1. Seniority and "software engineer" don't count.
export function roleSimilarity(a, b) {
  const x = new Set(words(a).filter((w) => !ROLE_NOISE.has(w)));
  const y = new Set(words(b).filter((w) => !ROLE_NOISE.has(w)));
  if (!x.size && !y.size) return 1;
  if (!x.size || !y.size) return 0.5;
  const shared = [...x].filter((w) => y.has(w)).length;
  return shared / (x.size + y.size - shared);
}

// Finds the Application an email belongs to: { app }, { ambiguous: [folders] } or { none: true }.
// Only Applications started by the email's date (a day's slack for time zones) are candidates.
// A confirmation for a clearly different role at a known company is a new Application.
export function matchApplication(apps, { company, role, date, type }) {
  const candidates = apps.filter((a) => sameCompany(a.fields.company, company)
    && (!date || !a.start || a.start <= addDays(date, 1)));
  if (!candidates.length) return { none: true };
  const scored = candidates
    .map((a) => ({ a, score: role ? roleSimilarity(role, a.fields.role) : 0.5 }))
    .sort((p, q) => q.score - p.score);
  const [best, second] = scored;
  if (type === 'applied' && role && best.score < 0.2) {
    // A confirmation where exactly one record awaits one is that record, however the ATS words the role.
    const waiting = candidates.filter((a) => a.fields.status === 'drafted' || a.fields.status === 'inbound');
    return waiting.length === 1 ? { app: waiting[0] } : { none: true };
  }
  if (!second || best.score - second.score >= 0.2) return { app: best.a };
  return { ambiguous: scored.map((s) => s.a.folder) };
}

// The same role in two titles: the same words, or the same distinctive words. Stricter than matching,
// because a recruiter's new role at a known company must not vanish into an old Application.
export function sameRole(a, b) {
  if (words(a).join(' ') === words(b).join(' ')) return true;
  const x = words(a).filter((w) => !ROLE_NOISE.has(w));
  return x.length > 0 && roleSimilarity(a, b) === 1;
}

// ---- reading and writing records ----

export function slugify(text, max = 60) {
  const slug = words(text).join('-');
  return slug.length > max ? slug.slice(0, max).replace(/-+$/, '') : slug;
}

// Values come from email, so line breaks and tabs fold to spaces: the frontmatter stays one line per key.
const fmValue = (value) => {
  const s = String(value ?? '').replace(/[\r\n\t\v\f\u2028\u2029]+/g, ' ');
  return /[:#]/.test(s) || s !== s.trim() || s.startsWith('"') ? JSON.stringify(s) : s;
};

// Sets keys in a record's flat frontmatter, keeping every other line and the body as they are.
export function updateFrontmatter(text, updates) {
  const normalized = text.replaceAll('\r\n', '\n');
  const m = /^---\n([\s\S]*?)\n---(\n|$)/.exec(normalized);
  if (!m) throw new InputError('record has no frontmatter');
  const lines = m[1].split('\n');
  for (const [key, value] of Object.entries(updates)) {
    const line = `${key}: ${fmValue(value)}`;
    const i = lines.findIndex((l) => l.startsWith(`${key}:`));
    if (i === -1) lines.push(line);
    else lines[i] = line;
  }
  return `---\n${lines.join('\n')}\n---${m[2]}${normalized.slice(m[0].length)}`;
}

export function appendNotes(text, notes) {
  if (!notes.length) return text;
  const trimmed = text.replace(/\s+$/, '');
  return `${trimmed}${/\n---$/.test(trimmed) ? '\n\n' : '\n'}${notes.join('\n')}\n`;
}

const RECORD_KEYS = ['company', 'role', 'status', 'created', 'applied', 'last_contact', 'source_url', 'location', 'pay_range', 'origin'];
const newRecord = (fields) => `---\n${RECORD_KEYS.map((k) => `${k}: ${fmValue(fields[k])}`).join('\n')}\n---\n`;

export function loadApplications(applicationsDir) {
  if (!existsSync(applicationsDir)) return [];
  const apps = [];
  for (const entry of readdirSync(applicationsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const file = join(applicationsDir, entry.name, 'application.md');
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const fields = parseFrontmatter(text);
    if (!fields) continue;
    const start = [fields.created, fields.applied].filter((d) => DATE.test(d ?? '')).sort()[0] ?? '';
    apps.push({ folder: entry.name, file, text, fields, start, heardBefore: heardFrom(fields), updates: {}, notes: [] });
  }
  return apps.sort((a, b) => (b.fields.created ?? '').localeCompare(a.fields.created ?? '') || a.folder.localeCompare(b.folder));
}

function createApplication(apps, applicationsDir, fields, today, note) {
  const base = `${fields.created}-${slugify(fields.company, 30) || 'unknown'}-${slugify(fields.role, 40) || 'role-not-named'}`;
  let folder = base;
  for (let n = 2; apps.some((a) => a.folder === folder) || existsSync(join(applicationsDir, folder)); n += 1) folder = `${base}-${n}`;
  const app = {
    folder, file: join(applicationsDir, folder, 'application.md'), text: null, isNew: true,
    fields: { origin: 'check-status', ...fields }, start: fields.created, updates: {},
    notes: [`Found by /check-status on ${today}.`, note],
  };
  apps.push(app);
  return app;
}

const name = (app) => [app.fields.company, app.fields.role].filter(Boolean).join(', ');
const TYPE_WORDS = { applied: 'confirmation', screening: 'screening', interviewing: 'interview', offer: 'offer', rejected: 'rejection', withdrawn: 'withdrawal', contact: 'mail' };

function setField(app, key, value) {
  app.fields[key] = value;
  app.updates[key] = value;
}

// What one email would change on one Application: { noop }, { conflict } or { before, status, changes }.
export function planEvent(fields, event) {
  const before = fields.status;
  const newer = event.date > heardFrom(fields);
  const { status, conflict } = nextStatus(before, event.type, newer);
  if (conflict) return { conflict: true };
  const changes = {};
  if (status !== before) changes.status = status;
  if (event.date > (fields.last_contact || '')) changes.last_contact = event.date;
  if (event.type === 'applied' && !fields.applied && ['inbound', 'drafted', 'applied'].includes(before)) changes.applied = event.date;
  if (before === 'offer' && status === 'withdrawn' && !fields.outcome) changes.outcome = 'offer-declined';
  return Object.keys(changes).length ? { before, status, changes } : { noop: true };
}

// Applies one email to one Application, with a dated note. Returns what planEvent returned.
export function applyEvent(app, event) {
  const plan = planEvent(app.fields, event);
  if (plan.noop || plan.conflict) return plan;
  const { before, status, changes } = plan;
  for (const [key, value] of Object.entries(changes)) setField(app, key, value);
  const what = status !== before ? `${before} → ${status}` : `${TYPE_WORDS[event.type]}, still ${status}`;
  app.notes.push(`${event.date}: ${what} (check-status). Evidence: ${event.evidence}.${event.action ? ` Next: ${event.action}` : ''}`);
  return plan;
}

// ---- input ----

export function validateInput(input) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return ['the input must be a JSON object'];
  for (const key of ['events', 'inbound', 'unmatched']) {
    if (input[key] !== undefined && !Array.isArray(input[key])) errors.push(`${key} must be a list`);
  }
  if (input.since !== undefined && !DATE.test(input.since)) errors.push('since must be YYYY-MM-DD');
  const need = (cond, where, message) => { if (!cond) errors.push(`${where}: ${message}`); };
  (Array.isArray(input.events) ? input.events : []).forEach((e, i) => {
    const where = `events[${i}]`;
    need(EVENT_TYPES.includes(e?.type), where, `type must be one of ${EVENT_TYPES.join(', ')}`);
    need(DATE.test(e?.date ?? ''), where, 'date must be YYYY-MM-DD');
    need(typeof e?.evidence === 'string' && e.evidence.trim(), where, 'evidence is required');
    need(e?.folder || e?.company, where, 'give folder, or company and role');
  });
  (Array.isArray(input.inbound) ? input.inbound : []).forEach((item, i) => {
    const where = `inbound[${i}]`;
    need(item?.company, where, 'company is required');
    need(DATE.test(item?.date ?? ''), where, 'date must be YYYY-MM-DD');
    need(typeof item?.evidence === 'string' && item.evidence.trim(), where, 'evidence is required');
    for (const [key, allowed] of Object.entries(CHECKS)) {
      const value = item?.checks?.[key];
      need(value === undefined || allowed.includes(value), where, `checks.${key} must be one of ${allowed.join(', ')}`);
    }
  });
  (Array.isArray(input.unmatched) ? input.unmatched : []).forEach((u, i) => {
    need(typeof u?.evidence === 'string' && u.evidence.trim(), `unmatched[${i}]`, 'evidence is required');
  });
  return errors;
}

// ---- the run ----

export function run({ paths, input, today, dryRun = false }) {
  const errors = validateInput(input);
  if (errors.length) throw new InputError(errors.join('\n'));
  const apps = loadApplications(paths.applications);
  const initial = new Map(apps.map((a) => [a.folder, a.fields.status]));
  const window = mailWindow(paths.reports, today);
  if (input.since && input.since !== window.since) Object.assign(window, { since: input.since, firstRun: false });
  const floor = existsSync(paths.criteria) ? payFloor(readFileSync(paths.criteria, 'utf8')) : null;
  const log = { needsYou: [], conflicts: [], screenedOut: [], unmatched: [], inbound: [] };
  const matched = new Set();
  const lastEvent = new Map();
  const firstEvent = new Map();

  for (const u of input.unmatched ?? []) log.unmatched.push(u);

  const events = [...(input.events ?? [])].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of events) {
    let app;
    if (e.folder) {
      app = apps.find((a) => a.folder === e.folder);
      if (!app) { log.unmatched.push({ ...e, why: `no Application folder "${e.folder}"` }); continue; }
    } else {
      const m = matchApplication(apps, e);
      if (m.ambiguous) {
        // Old mail that every candidate already reflects (one rejection covering two roles) changes nothing either way.
        const candidates = m.ambiguous.map((folder) => apps.find((a) => a.folder === folder));
        if (candidates.every((a) => planEvent(a.fields, e).noop)) {
          for (const a of candidates) if (!a.isNew) matched.add(a.folder);
        } else {
          log.unmatched.push({ ...e, why: `could be ${m.ambiguous.join(' or ')}` });
        }
        continue;
      }
      if (m.app) app = m.app;
      else if (e.type === 'contact') { log.unmatched.push({ ...e, why: `no Application for ${e.company}` }); continue; }
      else {
        app = createApplication(apps, paths.applications, {
          company: e.company, role: e.role ?? '', status: e.type, created: e.date,
          applied: e.type === 'applied' ? e.date : '', last_contact: e.date,
          source_url: e.source_url ?? '', location: e.location ?? '', pay_range: e.pay_range ?? '',
        }, today, `${e.date}: ${TYPE_WORDS[e.type]} (check-status). Evidence: ${e.evidence}.${e.action ? ` Next: ${e.action}` : ''}`);
        firstEvent.set(app.folder, e);
        if (e.action) log.needsYou.push({ app, text: e.action, date: e.date });
        continue;
      }
    }
    if (!app.isNew) matched.add(app.folder);
    const result = applyEvent(app, e);
    if (result.conflict) { log.conflicts.push({ app, e }); continue; }
    if (!result.noop) lastEvent.set(app.folder, e);
    if (e.action) log.needsYou.push({ app, text: e.action, date: e.date });
  }

  for (const item of input.inbound ?? []) {
    // A recruiter writing about a role already on record is mail about it. Anything else is a new Inbound to screen.
    const existing = { app: apps.find((a) => OPEN.includes(a.fields.status)
      && sameCompany(a.fields.company, item.company) && sameRole(a.fields.role, item.role ?? '')) };
    if (existing.app) {
      const e = { type: 'contact', date: item.date, evidence: item.evidence };
      if (!existing.app.isNew) matched.add(existing.app.folder);
      if (!applyEvent(existing.app, e).noop) lastEvent.set(existing.app.folder, e);
      continue;
    }
    const result = screen(item, floor);
    if (result.outcome === 'screened-out') { log.screenedOut.push({ ...item, reasons: result.reasons }); continue; }
    const flags = result.flags.length ? ` Flags: ${result.flags.join(', ')}.` : '';
    const app = createApplication(apps, paths.applications, {
      company: item.company, role: item.role ?? '', status: 'inbound', created: item.date, applied: '',
      last_contact: item.date, source_url: item.source_url ?? '', location: item.location ?? '', pay_range: item.pay_range ?? '',
    }, today, `${item.date}: Inbound${item.from ? ` from ${item.from}` : ''} (check-status). Evidence: ${item.evidence}.${flags}`);
    log.inbound.push({ app, item, flags: result.flags });
  }

  const ghosted = new Map();
  for (const app of apps) {
    const since = ghostDue(app.fields, today);
    if (!since) continue;
    setField(app, 'status', 'ghosted');
    app.notes.push(`${today}: applied → ghosted (check-status): no reply in ${GHOST_DAYS} days since ${since}.`);
    ghosted.set(app.folder, since);
  }

  const changed = [];
  for (const app of apps) {
    const was = initial.get(app.folder);
    const now = app.fields.status;
    const e = lastEvent.get(app.folder);
    if (app.isNew && now !== 'inbound') changed.push({ kind: 'new', app, e: firstEvent.get(app.folder), ghostSince: ghosted.get(app.folder) });
    else if (!app.isNew && was !== now) changed.push({ kind: 'status', app, was, e, ghostSince: ghosted.get(app.folder) });
    else if (!app.isNew && e) changed.push({ kind: 'heard', app, e });
  }
  const order = { status: 0, new: 1, heard: 2 };
  changed.sort((a, b) => order[a.kind] - order[b.kind] || name(a.app).localeCompare(name(b.app)));

  const text = renderReport({
    today, window, input, apps, log, changed, floor,
    counts: { matched: matched.size, created: apps.filter((a) => a.isNew).length },
  });
  const path = reportPath(paths.reports, today);
  const touched = apps.filter((a) => a.isNew || Object.keys(a.updates).length || a.notes.length);
  if (!dryRun) {
    for (const app of touched) {
      if (app.isNew) {
        mkdirSync(join(paths.applications, app.folder), { recursive: true });
        writeFileSync(app.file, appendNotes(newRecord(app.fields), app.notes));
      } else {
        writeFileSync(app.file, appendNotes(updateFrontmatter(app.text, app.updates), app.notes));
      }
    }
    mkdirSync(paths.reports, { recursive: true });
    writeFileSync(path, text);
  }
  return { text, path, touched: touched.map((a) => ({ folder: a.folder, isNew: !!a.isNew })) };
}

// ---- the report ----

const cell = (s) => String(s || '–').replaceAll('|', '\\|');

export function renderReport({ today, window, input, apps, log, changed, counts }) {
  const fmt = (d) => formatDate(d, today);
  const bold = (app) => `**${name(app)}**`;
  const section = (title, lines) => `## ${title}\n\n${lines.length ? lines.join('\n') : 'Nothing.'}\n`;

  const scope = window.firstRun ? ` (first run: the last ${FIRST_RUN_MONTHS} months)` : '';
  const tallies = [
    input.threads != null && `${input.threads} job threads read`,
    `mail matched to ${counts.matched} Applications`,
    `${counts.created} new`,
    `${log.unmatched.length} unmatched`,
    input.skipped && `${input.skipped} job alerts and newsletters skipped`,
  ].filter(Boolean).join(', ');
  const summary = `${tallies[0].toUpperCase()}${tallies.slice(1)}`;

  const needsYou = [`- **Check spam by hand** for recruiter mail since ${fmt(window.since)}: the Gmail connector can't read the spam folder.`];
  // Inbound over a month old (a first run's backlog) shares one line, so fresh ones stand out.
  const stale = [];
  for (const { app, item, flags } of log.inbound) {
    if (daysBetween(item.date, today) > STALE_INBOUND_DAYS) { stale.push(app); continue; }
    const details = [item.pay_range || 'pay not posted', item.location || 'location not given', ...flags.filter((f) => f !== 'pay unknown')];
    needsYou.push(`- **Inbound: ${name(app)}**${item.from ? ` from ${item.from}` : ''} (${fmt(item.date)}): ${details.join('; ')}. Generate a resume, or pass?`);
  }
  for (const app of apps) {
    if (app.isNew || app.fields.status !== 'inbound') continue;
    if (daysBetween(app.fields.created, today) > STALE_INBOUND_DAYS) { stale.push(app); continue; }
    needsYou.push(`- **Inbound: ${name(app)}** (since ${fmt(app.fields.created)}): still waiting on you. Generate a resume, or pass?`);
  }
  if (stale.length) {
    const dates = stale.map((a) => a.fields.created).sort();
    const span = dates[0] === dates.at(-1) ? fmt(dates[0]) : `${fmt(dates[0])} to ${fmt(dates.at(-1))}`;
    needsYou.push(`- **${stale.length} older Inbound** (${span}), over ${STALE_INBOUND_DAYS} days old: ${stale.map(name).join('; ')}. Pass on all of them, or name any to pursue?`);
  }
  // An action counts while its mail is news and the Application is still open; the newest one per Application.
  const actions = new Map();
  for (const n of log.needsYou) {
    if (n.date < (n.app.heardBefore ?? '') || !OPEN.includes(n.app.fields.status)) continue;
    if (!actions.has(n.app) || n.date >= actions.get(n.app).date) actions.set(n.app, n);
  }
  for (const { app, text, date } of actions.values()) needsYou.push(`- ${bold(app)} (${app.fields.status}): ${text} (${fmt(date)}).`);
  for (const c of changed) {
    if (c.app.fields.status === 'offer' && !actions.has(c.app)) {
      needsYou.push(`- ${bold(c.app)}: an offer arrived (${fmt(c.e?.date)}). It needs your answer.`);
    }
  }
  for (const { app, e } of log.conflicts) {
    needsYou.push(`- ${bold(app)} is ${app.fields.status}, but ${e.evidence} (${fmt(e.date)}) reads as ${e.type}. A new Application, or a correction?`);
  }

  const changedLines = changed.map((c) => {
    if (c.kind === 'new') {
      const tail = c.ghostSince ? `; ghosted, no reply since ${fmt(c.ghostSince)}` : '';
      return `- ${bold(c.app)}: new, ${c.e.type === 'contact' ? 'contact' : c.e.type} (${fmt(c.e.date)}; ${c.e.evidence}${tail}).`;
    }
    if (c.kind === 'heard') return `- ${bold(c.app)}: still ${c.app.fields.status}; new mail ${fmt(c.e.date)} (${c.e.evidence}).`;
    const why = c.ghostSince ? `no reply since ${fmt(c.ghostSince)}` : c.e ? `${fmt(c.e.date)}; ${c.e.evidence}` : 'set by hand';
    return `- ${bold(c.app)}: ${c.was} → ${c.app.fields.status} (${why}).`;
  });

  const open = apps
    .filter((a) => OPEN.includes(a.fields.status))
    .sort((a, b) => RANK[b.fields.status] - RANK[a.fields.status] || heardFrom(b.fields).localeCompare(heardFrom(a.fields)));
  const pipeline = [];
  if (open.length) {
    pipeline.push('| Company | Role | Status | Applied | Last heard |', '|---|---|---|---|---|');
    for (const a of open) {
      const heard = a.fields.last_contact ? `${fmt(a.fields.last_contact)} (${daysBetween(a.fields.last_contact, today)}d)` : '–';
      pipeline.push(`| ${cell(a.fields.company)} | ${cell(a.fields.role)} | ${a.fields.status} | ${fmt(a.fields.applied)} | ${heard} |`);
    }
  } else {
    pipeline.push('No open Applications.');
  }
  const closed = ['ghosted', 'rejected', 'withdrawn', 'passed']
    .map((s) => [s, apps.filter((a) => a.fields.status === s).length])
    .filter(([, n]) => n)
    .map(([s, n]) => `${n} ${s}`);
  if (closed.length) pipeline.push('', `Closed: ${closed.join(', ')}.`);

  const quiet = [];
  for (const app of open) {
    const q = quietNote(app.fields, today);
    if (!q) continue;
    if (q.status === 'applied') quiet.push(`- ${bold(app)}: applied ${fmt(app.fields.applied || q.since)}, no reply in ${q.days} days. Ghosted on ${fmt(q.ghostOn)} unless they write.`);
    else if (q.status === 'drafted') quiet.push(`- ${bold(app)}: drafted ${fmt(q.since)}, no confirmation in ${q.days} days. If you applied, say so and it's marked applied.`);
    else quiet.push(`- ${bold(app)} (${q.status}): last heard ${fmt(q.since)}, ${q.days} days ago.`);
  }

  const screenedOut = log.screenedOut.map((s) => `- **${[s.company, s.role].filter(Boolean).join(', ')}**${s.from ? ` from ${s.from}` : ''} (${fmt(s.date)}): ${s.reasons.join('; ')}.`);
  const unmatched = log.unmatched.map((u) => `- ${u.evidence}${u.date ? ` (${fmt(u.date)})` : ''}${u.why ? `: ${u.why}` : ''}.`);

  return [
    `# Status report: ${formatDate(today)}\n`,
    `Mail read from ${fmt(window.since)} to ${fmt(window.until)}${scope}. ${summary}.\n`,
    section('1. Needs you', needsYou),
    section('2. Changed', changedLines),
    section('3. Pipeline table', pipeline),
    section('4. Going quiet', quiet),
    section('5. Screened out', screenedOut),
    section('6. Unmatched', unmatched),
  ].join('\n');
}

// ---- the candidate's own word ----

export function setStatus({ paths, folder, status, date, note }) {
  if (!STATUSES.includes(status)) throw new InputError(`status must be one of ${STATUSES.join(', ')}`);
  if (!DATE.test(date)) throw new InputError('date must be YYYY-MM-DD');
  const app = loadApplications(paths.applications).find((a) => a.folder === folder);
  if (!app) throw new InputError(`no Application folder "${folder}"`);
  const before = app.fields.status;
  const updates = { status };
  if (status === 'applied' && !app.fields.applied) updates.applied = date;
  if (before === 'offer' && status === 'withdrawn' && !app.fields.outcome) updates.outcome = 'offer-declined';
  const line = `${date}: ${before} → ${status}, on the candidate's word${note ? `: ${note}` : ''}.`;
  writeFileSync(app.file, appendNotes(updateFrontmatter(app.text, updates), [line]));
  return { before, status };
}

// ---- CLI ----

function rebuildIndex(paths) {
  const { csv, problems } = buildIndex(paths.applications);
  if (problems.length) {
    for (const problem of problems) console.error(`index not rebuilt: ${problem}`);
    return false;
  }
  writeFileSync(paths.index, csv);
  return true;
}

function option(args, flag) {
  const i = args.indexOf(flag);
  if (i === -1) return undefined;
  const value = args[i + 1];
  if (value === undefined || value.startsWith('--')) throw new InputError(`${flag} needs a value`);
  args.splice(i, 2);
  return value;
}

function main(argv) {
  const args = [...argv];
  const today = option(args, '--today') ?? localToday();
  const dryRun = args.includes('--dry-run');
  if (dryRun) args.splice(args.indexOf('--dry-run'), 1);
  const date = option(args, '--date') ?? today;
  const note = option(args, '--note');
  const [command, ...rest] = args;
  if (!DATE.test(today)) throw new InputError('--today must be YYYY-MM-DD');
  const { paths } = loadConfig();

  if (command === 'window') {
    console.log(JSON.stringify(mailWindow(paths.reports, today), null, 2));
  } else if (command === 'apps') {
    for (const a of loadApplications(paths.applications)) {
      const f = a.fields;
      console.log([a.folder, f.company, f.role || '(role not named)', f.status, f.applied || '-', f.last_contact || '-'].join(' | '));
    }
  } else if (command === 'run') {
    if (!rest[0]) throw new InputError('usage: check-status.mjs run <input.json> [--today D] [--dry-run]');
    let input;
    try {
      input = JSON.parse(readFileSync(rest[0], 'utf8'));
    } catch (err) {
      throw new InputError(`${rest[0]}: ${err.message}`);
    }
    const { text, path, touched } = run({ paths, input, today, dryRun });
    console.log(text);
    const created = touched.filter((t) => t.isNew).length;
    const summary = `${touched.length - created} Applications updated, ${created} created`;
    if (dryRun) {
      console.error(`Dry run, nothing written. Would write ${path}; ${summary}.`);
      for (const t of touched) console.error(`  ${t.isNew ? 'create' : 'update'} ${t.folder}`);
    } else {
      const indexed = rebuildIndex(paths);
      console.error(`Wrote ${path}; ${summary}${indexed ? '; index rebuilt' : ''}.`);
    }
  } else if (command === 'set') {
    const [folder, status] = rest;
    if (!folder || !status) throw new InputError('usage: check-status.mjs set <folder> <status> [--date D] [--note text]');
    const { before } = setStatus({ paths, folder, status, date, note });
    rebuildIndex(paths);
    console.log(`${folder}: ${before} → ${status}.`);
  } else {
    throw new InputError('usage: check-status.mjs window | apps | run <input.json> | set <folder> <status>');
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (err) {
    if (err instanceof ConfigError) { console.error(err.message); process.exit(2); }
    if (err instanceof InputError) { console.error(err.message); process.exit(1); }
    throw err;
  }
}
