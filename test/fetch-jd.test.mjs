import { strict as assert } from 'node:assert';
import { gzipSync } from 'node:zlib';
import { test } from 'node:test';
import { atsApi, extractJobPosting, fetchJd, htmlToMarkdown, pageToJd, toJdFile } from '../scripts/fetch-jd.mjs';

const BODY = `<h2>About the role</h2><p>You will build things.</p><ul><li>Requirements: React</li><li>TypeScript</li></ul>${'<p>Responsibilities include shipping product features end to end with care.</p>'.repeat(20)}`;
const page = (inner) => `<html><head><title>x</title></head><body><nav>Menu</nav><main>${inner}</main><script>evil()</script></body></html>`;
const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
const posting = { '@type': 'JobPosting', title: 'Senior Engineer', hiringOrganization: { name: 'Example Co' }, description: BODY,
  baseSalary: { currency: 'USD', value: { minValue: 150000, maxValue: 190000, unitText: 'YEAR' } } };

// A fake network: url -> { status, body }.
const net = (routes) => async (url) => {
  const hit = routes[url];
  if (!hit) return { status: 404, body: Buffer.from('') };
  return { status: hit.status ?? 200, body: Buffer.isBuffer(hit.body) ? hit.body : Buffer.from(hit.body) };
};

test('htmlToMarkdown keeps structure and drops scripts and navigation', () => {
  const md = htmlToMarkdown('<nav>Menu</nav><h2>Title &amp; more</h2><p>One<br>two</p><ul><li><strong>Bold</strong></li></ul><a href="https://x.test">link</a><script>x()</script>');
  assert.match(md, /^## Title & more/);
  assert.match(md, /One\ntwo/);
  assert.match(md, /- \*\*Bold\*\*/);
  assert.match(md, /\[link\]\(https:\/\/x\.test\)/);
  assert.doesNotMatch(md, /Menu|x\(\)/);
});

test('structured data on the live page wins, with pay and company', async () => {
  const url = 'https://jobs.example.test/1';
  const result = await fetchJd(url, { fetcher: net({ [url]: { body: page(ld(posting)) } }) });
  assert.equal(result.how, 'live page, structured data');
  assert.match(result.markdown, /\*\*Pay:\*\* 150000–190000 USD YEAR/);
  assert.match(toJdFile(url, result, '2026-01-01'), /^# Senior Engineer — Example Co\n- Source URL: https:\/\/jobs\.example\.test\/1\n/);
});

test('a Greenhouse page that is only a shell falls back to the board API', async () => {
  const url = 'https://job-boards.greenhouse.io/exampleco/jobs/123';
  const api = 'https://boards-api.greenhouse.io/v1/boards/exampleco/jobs/123';
  const result = await fetchJd(url, { fetcher: net({ [url]: { body: page('<div id="app"></div>') }, [api]: { body: JSON.stringify({ title: 'Staff Engineer', location: { name: 'Remote' }, content: BODY.replaceAll('<', '&lt;').replaceAll('>', '&gt;') }) } }) });
  assert.equal(result.how, 'Greenhouse API');
  assert.match(result.markdown, /## About the role/);
});

test('a gone posting is recovered from the newest gzipped Wayback snapshot', async () => {
  const url = 'https://jobs.example.test/gone';
  const cdx = `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&filter=statuscode:200&limit=-3`;
  const snap = `https://web.archive.org/web/20260813000000id_/${url}`;
  const result = await fetchJd(url, { fetcher: net({
    [url]: { status: 404, body: '' },
    [cdx]: { body: JSON.stringify([['urlkey', 'timestamp', 'original'], ['k', '20260101000000', url], ['k', '20260813000000', url]]) },
    [snap]: { body: gzipSync(page(ld(posting))) },
  }) });
  assert.equal(result.how, 'Wayback snapshot, structured data');
  assert.equal(result.source, `https://web.archive.org/web/20260813000000/${url}`);
});

test('nothing usable returns what was tried', async () => {
  const url = 'https://jobs.example.test/empty';
  const result = await fetchJd(url, { fetcher: net({ [url]: { body: page('<p>Careers</p>') } }) });
  assert.equal(result.markdown, undefined);
  assert.ok(result.tried.some((t) => t.includes('no recognizable job description')));
  assert.ok(result.tried.some((t) => t.includes('Wayback')));
});

test('atsApi recognizes Greenhouse, Lever and Ashby URLs, and nothing else', () => {
  assert.equal(atsApi('https://boards.greenhouse.io/acme/jobs/9?gh_jid=9').api, 'https://boards-api.greenhouse.io/v1/boards/acme/jobs/9');
  assert.equal(atsApi('https://jobs.lever.co/acme/abc-123').api, 'https://api.lever.co/v0/postings/acme/abc-123');
  assert.equal(atsApi('https://jobs.ashbyhq.com/acme/uuid-1').id, 'uuid-1');
  assert.equal(atsApi('https://careers.example.test/jobs/1'), null);
});

test('extractJobPosting handles @graph and array @type', () => {
  const html = ld({ '@graph': [{ '@type': 'Organization' }, { '@type': ['JobPosting'], title: 'T', description: '<p>d</p>' }] });
  assert.equal(extractJobPosting(html).title, 'T');
});

test('page text starts at the H1 and drops leaked script lines', () => {
  const html = `<body><a href="https://x.test/">Back to jobs</a><p>'),t.close()}();var a=function(){return b(c)};</p><h1>Staff Engineer</h1>${BODY}</body>`;
  const { title, markdown } = pageToJd(html);
  assert.equal(title, 'Staff Engineer');
  assert.match(markdown, /^# Staff Engineer/);
  assert.doesNotMatch(markdown, /Back to jobs|t\.close/);
});

test('the CLI takes the URL as its first argument when there is no --out', async () => {
  const { spawnSync } = await import('node:child_process');
  const { fileURLToPath } = await import('node:url');
  const script = fileURLToPath(new URL('../scripts/fetch-jd.mjs', import.meta.url));
  const result = spawnSync('node', [script], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  const bad = spawnSync('node', [script, '--out'], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
});
