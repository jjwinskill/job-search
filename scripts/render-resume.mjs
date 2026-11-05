#!/usr/bin/env node
// Renders a Generated Resume's Markdown source to PDF with local Chrome, then checks the PDF a reader and a parser get:
// the page count, where each page starts and ends, how full the last page is, and that every line is in the text layer.
// Usage: node scripts/render-resume.mjs <resume.md> [--out <resume.pdf>] [--text <resume.txt>] [--png <page1.png>]
//        [--max-pages 2] [--json]
// --out defaults to resume.pdf beside the source. --text saves the extracted text, --png an image of page 1.
// Exit codes: 0 rendered and checked, 1 the source or the rendered PDF has a problem, 2 not set up or bad usage.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ResumeFormatError, parseResume, plain, templateVersion, toHtml } from './resume-md.mjs';

// US Letter with the template's 0.65in margins, in PDF points (Ghostscript measures y from the top).
const PAGE = { top: 46.8, bottom: 792 - 46.8 };

const CHROME_APPS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
];
const CHROME_COMMANDS = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'];

export class SetupError extends Error {}

function onPath(command, env = process.env) {
  for (const dir of (env.PATH ?? '').split(delimiter).filter(Boolean)) {
    const candidate = join(dir, command);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

export function findChrome(env = process.env) {
  if (env.CHROME_PATH) {
    if (!existsSync(env.CHROME_PATH)) throw new SetupError(`CHROME_PATH is set to ${env.CHROME_PATH}, which doesn't exist.`);
    return env.CHROME_PATH;
  }
  const found = CHROME_APPS.find((p) => existsSync(p)) ?? CHROME_COMMANDS.map((c) => onPath(c, env)).find(Boolean);
  if (!found) throw new SetupError('No Chrome, Chromium, Edge or Brave found. Install one, or set CHROME_PATH to its executable.');
  return found;
}

// Chrome writes one `/Type /Page` object per page (the tree's root is `/Type /Pages`).
export function pageCount(pdf) {
  return (pdf.toString('latin1').match(/\/Type\s*\/Page(?![A-Za-z])/g) ?? []).length;
}

// Ghostscript's XML text output: the lowest text baseline on each page, in points from the top.
export function lowestTextPerPage(xml) {
  return xml.split('<page>').slice(1).map((page) => {
    let lowest = 0;
    for (const [, y] of page.matchAll(/<span bbox="[\d.-]+ ([\d.-]+) /g)) lowest = Math.max(lowest, Number(y));
    return lowest;
  });
}

const squash = (s) => s.replace(/\s+/g, ' ').trim();

// Every line the source prints, as plain text, for checking the PDF's text layer.
export function expectedLines(resume) {
  const lines = [resume.name, resume.headline, ...resume.contact.flatMap((c) => c.split(/\s+\|\s+/))];
  const blocks = (list) => list.flatMap((b) => (b.type === 'p' ? [b.text] : b.items));
  for (const s of resume.sections) {
    lines.push(s.title, ...blocks(s.intro));
    for (const e of s.entries) {
      if (e.head) lines.push(...e.head.parts, e.head.dates);
      lines.push(...blocks(e.intro), ...blocks(e.after));
      for (const sub of e.subs) lines.push(sub.head, ...blocks(sub.blocks));
    }
  }
  return lines.filter(Boolean).map((l) => squash(plain(l)));
}

// Headings print upper-case, date ranges print with a plain hyphen, and a line may wrap after a hyphen or slash,
// so compare case-blind with those differences evened out.
const norm = (s) => squash(s).toLowerCase()
  .replace(/\s*[-–—]\s*(?=(\w{3} )?\d{4}\b|present\b)/g, ' - ')
  .replace(/(\w[-/]) (?=\w)/g, '$1');

export function findMissing(resume, text) {
  const haystack = norm(text);
  return expectedLines(resume).filter((line) => !haystack.includes(norm(line)));
}

function firstExperience(resume) {
  const section = resume.sections.find((s) => /experience/i.test(s.title) && s.entries.length);
  const entry = section?.entries[0];
  if (!entry?.head) return null;
  return { employer: plain(entry.head.parts[0]), client: entry.subs[0] ? squash(plain(entry.subs[0].head)) : null };
}

export function analyze({ resume, pages, lowest = [], maxPages }) {
  const problems = [];
  const warnings = [];
  const pageLines = pages.map((p) => p.split('\n').map(squash).filter(Boolean));
  const report = {
    pages: pages.length,
    maxPages,
    breaks: pageLines.map((lines, i) => ({
      page: i + 1,
      starts: lines.slice(0, 2),
      ends: lines.slice(-2),
      filled: lowest[i] ? Math.min(100, Math.round(((lowest[i] - PAGE.top) / (PAGE.bottom - PAGE.top)) * 100)) : null,
    })),
  };
  if (pages.length > maxPages) problems.push(`${pages.length} pages; the limit is ${maxPages}. Cut the weakest material until it fits (never the type size or margins).`);
  const last = report.breaks.at(-1);
  if (pages.length > 1 && last?.filled != null && last.filled < 25) {
    warnings.push(`page ${last.page} holds only a few lines (${last.filled}% full): cut them to save a page, or use the room for strengths the JD wants.`);
  } else if (pages.length > 1 && last?.filled != null && last.filled < 60) {
    warnings.push(`page ${last.page} is ${last.filled}% full: there's room for more of what the JD asks for.`);
  }
  const first = firstExperience(resume);
  if (first && pageLines[0]) {
    const page1 = pageLines[0].join(' ').toLowerCase();
    if (!page1.includes(first.employer.toLowerCase())) warnings.push(`page 1 doesn't reach the first employer, ${first.employer}.`);
    else if (first.client && !page1.includes(first.client.toLowerCase().slice(0, 40))) warnings.push(`page 1 ends before the first client under ${first.employer} (${first.client}).`);
  }
  const missing = findMissing(resume, pages.join('\n'));
  if (missing.length) problems.push(`the PDF's text layer is missing ${missing.length} line(s) a parser should read:\n${missing.map((m) => `    ${m}`).join('\n')}`);
  report.textLayer = { checked: expectedLines(resume).length, missing };
  return { report, problems, warnings };
}

function run(command, args, what) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 120000 });
  if (result.error || result.status !== 0) throw new Error(`${what} failed: ${result.error?.message ?? result.stderr.trim().split('\n').slice(-3).join(' ')}`);
  return result;
}

export function printPdf(html, out, { chrome = findChrome(), work }) {
  const page = join(work, 'resume.html');
  writeFileSync(page, html);
  // A throwaway profile keeps this away from any Chrome the user has open.
  run(chrome, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--no-pdf-header-footer',
    `--user-data-dir=${join(work, 'profile')}`, `--print-to-pdf=${out}`, pathToFileURL(page).href], 'Chrome');
  if (!existsSync(out)) throw new Error(`Chrome exited without writing ${out}.`);
}

// Per-page text and the lowest baseline on each page, from Ghostscript. Null when it isn't installed.
export function extractText(pdf, work, gs = onPath('gs')) {
  if (!gs) return null;
  run(gs, ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=txtwrite', `-sOutputFile=${join(work, 'page-%d.txt')}`, pdf], 'Ghostscript text extraction');
  const files = readdirSync(work).filter((f) => /^page-\d+\.txt$/.test(f)).sort((a, b) => Number(a.match(/\d+/)) - Number(b.match(/\d+/)));
  const pages = files.map((f) => readFileSync(join(work, f), 'utf8'));
  const xml = run(gs, ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=txtwrite', '-dTextFormat=0', '-sOutputFile=-', pdf], 'Ghostscript layout').stdout;
  return { pages, lowest: lowestTextPerPage(xml) };
}

export function pageImage(pdf, png, gs = onPath('gs')) {
  if (gs) {
    run(gs, ['-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=png16m', '-r110', '-dFirstPage=1', '-dLastPage=1', `-sOutputFile=${png}`, pdf], 'Ghostscript page image');
  } else if (process.platform === 'darwin') {
    run('sips', ['-s', 'format', 'png', pdf, '--out', png], 'sips page image');
  } else {
    throw new SetupError('Install Ghostscript to make page images.');
  }
}

function formatReport({ report, problems, warnings }, out, version) {
  const lines = [`Rendered ${out}: ${report.pages} page${report.pages === 1 ? '' : 's'} (limit ${report.maxPages}), template ${version}.`];
  for (const b of report.breaks) {
    lines.push(`  page ${b.page}${b.filled == null ? '' : ` (${b.filled}% full)`}: starts "${b.starts.join(' / ')}"; ends "${b.ends.join(' / ')}"`);
  }
  if (report.textLayer) lines.push(`  text layer: ${report.textLayer.checked - report.textLayer.missing.length} of ${report.textLayer.checked} lines found`);
  for (const w of warnings) lines.push(`warning: ${w}`);
  for (const p of problems) lines.push(`error: ${p}`);
  return lines.join('\n');
}

export function parseArgs(argv) {
  const opts = { maxPages: 2, json: false };
  const named = { '--out': 'out', '--text': 'text', '--png': 'png', '--max-pages': 'maxPages' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') opts.json = true;
    else if (named[arg]) {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) return null;
      opts[named[arg]] = argv[(i += 1)];
    } else if (arg.startsWith('--') || opts.source) return null;
    else opts.source = arg;
  }
  opts.maxPages = Number(opts.maxPages);
  if (!opts.source || !Number.isInteger(opts.maxPages) || opts.maxPages < 1) return null;
  return opts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) {
    console.error('Usage: node scripts/render-resume.mjs <resume.md> [--out <resume.pdf>] [--text <resume.txt>] [--png <page1.png>] [--max-pages 2] [--json]');
    process.exit(2);
  }
  const source = resolve(opts.source);
  if (!existsSync(source)) {
    console.error(`No resume source at ${source}.`);
    process.exit(2);
  }
  const out = resolve(opts.out ?? join(dirname(source), 'resume.pdf'));
  let resume;
  try {
    resume = parseResume(readFileSync(source, 'utf8'));
  } catch (err) {
    if (!(err instanceof ResumeFormatError)) throw err;
    console.error(`error: ${source} doesn't follow the resume format (docs/resume-format.md): ${err.message}`);
    process.exit(1);
  }
  const work = mkdtempSync(join(tmpdir(), 'render-resume-'));
  try {
    printPdf(toHtml(resume), out, { chrome: findChrome(), work });
    const pdf = readFileSync(out);
    const extracted = extractText(out, work);
    const version = templateVersion();
    let result;
    if (extracted) {
      result = analyze({ resume, pages: extracted.pages, lowest: extracted.lowest, maxPages: opts.maxPages });
      if (extracted.pages.length !== pageCount(pdf)) result.warnings.push(`Ghostscript read ${extracted.pages.length} pages but the PDF has ${pageCount(pdf)}.`);
      if (opts.text) writeFileSync(resolve(opts.text), extracted.pages.map((p, i) => `--- page ${i + 1} ---\n${p.trimEnd()}\n`).join('\n'));
    } else {
      const pages = pageCount(pdf);
      result = { report: { pages, maxPages: opts.maxPages, breaks: [] }, problems: [], warnings: ['Ghostscript (gs) is not installed, so only the page count was checked. Install it (brew install ghostscript) to check page breaks and the text layer.'] };
      if (pages > opts.maxPages) result.problems.push(`${pages} pages; the limit is ${opts.maxPages}. Cut the weakest material until it fits (never the type size or margins).`);
      if (opts.text) result.warnings.push('--text needs Ghostscript; no text file was written.');
    }
    if (opts.png) pageImage(out, resolve(opts.png));
    console.log(opts.json ? JSON.stringify({ out, template: version, ...result }, null, 2) : formatReport(result, out, version));
    process.exit(result.problems.length ? 1 : 0);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(err instanceof SetupError ? 2 : 1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
