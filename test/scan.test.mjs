import { strict as assert } from 'node:assert';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const SCAN = fileURLToPath(new URL('../scripts/scan-personal-data.mjs', import.meta.url));
const TERMS = fileURLToPath(new URL('./fixtures/terms.txt', import.meta.url));
const made = [];

function repo(files) {
  const dir = mkdtempSync(join(tmpdir(), 'scan-test-'));
  made.push(dir);
  const git = (...args) => execFileSync('git', args, { cwd: dir, env: cleanEnv });
  git('init', '-q');
  git('config', 'user.email', 'test@example.test');
  git('config', 'user.name', 'Test');
  commit(dir, files);
  return dir;
}

function commit(dir, files) {
  for (const [path, text] of Object.entries(files)) writeFileSync(join(dir, path), text);
  execFileSync('git', ['add', '-A'], { cwd: dir, env: cleanEnv });
  execFileSync('git', ['commit', '-q', '-m', 'change'], { cwd: dir, env: cleanEnv });
}

// Drop git's hook variables so tests run inside a pre-commit hook still use their own temp repos.
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));

function run(dir, args, env = {}) {
  return spawnSync('node', [SCAN, ...args], { cwd: dir, encoding: 'utf8', env: { ...cleanEnv, ...env } });
}

afterEach(() => {
  while (made.length) rmSync(made.pop(), { recursive: true, force: true });
});

test('a clean repo passes', () => {
  const dir = repo({ 'README.md': 'A generic plugin.\n' });
  assert.equal(run(dir, ['--terms', TERMS]).status, 0);
});

test('a planted term fails and names the file and line', () => {
  const dir = repo({ 'README.md': 'Line one.\nBuilt for Acme Clientco.\n' });
  const result = run(dir, ['--terms', TERMS]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /README\.md:2: "Acme Clientco"/);
});

test('an untracked file is scanned too, and the count says so', () => {
  const dir = repo({ 'README.md': 'A generic plugin.\n' });
  const clean = run(dir, ['--terms', TERMS]);
  assert.equal(clean.status, 0);
  assert.match(clean.stdout, /1 files in the working tree/);
  writeFileSync(join(dir, 'draft.md'), 'Notes for Acme Clientco.\n');
  const result = run(dir, ['--terms', TERMS]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /draft\.md:1: "Acme Clientco"/);
  assert.match(result.stderr, /2 files in the working tree/);
});

test('a .gitignore\'d file is not scanned', () => {
  const dir = repo({ 'README.md': 'A generic plugin.\n', '.gitignore': 'scratch/\n' });
  execFileSync('mkdir', ['scratch'], { cwd: dir });
  writeFileSync(join(dir, 'scratch', 'notes.md'), 'Acme Clientco\n');
  assert.equal(run(dir, ['--terms', TERMS]).status, 0);
});

test('a hit tells the agent to ask the owner, not to widen the allowlist', () => {
  const dir = repo({ 'README.md': 'Built for Acme Clientco.\n' });
  const { stderr } = run(dir, ['--terms', TERMS]);
  assert.match(stderr, /ask the repo owner/);
  assert.doesNotMatch(stderr, /add a path:text line/);
});

test('--staged scans what would be committed, not the working copy', () => {
  const dir = repo({ 'README.md': 'A generic plugin.\n' });
  writeFileSync(join(dir, 'README.md'), 'Built for Acme Clientco.\n');
  execFileSync('git', ['add', 'README.md'], { cwd: dir, env: cleanEnv });
  writeFileSync(join(dir, 'README.md'), 'Cleaned up but not staged.\n');
  assert.equal(run(dir, ['--terms', TERMS]).status, 0);
  assert.equal(run(dir, ['--terms', TERMS, '--staged']).status, 1);
});

test('a symlinked folder does not crash the scan', () => {
  const dir = repo({ 'README.md': 'A generic plugin.\n' });
  execFileSync('mkdir', ['real'], { cwd: dir });
  execFileSync('ln', ['-s', 'real', 'linked'], { cwd: dir });
  assert.equal(run(dir, ['--terms', TERMS]).status, 0);
});

test('matching ignores case', () => {
  const dir = repo({ 'notes.md': 'contact JANE@EXAMPLE.TEST\n' });
  assert.equal(run(dir, ['--terms', TERMS]).status, 1);
});

test('the allowlist passes a hit only inside the allowed text on that path', () => {
  const dir = repo({
    LICENSE: 'Copyright Jane Placeholder\n',
    '.scan-allow': 'LICENSE:Copyright Jane Placeholder\n',
  });
  assert.equal(run(dir, ['--terms', TERMS]).status, 0);
  commit(dir, { 'README.md': 'By Jane Placeholder\n' });
  assert.equal(run(dir, ['--terms', TERMS]).status, 1);
});

test('a missing terms file fails closed', () => {
  const dir = repo({ 'README.md': 'A generic plugin.\n' });
  const emptyData = mkdtempSync(join(tmpdir(), 'scan-data-'));
  made.push(emptyData);
  const result = run(dir, [], { JOB_SEARCH_DATA_DIR: emptyData });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /No scan terms/);
});

test('--rev scans the committed tree, not the working tree', () => {
  const dir = repo({ 'README.md': 'Built for Acme Clientco.\n' });
  writeFileSync(join(dir, 'README.md'), 'Cleaned up locally but not committed.\n');
  assert.equal(run(dir, ['--terms', TERMS]).status, 0);
  assert.equal(run(dir, ['--terms', TERMS, '--rev', 'HEAD']).status, 1);
});

test('--new-commits catches a term removed again in a later commit', () => {
  const dir = repo({ 'README.md': 'Built for Acme Clientco.\n' });
  commit(dir, { 'README.md': 'A generic plugin.\n' });
  assert.equal(run(dir, ['--terms', TERMS, '--rev', 'HEAD']).status, 0);
  const result = run(dir, ['--terms', TERMS, '--new-commits', 'HEAD']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /commit [0-9a-f]{7}: README\.md:1: "Acme Clientco"/);
});
