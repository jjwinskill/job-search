#!/usr/bin/env node
// Blocks personal data from reaching this public repo.
// Terms come from the private data folder's scan-terms.txt (or --terms <file>), one per line, # for comments.
// Modes: tracked files in the working tree (default), the tree at --rev <sha>,
// or lines added by --new-commits <sha> that no remote has yet (so history is covered too).
// .scan-allow holds `path:text` pairs; a hit is allowed when it falls inside that text on that path (`*` = any path).
// Exit codes: 0 clean, 1 personal data found, 2 not set up (fails closed).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig } from './config.mjs';

export class SetupError extends Error {}

const git = (cwd, args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });

export function readTerms(file) {
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
}

export function readAllow(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const i = line.indexOf(':');
      return { path: line.slice(0, i), text: line.slice(i + 1).toLowerCase() };
    });
}

function isAllowed(allow, path, lowerLine, start, end) {
  return allow.some((entry) => {
    if (entry.path !== '*' && entry.path !== path) return false;
    for (let at = lowerLine.indexOf(entry.text); at !== -1; at = lowerLine.indexOf(entry.text, at + 1)) {
      if (at <= start && end <= at + entry.text.length) return true;
    }
    return false;
  });
}

export function scanLine({ terms, allow, path, line, lineNo, where }) {
  const lower = line.toLowerCase();
  const hits = [];
  for (const term of terms) {
    const needle = term.toLowerCase();
    for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, at + 1)) {
      if (!isAllowed(allow, path, lower, at, at + needle.length)) {
        hits.push({ where, path, lineNo, term });
        break;
      }
    }
  }
  return hits;
}

// .scan-allow quotes the allowed text, so it is skipped; everything in it is public by definition.
const ALLOW_FILE = '.scan-allow';

function scanText({ text, ...rest }) {
  if (rest.path === ALLOW_FILE || text.includes('\0')) return [];
  return text.split('\n').flatMap((line, i) => scanLine({ ...rest, line, lineNo: i + 1 }));
}

function scanWorkingTree(root, terms, allow) {
  const files = git(root, ['ls-files', '-z']).split('\0').filter(Boolean);
  return files.flatMap((path) => {
    const full = join(root, path);
    if (!existsSync(full)) return [];
    return scanText({ text: readFileSync(full, 'utf8'), terms, allow, path, where: 'working tree' });
  });
}

function scanRev(root, rev, terms, allow) {
  const files = git(root, ['ls-tree', '-r', '-z', '--name-only', rev]).split('\0').filter(Boolean);
  return files.flatMap((path) =>
    scanText({ text: git(root, ['show', `${rev}:${path}`]), terms, allow, path, where: rev.slice(0, 7) }),
  );
}

function scanNewCommits(root, rev, terms, allow) {
  const log = git(root, ['log', '-p', '--unified=0', '--no-color', '--format=commit %H', rev, '--not', '--remotes']);
  const hits = [];
  let commit = '';
  let path = '';
  let lineNo = 0;
  for (const line of log.split('\n')) {
    if (line.startsWith('commit ')) commit = line.slice(7, 14);
    else if (line.startsWith('+++ ')) path = line.startsWith('+++ b/') ? line.slice(6) : '';
    else if (line.startsWith('@@')) lineNo = Number(/\+(\d+)/.exec(line)?.[1] ?? 0);
    else if (line.startsWith('+') && path && path !== ALLOW_FILE) {
      hits.push(...scanLine({ terms, allow, path, line: line.slice(1), lineNo, where: `commit ${commit}` }));
      lineNo += 1;
    }
  }
  return hits;
}

export function scan({ root, termsFile, rev, newCommits }) {
  if (!termsFile) {
    try {
      termsFile = loadConfig().paths.scanTerms;
    } catch (err) {
      if (err instanceof ConfigError) throw new SetupError(err.message);
      throw err;
    }
  }
  if (!existsSync(termsFile)) {
    throw new SetupError(
      `No scan terms at ${termsFile}. Create it with one personal term per line (names, emails, employers, clients) before pushing.`,
    );
  }
  const terms = readTerms(termsFile);
  if (terms.length === 0) throw new SetupError(`${termsFile} has no terms, so the scan would pass everything.`);
  const allow = readAllow(join(root, ALLOW_FILE));
  if (newCommits) return scanNewCommits(root, newCommits, terms, allow);
  if (rev) return scanRev(root, rev, terms, allow);
  return scanWorkingTree(root, terms, allow);
}

function parseArgs(argv) {
  const opts = {};
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--terms') opts.termsFile = argv[++i];
    else if (flag === '--rev') opts.rev = argv[++i];
    else if (flag === '--new-commits') opts.newCommits = argv[++i];
    else throw new SetupError(`Unknown argument: ${flag}`);
  }
  return opts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
    const hits = scan({ root, ...parseArgs(process.argv.slice(2)) });
    for (const hit of hits) console.error(`${hit.where}: ${hit.path}:${hit.lineNo}: "${hit.term}"`);
    if (hits.length > 0) {
      console.error(`\nPersonal data found (${hits.length}). Remove it, or add a path:text line to .scan-allow if it is meant to be public.`);
      process.exit(1);
    }
  } catch (err) {
    if (!(err instanceof SetupError)) throw err;
    console.error(err.message);
    process.exit(2);
  }
}
