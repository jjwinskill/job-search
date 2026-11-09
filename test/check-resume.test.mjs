import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { candidateInfo, checkForm, checkResume, checkTerms, copiedRuns, copyWarning, factSpan, formatSpan, normalizeDate, parseTerms } from '../scripts/check-resume.mjs';
import { parseFactBlocks } from '../scripts/fact-blocks.mjs';
import { parseResume } from '../scripts/resume-md.mjs';

const superResume = readFileSync(new URL('./fixtures/example-super-resume.md', import.meta.url), 'utf8');
const source = readFileSync(new URL('./fixtures/resume.md', import.meta.url), 'utf8');
const facts = parseFactBlocks(superResume);
const info = candidateInfo(superResume);
const check = (md) => checkResume(parseResume(md), facts, info);

test('fact-block dates print as month-year spans', () => {
  assert.equal(formatSpan(factSpan('2016-04..2026-04')), 'Apr 2016 - Apr 2026');
  assert.equal(formatSpan(factSpan('2016-05..2016-05, 2016-07..2017-03')), 'May 2016 - Mar 2017');
  assert.equal(formatSpan(factSpan('2026-09..present')), 'Sep 2026 - Present');
  assert.equal(formatSpan(factSpan('2013, 2014')), '2013 - 2014');
  assert.equal(formatSpan(factSpan('2014')), '2014');
  assert.equal(normalizeDate('April 2016'), 'Apr 2016');
  assert.equal(normalizeDate('04/2016'), 'Apr 2016');
  assert.equal(normalizeDate('current'), 'Present');
});

test('Candidate Info is read from its list', () => {
  assert.equal(info.name, 'Jane Doe');
  assert.equal(info.github, 'https://github.com/janedoe-example');
  assert.equal(candidateInfo('# No info here'), null);
});

test('a resume that follows its fact blocks passes; an undetailed archived client is fine', () => {
  const { problems, warnings } = check(source);
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, []);
});

test('wrong titles, dates, roles and domains are mismatches', () => {
  const bad = source
    .replace('Senior Software Engineer (Consultant) | Apr 2016 – Apr 2026', 'Staff Engineer | May 2016 - Apr 2026')
    .replace('Client A — Senior Front-End Engineer | Developer tools', 'Client A — Principal Engineer | SaaS');
  const text = check(bad).problems.join('\n');
  assert.match(text, /title "Staff Engineer" should be "Senior Software Engineer \(Consultant\)"/);
  assert.match(text, /dates "May 2016 - Apr 2026" should be "Apr 2016 - Apr 2026"/);
  assert.match(text, /role "Principal Engineer" should be "Senior Front-End Engineer"/);
  assert.match(text, /domain "SaaS" should be "Developer tools"/);
});

test('a client printed as an employer, an unknown client and a double listing are mismatches', () => {
  const bad = source
    .replace('### Studio | Software Engineer', '### Client C | Senior Back-End Engineer')
    .replace('#### Client: Client B', '#### Client: Client Z')
    .replace('Other clients: Client C', 'Other clients: Client A');
  const text = check(bad).problems.join('\n');
  assert.match(text, /Client C is a client of Example Consultancy, shown as if it were an employer/);
  assert.match(text, /"Client Z" has no engagement fact block/);
  assert.match(text, /Client A is both detailed and on the other-clients line/);
});

test('archived entries and missing clients are warnings', () => {
  const { problems, warnings } = check(source.replace('Other clients: Client C', 'Other clients: Client D'));
  assert.deepEqual(problems, []);
  assert.match(warnings.join('\n'), /Client D is archived/);
  assert.match(warnings.join('\n'), /Client C is on neither a client line nor the other-clients line/);
});

test('contact details, project links and education are checked', () => {
  const bad = source
    .replace('jane.doe@example.com', 'jane@example.com')
    .replace('(https://github.com/janedoe-example/idea-tool)', '(https://github.com/janedoe-example/other)')
    .replace('Web Development Program | Portland, OR | 2014', 'Computer Science | Portland, OR | 2015');
  const text = check(bad).problems.join('\n');
  assert.match(text, /don't show the Candidate Info email/);
  assert.match(text, /idea-tool: the link/);
  assert.match(text, /credential "Computer Science" should be "Web Development Program"/);
  assert.match(text, /date "2015" should be "2014"/);
});

const goodForm = {
  name: 'Jane Doe',
  email: 'jane.doe@example.com',
  phone: '555-010-0199',
  linkedin: 'linkedin.com/in/janedoe-example',
  github: 'https://github.com/janedoe-example/',
  work_history: [
    { employer: 'Example Consultancy', title: 'Senior Software Engineer (Consultant)', start: 'April 2016', end: 'Apr 2026' },
    { employer: 'Studio', title: 'Software Engineer', start: '02/2015', end: 'Feb 2016' },
  ],
  education: [{ school: 'Example Bootcamp', credential: 'Web Development Program', year: '2014' }],
};

test('a parse-check form that matches the fact blocks passes', () => {
  const { problems, warnings } = checkForm(goodForm, facts, { info, resume: parseResume(source) });
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, []);
});

test('a parser that reads a client as an employer, or misses an employer, fails the form', () => {
  const form = structuredClone(goodForm);
  form.work_history = [
    { employer: 'Client A', title: 'Senior Front-End Engineer', start: 'May 2024', end: 'Dec 2024' },
    { employer: 'Example Consultancy', title: 'Senior Software Engineer (Consultant)', start: 'Apr 2016', end: 'Present' },
    { employer: 'Self-directed projects', title: '', start: 'Apr 2026', end: 'Present' },
  ];
  const { problems, warnings } = checkForm(form, facts, { info, resume: parseResume(source) });
  const text = problems.join('\n');
  assert.match(text, /read the client "Client A" as an employer/);
  assert.match(text, /Example Consultancy: the parser read Apr 2016 - Present, not Apr 2016 - Apr 2026/);
  assert.match(text, /missed the employer Studio/);
  assert.doesNotMatch(text, /Agency/);
  assert.match(warnings.join('\n'), /Selected Projects group/);
});

const withProse = `${superResume}
#### What I Actually Did (evidence notes, not resume text)

- Component library: mapped 1:1 to CMS content types · editors publish pages without a deploy · built by me
- Description (approved Jan 5): A Claude Code skill that turns a vague brief into a short list of strong ideas
`;

test('a bullet or summary sentence that copies eight words in a row from the Super Resume is reported', () => {
  const copied = source.replace('- Co-developed a component library mapped 1:1 to CMS content types, so editors publish pages without a deploy',
    '- Built a component library mapped 1:1 to CMS content types · editors publish pages without a deploy');
  const runs = copiedRuns(parseResume(copied), withProse);
  assert.equal(runs.length, 1);
  assert.match(runs[0].run, /^component library mapped 1 1 to cms content types editors publish pages without a deploy$/);
  assert.match(copyWarning(runs[0]), /shares 15 words in a row with the Super Resume/);
});

test('a rewritten bullet, a short shared phrase and an approved description are not copies', () => {
  const rewritten = source.replace('- Co-developed a component library mapped 1:1 to CMS content types, so editors publish pages without a deploy',
    '- Built a component library that matches each CMS content type, so editors publish pages without a deploy');
  assert.deepEqual(copiedRuns(parseResume(rewritten), withProse), []);
});

const terms = parseTerms(`# Anything after a hash at the start is a comment
TypeScript [tool] [top]
React [tool]
component library
Kafka
CI/CD | continuous integration [preferred]
multiagent workflows
Engineer
`);

test('terms.txt lists each term with its other forms and tags', () => {
  assert.equal(terms.length, 7);
  assert.deepEqual(terms[0], { term: 'TypeScript', forms: ['TypeScript'], tool: true, top: true, preferred: false });
  assert.deepEqual(terms[4].forms, ['CI/CD', 'continuous integration']);
  assert.equal(terms[4].preferred, true);
});

test('the terms check reports missing must-haves, other spellings, placement and overuse', () => {
  const { problems, warnings, rows } = checkTerms(parseResume(source), terms);
  const p = problems.join('\n');
  const w = warnings.join('\n');
  assert.match(p, /"Kafka", a JD must-have, appears nowhere/);
  assert.doesNotMatch(p, /CI\/CD/, 'a preferred term is never required');
  assert.match(w, /"TypeScript" appears only in the skills: show it in a bullet too/);
  assert.match(w, /"TypeScript" is one of the JD's top requirements/);
  assert.match(w, /"React" is a tool or technology the JD requires, so it belongs in Technical Skills too/);
  assert.match(w, /"multiagent workflows" appears only as "multi-agent workflows"/);
  assert.doesNotMatch(w, /"Engineer" appears \d/, 'role lines and the headline are not prose');
  assert.doesNotMatch(w, /"React" appears \d/, 'a technology may repeat across clients');
  assert.deepEqual(rows.find((r) => r.term === 'component library'), { term: 'component library', count: 2, where: ['experience'], preferred: false });
});

test('a phrase repeated more than three times in the summary and bullets reads as stuffing', () => {
  const stuffed = source.replace('builds with AI agents every day', 'builds design systems, design systems tooling and design systems docs')
    .replace('Lead developer of a shared React component library', 'Lead developer of a design systems library');
  const { warnings } = checkTerms(parseResume(stuffed), parseTerms('design systems'));
  assert.match(warnings.join('\n'), /"design systems" appears 4 times in the summary and bullets/);
});

test('a term in the source but not in the PDF text is a problem: the ATS reads the PDF', () => {
  const text = 'Jane Doe\nTypeScript React component library Kafka multiagent workflows Engineer';
  const { problems } = checkTerms(parseResume(source), parseTerms('Claude Code\nKafka'), { text });
  assert.match(problems.join('\n'), /"Claude Code" is in the source but not in the PDF's text/);
  assert.equal(problems.length, 1);
});

test('a copied run never spans two lines of the Super Resume', () => {
  const sr = `${superResume}\n- Notes: the release train shipped weekly to every customer\n- Other notes: editors publish pages without a deploy\n`;
  const bullet = source.replace('- Lead developer of a shared React component library adopted by five teams',
    '- Shipped weekly to every customer: editors publish pages without a deploy');
  assert.deepEqual(copiedRuns(parseResume(bullet), sr), []);
});

test('placement reads bodies, not headings; Education is named; short terms match only in their case', () => {
  const { warnings, rows } = checkTerms(parseResume(source), parseTerms('Front-End Engineer\nWeb Development Program\nGo\nC'));
  const w = warnings.join('\n');
  assert.match(w, /"Front-End Engineer" appears only in headings or the header: show it in a bullet too/);
  assert.match(w, /"Web Development Program" appears only in the education/);
  const go = parseResume(source.replace('Shipped a Unity/C# iOS game', 'Became the go-to person for a Unity/C# iOS game').replace('Other clients: Client C', 'Other clients: Client D'));
  const { problems } = checkTerms(go, parseTerms('Go\nC'));
  assert.match(problems.join('\n'), /"Go", a JD must-have, appears nowhere/);
  assert.match(problems.join('\n'), /"C", a JD must-have, appears nowhere/);
  assert.equal(rows.length, 4);
});

test('a preferred term missing from the PDF text is a warning, never an error', () => {
  const { problems, warnings } = checkTerms(parseResume(source), parseTerms('Claude Code [preferred]'), { text: 'Jane Doe' });
  assert.deepEqual(problems, []);
  assert.match(warnings.join('\n'), /"Claude Code" is in the source but not in the PDF's text/);
});

const CLI = fileURLToPath(new URL('../scripts/check-resume.mjs', import.meta.url));
const FIXTURES = fileURLToPath(new URL('./fixtures/', import.meta.url));
const run = (...args) => spawnSync(process.execPath, [CLI, join(FIXTURES, 'resume.md'), '--super-resume', join(FIXTURES, 'example-super-resume.md'), ...args], { encoding: 'utf8' });

test('the command fails on a missing must-have, prints the coverage, and refuses --text without --terms', () => {
  const dir = mkdtempSync(join(tmpdir(), 'terms-'));
  writeFileSync(join(dir, 'terms.txt'), 'TypeScript [tool]\nKafka\n');
  writeFileSync(join(dir, 'resume.txt'), 'Jane Doe TypeScript');
  const missing = run('--terms', join(dir, 'terms.txt'), '--text', join(dir, 'resume.txt'));
  assert.equal(missing.status, 1);
  assert.match(missing.stdout, /TypeScript: 1, in skills/);
  assert.match(missing.stdout, /Kafka: missing/);
  assert.match(missing.stdout, /The resume matches the fact blocks; 1 JD must-have\(s\) missing\./);
  writeFileSync(join(dir, 'terms.txt'), 'TypeScript [tool]\n');
  const ok = run('--terms', join(dir, 'terms.txt'));
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /every JD must-have appears/);
  assert.equal(run('--text', join(dir, 'resume.txt')).status, 2);
});
