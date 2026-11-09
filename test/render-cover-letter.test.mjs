import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { candidateInfo } from '../scripts/check-resume.mjs';
import { LetterFormatError, WORDS, checkLetter, parseArgs, parseLetter, toHtml, toText } from '../scripts/render-cover-letter.mjs';
import { findChrome } from '../scripts/render-resume.mjs';

const fixture = fileURLToPath(new URL('./fixtures/cover-letter.md', import.meta.url));
const superResumeFile = fileURLToPath(new URL('./fixtures/example-super-resume.md', import.meta.url));
const source = readFileSync(fixture, 'utf8');
const superResume = readFileSync(superResumeFile, 'utf8');
const info = candidateInfo(superResume);
const script = fileURLToPath(new URL('../scripts/render-cover-letter.mjs', import.meta.url));
const check = (md, opts = {}) => checkLetter(parseLetter(md), { info, sources: [{ name: 'the Super Resume', text: superResume }], ...opts });
const warned = (md, opts) => check(md, opts).warnings.join('\n');

test('the header, date, greeting, body and sign-off are told apart', () => {
  const letter = parseLetter(source);
  assert.equal(letter.name, 'Jane Doe');
  assert.equal(letter.headline, '');
  assert.equal(letter.contact.length, 2);
  assert.deepEqual(letter.paragraphs.map((p) => p.kind), ['date', 'greeting', 'body', 'body', 'body', 'body', 'body', 'sign-off']);
  assert.deepEqual(letter.paragraphs.at(-1).lines, ['Best,', 'Jane Doe']);
});

test('a headline may follow the name, and the date is optional', () => {
  const letter = parseLetter(source.replace('# Jane Doe\n', '# Jane Doe\nSenior Full-Stack Engineer\n').replace('March 3, 2026\n\n', ''));
  assert.equal(letter.headline, 'Senior Full-Stack Engineer');
  assert.equal(letter.paragraphs[0].kind, 'greeting');
  assert.deepEqual(checkLetter(letter, { info }).warnings, []);
});

test('the fixture passes with no problems or warnings', () => {
  const { problems, warnings, words } = check(source);
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, []);
  assert.ok(words >= WORDS.target[0] && words <= WORDS.target[1], `${words} words`);
});

test('headings, bullets, a missing name and an empty body are format errors', () => {
  assert.throws(() => parseLetter('Jane Doe\n\nHello.'), LetterFormatError);
  assert.throws(() => parseLetter(`${source}\n## Why me\n`), /no headings or bullets/);
  assert.throws(() => parseLetter(`${source}\n- a bullet\n`), /no headings or bullets/);
  assert.throws(() => parseLetter('# Jane Doe\nSpringfield, OR | jane.doe@example.com\n'), /no paragraphs/);
  assert.throws(() => parseLetter('# Jane Doe\nHeadline\nSecond headline\n\nBody.'), /optional headline/);
});

test('contact lines must match Candidate Info', () => {
  const { problems } = check(source.replace('jane.doe@example.com', 'jane@elsewhere.example'));
  assert.match(problems.join('\n'), /email/);
});

test('length, long paragraphs and long sentences are warnings', () => {
  assert.match(warned(source.replace(/At Client A[^\n]+\n\nAt Client C[^\n]+\n/, '')), /words; aim for 200-300/);
  const padded = source.replace(/(Support stopped hearing[^\n]+)/, '$1 $1 $1 $1');
  assert.match(warned(padded), /-word paragraph \("At Client A/);
  assert.match(warned(source.replace('I traced the retries and made each charge safe to repeat.', 'I traced the retries across three services and two vendors and then made each charge safe to repeat no matter how often the network sent it again.')), /-word sentence \("I traced the retries/);
});

test('an unfilled marked spot is a warning; a link is not a marked spot', () => {
  assert.match(warned(source.replace(/^I've booked[^\n]+/m, '[Your opening: your real reason for wanting Example Co]')), /marked spot is still unfilled: \[Your opening/);
  assert.doesNotMatch(warned(source.replace('Your post', 'Your [post](https://example.com/blog)')), /marked spot/);
});

test('template and AI tells are warnings', () => {
  assert.match(warned(source.replace("I'd like to help build", "I'm excited and passionate to help build")), /stock phrasing.*"I'm excited".*"passionate"/);
  assert.match(warned(source.replace('describes the problems', 'showcases the crucial problems')), /words common in AI-written text: "showcases", "crucial"/);
  assert.match(warned(source.replace('I traced the retries and made each charge safe to repeat.', 'The fix was not just a patch but a change in how charges work.')), /"not X but Y" turn/);
  assert.match(warned(source.replace('safe to repeat.', 'safe to repeat, ensuring no customer paid twice.')), /trailing ", ensuring…" clause/);
  assert.match(warned(source.replace('of the same records.', 'of the same records — and more.').replace('A retry, a race', 'A retry — a race')), /2 em dashes/);
  assert.doesNotMatch(warned(source.replace('of the same records.', 'of the same records — one dash is fine.')), /em dash/);
});

test('a missing sign-off is a warning, not a problem', () => {
  const unsigned = check(source.replace(/Jane Doe\n$/, 'J.\n'));
  assert.match(unsigned.warnings.join('\n'), /doesn't end with the name/);
  assert.equal(unsigned.problems.length, 0);
});

test('sentences shared with a source are flagged, naming the source', () => {
  const jd = 'We want someone who has made each charge safe to repeat and wrote the tests that now run before every release.';
  assert.match(warned(source, { sources: [{ name: 'the JD', text: jd }] }), /shares \d+ words in a row with the JD/);
});

test('a rewrite lists the runs it kept from its draft', () => {
  const rewrite = source.replace(/^I've booked[^\n]+/m, 'Three winters of climbing trips taught me what a good booking app feels like.');
  const { kept } = check(rewrite, { draft: source });
  assert.ok(kept.some((run) => run.startsWith('at client a a developer tools company')), kept.join('\n'));
  assert.ok(!kept.some((run) => run.includes('climbing trip for three years')));
});

test('the HTML keeps a paragraph\'s own line breaks; the paste-box text runs from the greeting to the name', () => {
  const letter = parseLetter(source);
  const html = toHtml(letter, '');
  assert.match(html, /<p class="sign-off">Best,<br>Jane Doe<\/p>/);
  assert.match(html, /<a href="https:\/\/www.linkedin.com\/in\/janedoe-example\/">linkedin.com\/in\/janedoe-example<\/a>/);
  const text = toText(letter);
  assert.match(text, /^Dear Example Co Hiring Team,\n\nI've booked/);
  assert.match(text, /Best,\nJane Doe\n$/);
  assert.doesNotMatch(text, /\]\(|\*\*|March 3, 2026|jane.doe@example.com/);
});

test('arguments', () => {
  assert.deepEqual(parseArgs(['c.md', '--text', 'c.txt', '--super-resume', 's.md', '--draft', 'd.md']), { source: 'c.md', text: 'c.txt', superResume: 's.md', draft: 'd.md', json: false });
  assert.equal(parseArgs([]), null);
  assert.equal(parseArgs(['c.md', '--out']), null);
  assert.equal(parseArgs(['c.md', '--bogus']), null);
});

const hasChrome = (() => {
  try {
    return Boolean(findChrome());
  } catch {
    return false;
  }
})();

test('renders the fixture to a one-page PDF and a paste-box text copy', { skip: !hasChrome && 'needs Chrome' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'letter-test-'));
  try {
    const out = join(dir, 'cover-letter.pdf');
    const result = spawnSync(process.execPath, [script, fixture, '--out', out, '--text', join(dir, 'cover-letter.txt'), '--super-resume', superResumeFile, '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.pages, 1);
    assert.deepEqual(report.problems, []);
    assert.ok(existsSync(out));
    assert.match(readFileSync(join(dir, 'cover-letter.txt'), 'utf8'), /^Dear Example Co Hiring Team,[\s\S]*Best,\nJane Doe\n$/);

    const long = join(dir, 'long.md');
    writeFileSync(long, source.replace(/(At Client A[^\n]+\n)/, '$1\n'.repeat(1) + '$1\n'.repeat(6)));
    const over = spawnSync(process.execPath, [script, long, '--out', join(dir, 'long.pdf'), '--super-resume', superResumeFile, '--json'], { encoding: 'utf8' });
    assert.equal(over.status, 1);
    assert.match(JSON.parse(over.stdout).problems.join('\n'), /pages; a cover letter fits on one/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
