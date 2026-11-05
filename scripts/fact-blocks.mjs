#!/usr/bin/env node
// Parses and validates the fact blocks in a Super Resume (see skills/update-super-resume/fact-blocks.md).
// Usage: node scripts/fact-blocks.mjs [file]  (default: the configured data folder's super-resume.md)
// Prints one line per entry, then any problems. Exit codes: 0 valid, 1 problems found, 2 not set up.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig } from './config.mjs';

export const KINDS = {
  employer: ['name', 'title', 'type', 'dates', 'weight'],
  engagement: ['name', 'employer', 'role', 'dates', 'weight'],
  project: ['name', 'status', 'dates', 'weight'],
  education: ['name', 'credential', 'dates'],
};
const KNOWN = new Set(['kind', 'name', 'employer', 'title', 'type', 'role', 'credential', 'status', 'link', 'domain', 'dates', 'weight', 'evidence']);
export const WEIGHTS = ['lead', 'support', 'archive'];

// "2025-01..2025-05, 2025-09..present" -> [{ start: '2025-01', end: '2025-05' }, { start: '2025-09', end: 'present' }]
export function parseDates(text) {
  const intervals = [];
  for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
    const year = /^(\d{4})$/.exec(part);
    if (year) {
      intervals.push({ start: `${year[1]}-01`, end: `${year[1]}-12` });
      continue;
    }
    const range = /^(\d{4}-(0[1-9]|1[0-2]))\.\.(\d{4}-(0[1-9]|1[0-2])|present)$/.exec(part);
    if (!range) return null;
    if (range[3] !== 'present' && range[3] < range[1]) return null;
    intervals.push({ start: range[1], end: range[3] });
  }
  return intervals.length ? intervals : null;
}

export function parseFactBlocks(markdown) {
  const entries = [];
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  let heading = '';
  for (let i = 0; i < lines.length; i += 1) {
    if (/^#{1,6} /.test(lines[i])) heading = lines[i].replace(/^#+ /, '').trim();
    if (lines[i].trim() !== '```facts') continue;
    const start = i + 1;
    const fields = {};
    for (i += 1; i < lines.length && lines[i].trim() !== '```'; i += 1) {
      const sep = lines[i].indexOf(':');
      if (sep > 0) fields[lines[i].slice(0, sep).trim()] = lines[i].slice(sep + 1).trim();
    }
    entries.push({ ...fields, heading, line: start, closed: i < lines.length });
  }
  return entries;
}

export function validate(entries) {
  const problems = [];
  const warnings = [];
  const at = (e) => `line ${e.line} (${e.name || e.heading || 'unnamed'})`;
  const employers = new Set(entries.filter((e) => e.kind === 'employer').map((e) => e.name));
  const seen = new Set();
  for (const e of entries) {
    if (!e.closed) problems.push(`${at(e)}: fact block is never closed with \`\`\``);
    const required = KINDS[e.kind];
    if (!required) {
      problems.push(`${at(e)}: kind must be one of ${Object.keys(KINDS).join(', ')}`);
      continue;
    }
    for (const key of required) if (!e[key]) problems.push(`${at(e)}: ${e.kind} needs \`${key}\``);
    if (e.dates && !parseDates(e.dates)) problems.push(`${at(e)}: dates "${e.dates}" should be YYYY-MM..YYYY-MM (or ..present, or YYYY), comma-separated, start before end`);
    if (e.weight && !WEIGHTS.includes(e.weight)) problems.push(`${at(e)}: weight must be lead, support or archive`);
    if (e.kind === 'engagement' && e.employer && !employers.has(e.employer)) problems.push(`${at(e)}: employer "${e.employer}" has no employer block`);
    const key = `${e.kind}:${e.name}`;
    if (seen.has(key)) problems.push(`${at(e)}: a second ${e.kind} block named "${e.name}"`);
    seen.add(key);
    for (const k of Object.keys(e)) if (!KNOWN.has(k) && !['heading', 'line', 'closed'].includes(k)) warnings.push(`${at(e)}: unknown key \`${k}\``);
  }
  return { problems, warnings };
}

const monthIndex = (ym, today) => {
  const [y, m] = (ym === 'present' ? today : ym).split('-').map(Number);
  return y * 12 + (m - 1);
};

// Months covered by the union of the intervals: overlapping work counts once.
export function monthsCovered(entries, today = new Date().toISOString().slice(0, 7)) {
  const covered = new Set();
  for (const e of entries) {
    for (const { start, end } of parseDates(e.dates ?? '') ?? []) {
      for (let m = monthIndex(start, today); m <= monthIndex(end, today); m += 1) covered.add(m);
    }
  }
  return covered.size;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let file = process.argv[2];
  if (!file) {
    try {
      file = loadConfig().paths.superResume;
    } catch (err) {
      if (!(err instanceof ConfigError)) throw err;
      console.error(err.message);
      process.exit(2);
    }
  }
  if (!existsSync(file)) {
    console.error(`No Super Resume at ${file}.`);
    process.exit(2);
  }
  const entries = parseFactBlocks(readFileSync(file, 'utf8'));
  for (const e of entries) console.log(`${(e.kind ?? '?').padEnd(10)} ${(e.weight ?? '').padEnd(7)} ${(e.dates ?? '').padEnd(34)} ${e.name ?? e.heading}`);
  const { problems, warnings } = validate(entries);
  for (const w of warnings) console.error(`warning: ${w}`);
  for (const p of problems) console.error(`error: ${p}`);
  const work = entries.filter((e) => e.kind === 'employer');
  console.log(`\n${entries.length} fact blocks; ${Math.round(monthsCovered(work) / 12 * 10) / 10} years of employment (overlaps counted once).`);
  process.exit(problems.length ? 1 : 0);
}
