import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { ConfigError, loadConfig } from '../scripts/config.mjs';

const made = [];
const temp = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
};

afterEach(() => {
  while (made.length) rmSync(made.pop(), { recursive: true, force: true });
});

test('JOB_SEARCH_DATA_DIR wins over the config file', () => {
  const data = temp('data-');
  const config = loadConfig({ env: { JOB_SEARCH_DATA_DIR: data }, configPath: '/nonexistent.json' });
  assert.equal(config.dataDir, data);
  assert.equal(config.paths.superResume, join(data, 'super-resume.md'));
});

test('the config file supplies dataDir', () => {
  const data = temp('data-');
  const configPath = join(temp('config-'), 'config.json');
  writeFileSync(configPath, JSON.stringify({ dataDir: data }));
  assert.equal(loadConfig({ env: {}, configPath }).dataDir, data);
});

test('~ expands to the home directory', () => {
  const configPath = join(temp('config-'), 'config.json');
  writeFileSync(configPath, JSON.stringify({ dataDir: '~' }));
  assert.equal(loadConfig({ env: {}, configPath }).dataDir, homedir());
});

test('nothing configured is a ConfigError that explains the setup', () => {
  assert.throws(() => loadConfig({ env: {}, configPath: '/nonexistent.json' }), (err) => {
    assert.ok(err instanceof ConfigError);
    assert.match(err.message, /JOB_SEARCH_DATA_DIR/);
    return true;
  });
});

test('a data folder that does not exist is a ConfigError', () => {
  assert.throws(() => loadConfig({ env: { JOB_SEARCH_DATA_DIR: '/no/such/folder' } }), ConfigError);
});
