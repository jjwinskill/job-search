import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { analyze, findChrome, findMissing, lowestTextPerPage, pageCount, parseArgs } from '../scripts/render-resume.mjs';
import { parseResume } from '../scripts/resume-md.mjs';

const fixture = fileURLToPath(new URL('./fixtures/resume.md', import.meta.url));
const resume = parseResume(readFileSync(fixture, 'utf8'));
const script = fileURLToPath(new URL('../scripts/render-resume.mjs', import.meta.url));

// The text a PDF of the fixture would carry: upper-cased headings, a hyphen in date ranges, a wrap after a hyphen.
const pdfText = readFileSync(fixture, 'utf8')
  .replace(/^#+ /gm, '')
  .replace(/^- /gm, '')
  .replace(/\*\*|\[|\]\([^)]+\)/g, '')
  .replace('Professional Summary', 'PROFESSIONAL SUMMARY')
  .replace('Apr 2016 – Apr 2026', 'Apr 2016 - Apr 2026')
  .replace('from-scratch', 'from-\nscratch');

test('page count comes from the page objects, not the page tree', () => {
  const pdf = Buffer.from('<< /Type /Pages /Count 2 >> << /Type /Page >> << /Type/Page /Parent 1 0 R >>', 'latin1');
  assert.equal(pageCount(pdf), 2);
});

test('the lowest baseline is found per page', () => {
  const xml = '<page>\n<span bbox="53 80 160 80" font="A">\n<span bbox="53 700 160 700" font="A">\n</page>\n<page>\n<span bbox="53 300 9 300" font="A">\n</page>';
  assert.deepEqual(lowestTextPerPage(xml), [700, 300]);
});

test('every source line is found in matching PDF text', () => {
  assert.deepEqual(findMissing(resume, pdfText), []);
  assert.deepEqual(findMissing(resume, pdfText.replace('Shipped a Unity/C# iOS game', 'Shipped a game')), ['Shipped a Unity/C# iOS game to the App Store']);
});

test('the analysis flags overflow, a thin last page, a short page 1 and missing text', () => {
  const two = analyze({ resume, pages: ['JANE DOE\nExample Consultancy\nClient: Client A — Senior Front-End Engineer | Developer tools', pdfText], lowest: [740, 396], maxPages: 2 });
  assert.deepEqual(two.problems, []);
  assert.match(two.warnings.join('\n'), /page 2 is 50% full/);
  assert.equal(two.report.breaks[0].starts[0], 'JANE DOE');

  const three = analyze({ resume, pages: ['JANE DOE\nPROFESSIONAL SUMMARY', 'Example Consultancy', 'Education'], lowest: [740, 740, 90], maxPages: 2 });
  const text = [...three.problems, ...three.warnings].join('\n');
  assert.match(text, /3 pages; the limit is 2/);
  assert.match(text, /page 3 holds only a few lines/);
  assert.match(text, /page 1 doesn't reach the first employer, Example Consultancy/);
  assert.match(text, /text layer is missing/);
});

test('arguments', () => {
  assert.deepEqual(parseArgs(['r.md', '--png', 'p.png', '--max-pages', '3']), { source: 'r.md', png: 'p.png', maxPages: 3, json: false });
  assert.equal(parseArgs([]), null);
  assert.equal(parseArgs(['r.md', '--out']), null);
  assert.equal(parseArgs(['r.md', '--max-pages', 'two']), null);
  assert.equal(parseArgs(['r.md', '--bogus']), null);
});

test('a CHROME_PATH that does not exist is a setup error', () => {
  assert.throws(() => findChrome({ CHROME_PATH: '/nowhere/chrome', PATH: '' }), /doesn't exist/);
});

// End to end with the real browser and Ghostscript, when this machine has them.
const hasChrome = (() => {
  try {
    return Boolean(findChrome());
  } catch {
    return false;
  }
})();
const hasGs = (process.env.PATH ?? '').split(delimiter).some((d) => existsSync(join(d, 'gs')));

test('renders the fixture to a one-page PDF whose text layer has every line', { skip: !(hasChrome && hasGs) && 'needs Chrome and Ghostscript' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'render-test-'));
  try {
    const out = join(dir, 'resume.pdf');
    const result = spawnSync(process.execPath, [script, fixture, '--out', out, '--text', join(dir, 'resume.txt'), '--png', join(dir, 'p1.png'), '--json'], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.report.pages, 1);
    assert.deepEqual(report.report.textLayer.missing, []);
    assert.ok(existsSync(join(dir, 'p1.png')));
    assert.match(readFileSync(join(dir, 'resume.txt'), 'utf8'), /Client: Client A — Senior Front-End Engineer \| Developer tools/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
