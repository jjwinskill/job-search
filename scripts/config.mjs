#!/usr/bin/env node
// Finds the private data folder the plugin reads and writes.
// JOB_SEARCH_DATA_DIR wins; otherwise ~/.config/job-search/config.json supplies { "dataDir": "..." }.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONFIG_PATH = join(homedir(), '.config', 'job-search', 'config.json');

export class ConfigError extends Error {}

const SETUP_HINT = `Point the plugin at your data folder, either with
  export JOB_SEARCH_DATA_DIR=~/path/to/your/data
or by creating ${CONFIG_PATH} containing
  { "dataDir": "~/path/to/your/data" }`;

const expandHome = (p) => (p === '~' || p.startsWith('~/') ? join(homedir(), p.slice(1)) : p);

export function pathsFor(dataDir) {
  return {
    superResume: join(dataDir, 'super-resume.md'),
    applications: join(dataDir, 'applications'),
    index: join(dataDir, 'applications.csv'),
    lessons: join(dataDir, 'lessons.md'),
    criteria: join(dataDir, 'criteria.md'),
    doNotUse: join(dataDir, 'do-not-use.md'),
    reports: join(dataDir, 'reports'),
    evals: join(dataDir, 'evals'),
    scanTerms: join(dataDir, 'scan-terms.txt'),
  };
}

export function loadConfig({ env = process.env, configPath = CONFIG_PATH } = {}) {
  let raw = env.JOB_SEARCH_DATA_DIR;
  let source = 'JOB_SEARCH_DATA_DIR';
  if (!raw) {
    if (!existsSync(configPath)) throw new ConfigError(`No data folder configured.\n${SETUP_HINT}`);
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (err) {
      throw new ConfigError(`${configPath} is not valid JSON: ${err.message}`);
    }
    raw = parsed.dataDir;
    source = configPath;
    if (typeof raw !== 'string' || raw === '') {
      throw new ConfigError(`${configPath} has no "dataDir" string.\n${SETUP_HINT}`);
    }
  }
  const dataDir = resolve(expandHome(raw));
  if (!existsSync(dataDir) || !statSync(dataDir).isDirectory()) {
    throw new ConfigError(`Data folder ${dataDir} (from ${source}) does not exist.\n${SETUP_HINT}`);
  }
  return { dataDir, source, paths: pathsFor(dataDir) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    console.log(JSON.stringify(loadConfig(), null, 2));
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    console.error(err.message);
    process.exit(2);
  }
}
