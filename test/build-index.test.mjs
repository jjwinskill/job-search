import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildIndex, parseFrontmatter } from '../scripts/build-index.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/build-index.mjs', import.meta.url));
const made = [];

function dataDir(apps) {
  const dir = mkdtempSync(join(tmpdir(), 'index-test-'));
  made.push(dir);
  for (const [folder, text] of Object.entries(apps)) {
    mkdirSync(join(dir, 'applications', folder), { recursive: true });
    if (text !== null) writeFileSync(join(dir, 'applications', folder, 'application.md'), text);
  }
  return dir;
}

const record = (fields) => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\nNotes.\n`;
const base = { company: 'Example Co', role: 'Engineer', status: 'applied', created: '2026-01-02' };

afterEach(() => {
  while (made.length) rmSync(made.pop(), { recursive: true, force: true });
});

test('frontmatter: plain values are whole, quoted values may carry a comment, CRLF works', () => {
  const fields = parseFrontmatter('---\r\ncompany: Example Co\r\nrole: Engineer, Team #2\r\nsource_url: "https://x.test/a?b=1"\r\nstatus: "applied" # since May\r\n---\r\nbody');
  assert.deepEqual(fields, { company: 'Example Co', role: 'Engineer, Team #2', source_url: 'https://x.test/a?b=1', status: 'applied' });
});

test('formula-looking cells are neutralized and hidden folders are skipped', () => {
  const dir = dataDir({ a: record({ ...base, role: '=HYPERLINK("x")' }) });
  mkdirSync(join(dir, 'applications', '.obsidian'));
  const { csv, problems } = buildIndex(join(dir, 'applications'));
  assert.deepEqual(problems, []);
  assert.match(csv, /,"'=HYPERLINK\(""x""\)",/);
});

test('rows sort newest first, and extra keys become trailing columns', () => {
  const dir = dataDir({
    'old': record({ ...base, created: '2026-01-01' }),
    'new': record({ ...base, created: '2026-03-01', flavor: 'startup' }),
  });
  const { csv, count, problems } = buildIndex(join(dir, 'applications'));
  assert.equal(count, 2);
  assert.deepEqual(problems, []);
  const lines = csv.trim().split('\n');
  assert.match(lines[0], /^folder,company,role,status,created,.*,super_resume_version,flavor$/);
  assert.match(lines[1], /^new,/);
  assert.match(lines[2], /^old,/);
});

test('cells with commas or quotes are escaped', () => {
  const dir = dataDir({ a: record({ ...base, role: '"Senior, Frontend"' }) });
  const { csv } = buildIndex(join(dir, 'applications'));
  assert.match(csv, /,"Senior, Frontend",/);
});

test('a missing required field or file is a problem; an unknown status is a warning', () => {
  const dir = dataDir({
    'no-file': null,
    'no-role': record({ company: 'X', status: 'applied', created: '2026-01-01' }),
    'odd-status': record({ ...base, status: 'pending' }),
  });
  const { problems, warnings } = buildIndex(join(dir, 'applications'));
  assert.equal(problems.length, 2);
  assert.match(problems.join('\n'), /no-file: no application\.md/);
  assert.match(problems.join('\n'), /no-role\/application\.md: missing role/);
  assert.deepEqual(warnings, ['odd-status: unknown status "pending"']);
});

test('the CLI writes applications.csv, and refuses when a record is broken', () => {
  const dir = dataDir({ good: record(base) });
  const env = { ...process.env, JOB_SEARCH_DATA_DIR: dir };
  const ok = spawnSync('node', [SCRIPT], { env, encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(readFileSync(join(dir, 'applications.csv'), 'utf8'), /^folder,/);
  writeFileSync(join(dir, 'applications', 'good', 'application.md'), 'no frontmatter here');
  const bad = spawnSync('node', [SCRIPT], { env, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /no frontmatter/);
});
