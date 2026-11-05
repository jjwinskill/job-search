#!/usr/bin/env node
// Rebuilds <data folder>/applications.csv from every applications/<folder>/application.md frontmatter.
// The CSV is derived: never edit it by hand. Unknown keys become extra columns after the standard ones.
// Exit codes: 0 written, 1 a record is unreadable or missing a required field, 2 not set up.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig } from './config.mjs';

export const STATUSES = [
  'inbound', 'passed', 'drafted', 'applied', 'screening', 'interviewing', 'offer', 'rejected', 'withdrawn', 'ghosted',
];
export const COLUMNS = [
  'folder', 'company', 'role', 'status', 'created', 'applied', 'last_contact',
  'source_url', 'location', 'pay_range', 'super_resume_version',
];
const REQUIRED = ['company', 'role', 'status', 'created'];

// Flat `key: value` frontmatter only. A value may be JSON-quoted when it holds `:` or `#`.
export function parseFrontmatter(text) {
  const match = /^---\n([\s\S]*?)\n---(\n|$)/.exec(text);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const i = line.indexOf(':');
    if (i === -1) continue;
    let value = line.slice(i + 1).trim();
    if (value.startsWith('"')) {
      try {
        value = JSON.parse(value);
      } catch {
        // Leave a malformed quoted value as written rather than drop it.
      }
    } else {
      value = value.replace(/\s+#.*$/, '');
    }
    fields[line.slice(0, i).trim()] = value;
  }
  return fields;
}

const csvCell = (value) => {
  const text = value == null ? '' : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function buildIndex(applicationsDir) {
  const rows = [];
  const problems = [];
  const warnings = [];
  const folders = existsSync(applicationsDir)
    ? readdirSync(applicationsDir).filter((name) => statSync(join(applicationsDir, name)).isDirectory())
    : [];
  for (const folder of folders) {
    const file = join(applicationsDir, folder, 'application.md');
    if (!existsSync(file)) {
      problems.push(`${folder}: no application.md`);
      continue;
    }
    const fields = parseFrontmatter(readFileSync(file, 'utf8'));
    if (!fields) {
      problems.push(`${folder}/application.md: no frontmatter`);
      continue;
    }
    const missing = REQUIRED.filter((key) => !fields[key]);
    if (missing.length) problems.push(`${folder}/application.md: missing ${missing.join(', ')}`);
    if (fields.status && !STATUSES.includes(fields.status)) {
      warnings.push(`${folder}: unknown status "${fields.status}"`);
    }
    rows.push({ folder, ...fields });
  }
  rows.sort((a, b) => (b.created ?? '').localeCompare(a.created ?? '') || a.folder.localeCompare(b.folder));
  const extras = [...new Set(rows.flatMap(Object.keys))].filter((key) => !COLUMNS.includes(key)).sort();
  const header = [...COLUMNS, ...extras];
  const csv = [header, ...rows.map((row) => header.map((key) => row[key]))]
    .map((cells) => cells.map(csvCell).join(','))
    .join('\n');
  return { csv: `${csv}\n`, count: rows.length, problems, warnings };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let paths;
  try {
    ({ paths } = loadConfig());
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(err.message);
    process.exit(2);
  }
  const { csv, count, problems, warnings } = buildIndex(paths.applications);
  for (const warning of warnings) console.error(`warning: ${warning}`);
  if (problems.length) {
    for (const problem of problems) console.error(`error: ${problem}`);
    console.error(`\nIndex not written: fix the ${problems.length} record(s) above.`);
    process.exit(1);
  }
  writeFileSync(paths.index, csv);
  console.log(`Wrote ${count} applications to ${paths.index}.`);
}
