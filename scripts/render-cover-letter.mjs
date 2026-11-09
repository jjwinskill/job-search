#!/usr/bin/env node
// Checks a Cover Letter Draft's Markdown source and renders it to a one-page PDF with local Chrome, in the resume's
// header style, plus a plain-text copy for an application form's paste box.
// Usage: node scripts/render-cover-letter.mjs <cover-letter.md> [--out <cover-letter.pdf>] [--text <cover-letter.txt>]
//        [--png <page.png>] [--super-resume <file>] [--resume <resume.md>] [--jd <jd.md>] [--draft <draft.md>] [--json]
// --out defaults to cover-letter.pdf beside the source. --text saves the letter as plain text for a paste box, from the
// greeting to the name. --png saves an image of the page. Sentences shared with the Super Resume (from the config unless
// given), the resume and the JD (resume.md and jd.md beside the letter unless given) are flagged. --draft lists the
// sentences a rewrite kept from the draft it started from.
// Exit codes: 0 rendered and checked, 1 the source or the PDF has a problem, 2 not set up or bad usage.
//
// Source format (skills/draft-cover-letter/letter-rules.md):
//   # Name
//   Optional headline (a line without " | ")
//   Contact line | with | separators
//   (blank line)
//   Optional date line, such as "March 3, 2026"
//   Dear Example Co Hiring Team,
//   One paragraph per line, blank lines between them.
//   Best,
//   Name
// A paragraph's own line breaks are kept, which is how the sign-off puts the name on its own line.
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COPY_RUN, candidateInfo, checkContact, copiedLines } from './check-resume.mjs';
import { ConfigError, loadConfig } from './config.mjs';
import { SetupError, findChrome, pageCount, pageImage, printPdf } from './render-resume.mjs';
import { inline, plain } from './resume-md.mjs';

export const CSS_PATH = fileURLToPath(new URL('../templates/cover-letter.css', import.meta.url));

// Words in the letter's own paragraphs (not the date, greeting or sign-off). A draft aims short, leaving room for what
// the candidate adds (docs: research on cover letters, rules R2 and A4).
export const WORDS = { target: [200, 300], warn: [150, 350] };
export const PARAGRAPH_WORDS = 90;
export const SENTENCE_WORDS = 25;

// Surface tells of template or AI writing, as of model generations through late 2026. Each is weak alone and drifts
// with every model generation, so they warn and never block. Review the lists when the models change.
export const STOCK_PHRASES = [
  'I am writing', "I'm writing", 'I am excited', "I'm excited", 'I am thrilled', "I'm thrilled", 'I am eager', "I'm eager",
  'my name is', 'I hope this finds you well', 'passionate', 'uniquely qualified', 'perfect fit', 'great fit', 'ideal candidate',
  'great asset', 'great addition', 'dream job', 'industry-leading', 'world-class', 'innovative company', 'hit the ground running',
  'at your earliest convenience', 'thank you for your time and consideration', 'I believe I would', 'I am confident', "I'm confident",
];
export const AI_VOCABULARY = /\b(delv\w*|testament|tapestr\w*|underscor\w*|pivotal|crucial|showcas\w*|vibrant|landscape|foster\w*|seamless\w*|meticulous\w*|realm|resonat\w*|dynamic)\b/gi;
export const CONTRAST_TURNS = [
  /\bnot (just|only|merely|simply)\b[^.!?]*\bbut\b/i,
  /\b(isn't|is not|wasn't|was not|aren't|are not)\s+(just\s+)?about\b[^.!?]*\b(it's|it is|it was|they're|but)\b/i,
];
export const TRAILING_PARTICIPLE = /,\s+(ensuring|highlighting|demonstrating|showcasing|underscoring|reflecting|emphasizing|fostering|illustrating)\b/gi;

const MONTHS = 'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';
const DATE_LINE = new RegExp(`^(${MONTHS})\\.? \\d{1,2}, \\d{4}$`, 'i');
const GREETING = /^(Dear|To|Hello|Hi)\b[^.!?]*[,:]$/i;
// A marked spot left for the candidate, such as "[Your opening: ...]". A Markdown link's text isn't one.
const PLACEHOLDER = /\[[^\]]+\](?!\()/g;

export class LetterFormatError extends Error {}

/**
 * cover-letter.md -> { name, headline, contact: [line], paragraphs: [{ lines: [text], kind }] }
 * kind: 'date' | 'greeting' | 'sign-off' | 'body'.
 */
export function parseLetter(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n').map((l) => l.trimEnd());
  const letter = { name: '', headline: '', contact: [], paragraphs: [] };
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i += 1;
  const title = /^# (.+)$/.exec(lines[i] ?? '');
  if (!title) throw new LetterFormatError(`line ${i + 1}: a cover letter starts with "# Name"`);
  letter.name = title[1].trim();
  for (i += 1; i < lines.length && lines[i].trim(); i += 1) {
    if (/\s\|\s/.test(lines[i])) letter.contact.push(lines[i].trim());
    else if (!letter.headline && !letter.contact.length) letter.headline = lines[i].trim();
    else throw new LetterFormatError(`line ${i + 1}: after the name come one optional headline and the contact lines, each with " | " between items\n  ${lines[i]}`);
  }
  let para = null;
  for (; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      para = null;
      continue;
    }
    if (/^#{1,6} /.test(line) || /^\s*([-*+]|\d+\.) /.test(line)) {
      throw new LetterFormatError(`line ${i + 1}: a cover letter is prose, with no headings or bullets\n  ${line}`);
    }
    if (!para) letter.paragraphs.push((para = { lines: [] }));
    para.lines.push(line.trim());
  }
  if (!letter.paragraphs.length) throw new LetterFormatError('the letter has no paragraphs after the contact lines');
  const last = letter.paragraphs.at(-1);
  letter.paragraphs.forEach((p, n) => {
    const text = plain(p.lines.join(' '));
    if (p === last && letter.paragraphs.length > 1 && plain(p.lines.at(-1)).trim() === plain(letter.name)) p.kind = 'sign-off';
    else if (n < 2 && p.lines.length === 1 && DATE_LINE.test(text)) p.kind = 'date';
    else if (n < 3 && p.lines.length === 1 && GREETING.test(text)) p.kind = 'greeting';
    else p.kind = 'body';
  });
  return letter;
}

export const bodyParagraphs = (letter) => letter.paragraphs.filter((p) => p.kind === 'body').map((p) => plain(p.lines.join(' ')));
export const countWords = (text) => (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []).length;
const sentences = (text) => text.split(/(?<=[.!?])\s+(?=[A-Z"“(\[])/u).map((s) => s.trim()).filter(Boolean);
const clip = (s, n = 60) => (s.length > n ? `${s.slice(0, n)}…` : s);
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Problems, warnings and the body's word count.
 * `sources`: [{ name, text }] to flag shared runs against (the Super Resume, the resume, the JD).
 * `draft`: the draft's Markdown, when checking a rewrite; its kept sentences come back in `kept`.
 */
export function checkLetter(letter, { info = null, sources = [], draft = null } = {}) {
  const problems = [];
  const warnings = [];
  checkContact(letter, info, problems);
  const paragraphs = bodyParagraphs(letter);
  const words = paragraphs.reduce((n, p) => n + countWords(p), 0);
  if (!paragraphs.length) problems.push('the letter has no body paragraphs, only a date, greeting or sign-off');
  else if (words > WORDS.warn[1]) warnings.push(`${words} words; aim for ${WORDS.target.join('-')}. Cut the weakest sentence, not the story.`);
  else if (words < WORDS.warn[0]) warnings.push(`${words} words; aim for ${WORDS.target.join('-')}.`);
  if (!letter.paragraphs.some((p) => p.kind === 'greeting')) warnings.push('no greeting line (like "Dear Example Co Hiring Team,")');
  if (!letter.paragraphs.some((p) => p.kind === 'sign-off')) warnings.push(`the letter doesn't end with the name, "${plain(letter.name)}", on its own line`);
  for (const p of paragraphs) {
    const n = countWords(p);
    if (n > PARAGRAPH_WORDS) warnings.push(`a ${n}-word paragraph ("${clip(p, 40)}"); keep each under ${PARAGRAPH_WORDS}`);
    for (const s of sentences(p)) if (countWords(s) > SENTENCE_WORDS) warnings.push(`a ${countWords(s)}-word sentence ("${clip(s, 50)}"); keep each to ${SENTENCE_WORDS} or fewer`);
  }
  const all = letter.paragraphs.map((p) => p.lines.join(' ')).join('\n');
  for (const spot of all.match(PLACEHOLDER) ?? []) warnings.push(`a marked spot is still unfilled: ${spot.length > 70 ? `${spot.slice(0, 70)}…]` : spot}`);
  const prose = paragraphs.join('\n');
  const lower = prose.toLowerCase();
  const stock = STOCK_PHRASES.filter((s) => new RegExp(`(?<![\\p{L}])${escapeRe(s.toLowerCase())}(?![\\p{L}])`, 'u').test(lower));
  if (stock.length) warnings.push(`stock phrasing a reader skims past: ${stock.map((s) => `"${s}"`).join(', ')}`);
  const vocab = [...new Set((prose.match(AI_VOCABULARY) ?? []).map((w) => w.toLowerCase()))];
  if (vocab.length) warnings.push(`words common in AI-written text: ${vocab.map((w) => `"${w}"`).join(', ')}; say it plainly`);
  for (const s of paragraphs.flatMap(sentences)) {
    if (CONTRAST_TURNS.some((re) => re.test(s))) warnings.push(`a "not X but Y" turn ("${clip(s, 50)}"); state the point directly`);
  }
  const trailing = prose.match(TRAILING_PARTICIPLE) ?? [];
  if (trailing.length) warnings.push(`trailing ${trailing.map((t) => `"${t.replace(/^,\s+/, ', ')}…"`).join(', ')} clause${trailing.length === 1 ? '' : 's'}; end the sentence and start a new one`);
  const dashes = (all.match(/—/g) ?? []).length;
  if (dashes > 1) warnings.push(`${dashes} em dashes: use a comma, a colon or a new sentence`);
  for (const source of sources) {
    for (const copy of copiedLines(paragraphs, source.text)) {
      warnings.push(`"${clip(copy.line)}" shares ${copy.length} words in a row with ${source.name} ("${copy.run}"): write it from its plan line`);
    }
  }
  const kept = draft ? copiedLines(paragraphs, bodyParagraphs(parseLetter(draft)).join('\n\n'), COPY_RUN).map((c) => c.run) : [];
  return { problems, warnings, words, kept };
}

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toHtml(letter, css = readFileSync(CSS_PATH, 'utf8')) {
  const out = [`<h1>${inline(letter.name)}</h1>`];
  if (letter.headline) out.push(`<p class="headline">${inline(letter.headline)}</p>`);
  for (const line of letter.contact) out.push(`<p class="contact">${line.split(/\s+\|\s+/).map(inline).join(' &nbsp;|&nbsp; ')}</p>`);
  out.push('<div class="letter">');
  for (const p of letter.paragraphs) out.push(`<p${p.kind === 'body' ? '' : ` class="${p.kind}"`}>${p.lines.map(inline).join('<br>')}</p>`);
  out.push('</div>');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(plain(letter.name))} — Cover Letter</title>
<style>
${css}
</style>
</head>
<body>
${out.join('\n')}
</body>
</html>
`;
}

// The letter for a form's paste box: the form already holds the contact details, so it runs from the greeting to the name.
export function toText(letter) {
  return `${letter.paragraphs.filter((p) => p.kind !== 'date').map((p) => p.lines.map(plain).join('\n')).join('\n\n')}\n`;
}

export function parseArgs(argv) {
  const opts = { json: false };
  const named = { '--out': 'out', '--text': 'text', '--png': 'png', '--super-resume': 'superResume', '--resume': 'resume', '--jd': 'jd', '--draft': 'draft' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') opts.json = true;
    else if (named[arg]) {
      if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) return null;
      opts[named[arg]] = argv[(i += 1)];
    } else if (arg.startsWith('--') || opts.source) return null;
    else opts.source = arg;
  }
  return opts.source ? opts : null;
}

function superResumePath(given) {
  if (given) return given;
  try {
    return loadConfig().paths.superResume;
  } catch (err) {
    if (!(err instanceof ConfigError)) throw err;
    return null;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) {
    console.error('Usage: node scripts/render-cover-letter.mjs <cover-letter.md> [--out <cover-letter.pdf>] [--text <cover-letter.txt>] [--png <page.png>] [--super-resume <file>] [--resume <resume.md>] [--jd <jd.md>] [--draft <draft.md>] [--json]');
    process.exit(2);
  }
  const source = resolve(opts.source);
  for (const file of [source, opts.superResume, opts.resume, opts.jd, opts.draft].filter(Boolean)) {
    if (!existsSync(file)) {
      console.error(`No file at ${file}.`);
      process.exit(2);
    }
  }
  const out = resolve(opts.out ?? join(dirname(source), 'cover-letter.pdf'));
  let letter;
  try {
    letter = parseLetter(readFileSync(source, 'utf8'));
  } catch (err) {
    if (!(err instanceof LetterFormatError)) throw err;
    console.error(`error: ${source} doesn't follow the cover letter format (skills/draft-cover-letter/letter-rules.md): ${err.message}`);
    process.exit(1);
  }
  const setup = [];
  const srFile = superResumePath(opts.superResume);
  const superResume = srFile && existsSync(srFile) ? readFileSync(srFile, 'utf8') : null;
  if (!superResume) setup.push('no Super Resume found, so the contact lines and sentences shared with it went unchecked');
  const beside = (given, name) => given ?? (existsSync(join(dirname(source), name)) ? join(dirname(source), name) : null);
  const sources = [
    superResume && { name: 'the Super Resume', text: superResume },
    beside(opts.resume, 'resume.md') && { name: 'the resume', text: readFileSync(beside(opts.resume, 'resume.md'), 'utf8') },
    beside(opts.jd, 'jd.md') && { name: 'the JD', text: readFileSync(beside(opts.jd, 'jd.md'), 'utf8') },
  ].filter(Boolean);
  let result;
  try {
    result = checkLetter(letter, { info: superResume && candidateInfo(superResume), sources, draft: opts.draft ? readFileSync(opts.draft, 'utf8') : null });
  } catch (err) {
    if (!(err instanceof LetterFormatError)) throw err;
    console.error(`error: the draft at ${opts.draft} doesn't follow the cover letter format: ${err.message}`);
    process.exit(1);
  }
  result.warnings.push(...setup);
  const work = mkdtempSync(join(tmpdir(), 'render-cover-letter-'));
  try {
    printPdf(toHtml(letter), out, { chrome: findChrome(), work });
    const pages = pageCount(readFileSync(out));
    if (pages > 1) result.problems.push(`${pages} pages; a cover letter fits on one. Cut words (never the type size or margins).`);
    if (opts.text) writeFileSync(resolve(opts.text), toText(letter));
    if (opts.png) pageImage(out, resolve(opts.png));
    if (opts.json) console.log(JSON.stringify({ out, pages, ...result }, null, 2));
    else {
      console.log(`Rendered ${out}: ${pages} page${pages === 1 ? '' : 's'}, ${result.words} words (aim for ${WORDS.target.join('-')}).`);
      if (opts.draft) {
        console.log(result.kept.length ? `Kept from the draft (${result.kept.length}):` : 'Kept from the draft: no run of 8 or more words.');
        for (const run of result.kept) console.log(`  "${run}"`);
      }
      for (const w of result.warnings) console.log(`warning: ${w}`);
      for (const p of result.problems) console.log(`error: ${p}`);
    }
    process.exit(result.problems.length ? 1 : 0);
  } catch (err) {
    console.error(`error: ${err.message}`);
    process.exit(err instanceof SetupError ? 2 : 1);
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
