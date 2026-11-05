import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { candidateInfo, checkForm, checkResume, factSpan, formatSpan, normalizeDate } from '../scripts/check-resume.mjs';
import { parseFactBlocks } from '../scripts/fact-blocks.mjs';
import { parseResume } from '../scripts/resume-md.mjs';

const superResume = readFileSync(new URL('./fixtures/super-resume.md', import.meta.url), 'utf8');
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
