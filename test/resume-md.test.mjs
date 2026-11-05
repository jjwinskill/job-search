import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ResumeFormatError, displayDates, inline, parseResume, plain, splitHead, templateVersion, toHtml } from '../scripts/resume-md.mjs';

const source = readFileSync(new URL('./fixtures/resume.md', import.meta.url), 'utf8');

test('the header holds the name, an optional headline and contact lines', () => {
  const r = parseResume(source);
  assert.equal(r.name, 'Jane Doe');
  assert.equal(r.headline, 'Senior Full-Stack Engineer');
  assert.equal(r.contact.length, 2);
  assert.equal(parseResume('# Jane Doe\nSpringfield, OR | jane@example.com\n').headline, '');
  assert.deepEqual(parseResume('# Jane Doe\njane@example.com\n').contact, ['jane@example.com']);
  const only = parseResume('# J\n## Experience\n### Co | Eng | 2014\nOther clients: A, B\n').sections[0].entries[0];
  assert.deepEqual(only.after, [{ type: 'p', text: 'Other clients: A, B' }]);
});

test('sections nest employers, clients, bullets and the other-clients line', () => {
  const r = parseResume(source);
  assert.deepEqual(r.sections.map((s) => s.title), ['Professional Summary', 'Technical Skills', 'Professional Experience', 'Selected Projects', 'Education']);
  const [consultancy, studio] = r.sections[2].entries;
  assert.deepEqual(consultancy.head, { parts: ['Example Consultancy', 'Senior Software Engineer (Consultant)'], dates: 'Apr 2016 – Apr 2026' });
  assert.equal(consultancy.intro[0].text, 'Software consultancy — full-time, embedded on client product teams.');
  assert.equal(consultancy.subs.length, 2);
  assert.equal(consultancy.subs[0].blocks[0].items[1], 'Led a from-scratch site build under an unplanned deadline and shipped it through the release trains');
  assert.deepEqual(consultancy.after, [{ type: 'p', text: 'Other clients: Client C' }]);
  assert.equal(studio.subs.length, 0);
  assert.equal(studio.intro[0].items.length, 1);
  assert.equal(r.sections[0].intro[0].text, 'Senior full-stack engineer who builds with AI agents every day. Ten years embedded in client product teams through a software consultancy.');
});

test('a malformed source fails with the line number', () => {
  assert.throws(() => parseResume('Jane Doe\n'), ResumeFormatError);
  assert.throws(() => parseResume('# Jane\n#### Client: A\n'), /line 2/);
  assert.throws(() => parseResume('# Jane\n## Skills\n  - indented bullet\n'), /left margin/);
  assert.throws(() => parseResume('# Jane\n## A\n##### deep\n'), /no deeper/);
});

test('heads split off a trailing date range only', () => {
  assert.deepEqual(splitHead('A | B | Feb 2015 - Feb 2016'), { parts: ['A', 'B'], dates: 'Feb 2015 - Feb 2016' });
  assert.deepEqual(splitHead('A | Sep 2026 – Present'), { parts: ['A'], dates: 'Sep 2026 – Present' });
  assert.deepEqual(splitHead('A | 2013 - 2014'), { parts: ['A'], dates: '2013 - 2014' });
  assert.deepEqual(splitHead('A | B'), { parts: ['A', 'B'], dates: '' });
  assert.equal(displayDates('Apr 2016 — Apr 2026'), 'Apr 2016 - Apr 2026');
});

test('inline Markdown: links, bold and italic, everything else escaped', () => {
  assert.equal(inline('**Languages:** TS & <JS>'), '<strong>Languages:</strong> TS &amp; &lt;JS&gt;');
  assert.equal(inline('[site](https://example.com/a_b)'), '<a href="https://example.com/a_b">site</a>');
  assert.equal(inline('an *emphasized* word and snake_case_name'), 'an <em>emphasized</em> word and snake_case_name');
  assert.equal(plain('**Bold** [link](https://x.y) *it*'), 'Bold link it');
});

test('the HTML keeps each heading with its first bullet and prints skill and education items as lines', () => {
  const html = toHtml(parseResume(source), '/* css */');
  assert.match(html, /<title>Jane Doe — Resume<\/title>/);
  assert.match(html, /<div class="entry"><div class="lead"><div class="entry-head">.*Example Consultancy.*<p class="entry-note">.*<div class="sub"><div class="lead"><p class="sub-head"><span class="label">Client:<\/span> <strong>Client A<\/strong>/s);
  assert.match(html, /<p class="line"><strong>Languages:<\/strong> TypeScript/);
  assert.match(html, /<p class="other">Other clients: Client C<\/p>/);
  assert.match(html, /<span class="entry-dates">Apr 2016 - Apr 2026<\/span>/);
  assert.doesNotMatch(html, /<li>Example Bootcamp/);
  assert.match(templateVersion(), /^[0-9a-f]{7}$/);
});
