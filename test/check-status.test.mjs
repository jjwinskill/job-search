import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { pathsFor } from '../scripts/config.mjs';
import {
  appendNotes, ghostDue, mailWindow, matchApplication, monthsBefore, nextStatus, parsePayTop, payFloor, quietNote,
  reportPath, roleSimilarity, run, sameCompany, screen, setStatus, slugify, updateFrontmatter, validateInput,
} from '../scripts/check-status.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/check-status.mjs', import.meta.url));
const TODAY = '2026-03-31';
const made = [];

const record = (fields, body = 'Notes.') => `---\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n\n${body}\n`;
const app = (fields) => ({ company: 'Example Co', role: 'Senior Frontend Engineer', status: 'applied', created: '2026-03-01', applied: '2026-03-01', last_contact: '2026-03-01', ...fields });

function dataDir(apps, { criteria = '- **Pay floor:** $150k.\n', reports = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'status-test-'));
  made.push(dir);
  for (const [folder, fields] of Object.entries(apps)) {
    mkdirSync(join(dir, 'applications', folder), { recursive: true });
    writeFileSync(join(dir, 'applications', folder, 'application.md'), record(fields));
  }
  if (criteria) writeFileSync(join(dir, 'criteria.md'), criteria);
  if (reports.length) {
    mkdirSync(join(dir, 'reports'));
    for (const r of reports) writeFileSync(join(dir, 'reports', r), '# old\n');
  }
  return dir;
}
const read = (dir, folder) => readFileSync(join(dir, 'applications', folder, 'application.md'), 'utf8');
const apps = (list) => list.map(([folder, fields]) => ({ folder, fields, start: fields.created }));

afterEach(() => {
  while (made.length) rmSync(made.pop(), { recursive: true, force: true });
});

test('mail moves a status forward, never back', () => {
  assert.equal(nextStatus('applied', 'interviewing', true).status, 'interviewing');
  assert.equal(nextStatus('interviewing', 'screening', true).status, 'interviewing');
  assert.equal(nextStatus('interviewing', 'applied', true).status, 'interviewing');
  assert.equal(nextStatus('drafted', 'applied', true).status, 'applied');
  assert.equal(nextStatus('screening', 'contact', true).status, 'screening');
  assert.equal(nextStatus('offer', 'rejected', true).status, 'rejected');
  assert.equal(nextStatus('inbound', 'withdrawn', true).status, 'withdrawn');
});

test('closed Applications stay closed: newer mail that would reopen one is a conflict, older mail is ignored', () => {
  assert.deepEqual(nextStatus('rejected', 'interviewing', true), { status: 'rejected', conflict: true });
  assert.deepEqual(nextStatus('rejected', 'applied', false), { status: 'rejected' });
  assert.deepEqual(nextStatus('withdrawn', 'rejected', true), { status: 'withdrawn' });
  assert.deepEqual(nextStatus('rejected', 'contact', true), { status: 'rejected' });
  assert.deepEqual(nextStatus('passed', 'screening', true), { status: 'passed', conflict: true });
});

test('a ghosted Application reopens on newer mail and takes any real reply', () => {
  assert.equal(nextStatus('ghosted', 'contact', true).status, 'applied');
  assert.equal(nextStatus('ghosted', 'applied', false).status, 'ghosted');
  assert.equal(nextStatus('ghosted', 'rejected', false).status, 'rejected');
  assert.equal(nextStatus('ghosted', 'interviewing', true).status, 'interviewing');
});

test('ghosted after 30 days without a reply, counted from the later of applied and last contact', () => {
  assert.equal(ghostDue(app({ applied: '2026-03-01', last_contact: '2026-03-01' }), '2026-03-31'), '2026-03-01');
  assert.equal(ghostDue(app({ applied: '2026-03-02', last_contact: '2026-03-02' }), '2026-03-31'), null);
  assert.equal(ghostDue(app({ applied: '2026-02-01', last_contact: '2026-03-10' }), '2026-03-31'), null);
  assert.equal(ghostDue(app({ status: 'interviewing', applied: '2026-01-01', last_contact: '2026-01-01' }), '2026-03-31'), null);
  assert.equal(ghostDue(app({ applied: '', last_contact: '', created: '2026-02-01' }), '2026-03-31'), '2026-02-01');
});

test('going quiet: applied from 21 days, active loops from 14, drafted from 7', () => {
  assert.deepEqual(quietNote(app({ applied: '2026-03-10', last_contact: '2026-03-10' }), TODAY), { status: 'applied', since: '2026-03-10', days: 21, ghostOn: '2026-04-09' });
  assert.equal(quietNote(app({ applied: '2026-03-11', last_contact: '2026-03-11' }), TODAY), null);
  assert.equal(quietNote(app({ status: 'interviewing', last_contact: '2026-03-17' }), TODAY).days, 14);
  assert.equal(quietNote(app({ status: 'interviewing', last_contact: '2026-03-18' }), TODAY), null);
  assert.equal(quietNote(app({ status: 'drafted', created: '2026-03-24', applied: '', last_contact: '' }), TODAY).days, 7);
  assert.equal(quietNote(app({ status: 'rejected', last_contact: '2026-01-01' }), TODAY), null);
});

test('the window is 6 months with no reports, then starts at the newest report', () => {
  const none = dataDir({});
  assert.deepEqual(mailWindow(join(none, 'reports'), '2026-11-08'), { since: '2026-05-08', until: '2026-11-08', firstRun: true, lastReport: null, query: 'after:2026/05/08' });
  assert.equal(monthsBefore('2026-08-31', 6), '2026-02-28');
  assert.equal(monthsBefore('2026-03-15', 6), '2025-09-15');
  const some = dataDir({}, { reports: ['2026-11-01.md', '2026-11-05.md', '2026-11-05-2.md', 'notes.txt'] });
  const w = mailWindow(join(some, 'reports'), '2026-11-08');
  assert.equal(w.since, '2026-11-05');
  assert.equal(w.lastReport, '2026-11-05-2.md');
  assert.equal(w.firstRun, false);
  assert.match(reportPath(join(some, 'reports'), '2026-11-05'), /2026-11-05-3\.md$/);
  assert.match(reportPath(join(some, 'reports'), '2026-11-08'), /2026-11-08\.md$/);
});

test('pay: the top of a posted range, per year, against the floor in the criteria file', () => {
  assert.equal(parsePayTop('$178k–$250k'), 250000);
  assert.equal(parsePayTop('$150,000 - $190,000 a year'), 190000);
  assert.equal(parsePayTop('150-190K'), 190000);
  assert.equal(parsePayTop('$85-95/hr'), 197600);
  assert.equal(parsePayTop('$70 per hour'), 145600);
  assert.equal(parsePayTop('competitive'), null);
  assert.equal(parsePayTop(''), null);
  assert.equal(payFloor('- **Level:** senior.\n- **Pay floor:** $150k. Reject an Inbound when...'), 150000);
  assert.equal(payFloor('- Pay floor: $165,000'), 165000);
  assert.equal(payFloor('No pay rule here.'), null);
});

test('screening: any fail screens an Inbound out; contracts, unknowns and missing pay are flags', () => {
  const pass = { level: 'pass', focus: 'pass', location: 'pass', type: 'full-time', legitimacy: 'pass' };
  assert.deepEqual(screen({ checks: pass, pay_range: '$180k-$220k' }, 150000), { outcome: 'inbound', flags: [] });
  assert.deepEqual(screen({ checks: { ...pass, type: 'contract', legitimacy: 'unverified' } }, 150000),
    { outcome: 'inbound', flags: ['contract', 'unverified', 'pay unknown'] });
  const low = screen({ checks: pass, pay_range: '$110k-$140k' }, 150000);
  assert.equal(low.outcome, 'screened-out');
  assert.match(low.reasons[0], /\$140k, is under the \$150k floor/);
  const off = screen({ checks: { ...pass, focus: 'fail' }, reasons: { focus: 'electrical engineering' }, pay_range: '$200k' }, 150000);
  assert.deepEqual(off.reasons, ['focus: electrical engineering']);
  assert.deepEqual(screen({ checks: pass, pay_range: '$100k' }, null).outcome, 'inbound');
});

test('matching: company prefixes, role words without seniority, and a new role is a new Application', () => {
  assert.ok(sameCompany('Example', 'Example Labs, Inc.'));
  assert.ok(sameCompany('The Example Co', 'example'));
  assert.ok(!sameCompany('Example', 'Examplify'));
  assert.ok(!sameCompany('', 'Example'));
  assert.equal(roleSimilarity('Senior Full Stack Engineer', 'Fullstack Engineer, Identity'), 0.5);
  assert.equal(roleSimilarity('Software Engineer', 'Senior Software Engineer'), 1);

  const list = apps([
    ['a', app({ company: 'Globex', role: 'Frontend Engineer, Payments', created: '2026-02-01' })],
    ['b', app({ company: 'Globex', role: 'Backend Engineer, Data', created: '2026-02-01' })],
    ['c', app({ company: 'Initech', role: 'Staff Engineer, Payments', created: '2026-03-10', applied: '2026-03-10' })],
  ]);
  assert.equal(matchApplication(list, { company: 'Globex Corp', role: 'Sr Front-End Engineer (Payments)', date: '2026-03-01', type: 'rejected' }).app.folder, 'a');
  assert.deepEqual(matchApplication(list, { company: 'Globex', date: '2026-03-01', type: 'rejected' }), { ambiguous: ['a', 'b'] });
  assert.equal(matchApplication(list, { company: 'Initech', role: 'Anything', date: '2026-03-12', type: 'rejected' }).app.folder, 'c');
  assert.deepEqual(matchApplication(list, { company: 'Initech', role: 'Data Platform Engineer', date: '2026-03-12', type: 'applied' }), { none: true });
  assert.deepEqual(matchApplication(list, { company: 'Initech', role: 'Staff Engineer, Payments', date: '2026-03-01', type: 'rejected' }), { none: true });
  assert.deepEqual(matchApplication(list, { company: 'Acme', role: 'Engineer', date: '2026-03-12', type: 'applied' }), { none: true });
});

test('frontmatter edits keep every other line; values with a colon are quoted; notes follow the body', () => {
  const text = record({ company: 'Example Co', status: 'applied', source_url: 'https://x.test/1', applied: '' });
  const updated = updateFrontmatter(text, { status: 'rejected', last_contact: '2026-03-02', note_url: 'https://x.test/a#b' });
  assert.match(updated, /^---\ncompany: Example Co\nstatus: rejected\nsource_url: https:\/\/x\.test\/1\napplied: \nlast_contact: 2026-03-02\nnote_url: "https:\/\/x\.test\/a#b"\n---\n\nNotes\.\n$/);
  assert.equal(appendNotes(updated, ['2026-03-02: one.']).split('\n').at(-2), '2026-03-02: one.');
  assert.equal(appendNotes('---\na: b\n---\n', ['x']), '---\na: b\n---\n\nx\n');
  assert.equal(appendNotes(text, []), text);
  assert.equal(slugify("McDonald's"), 'mcdonald-s');
  assert.equal(slugify('Senior Full-Stack Engineer, Global E-Commerce Supply Chain', 40), 'senior-fullstack-engineer-global-e-comme');
});

test('bad input is refused with every problem listed', () => {
  assert.deepEqual(validateInput([]), ['the input must be a JSON object']);
  const errors = validateInput({
    events: [{ type: 'ghosted', date: '3/1/2026', evidence: '' }],
    inbound: [{ date: '2026-03-01', evidence: 'x', checks: { type: 'part-time' } }],
    unmatched: [{}],
  });
  assert.equal(errors.length, 7);
  assert.match(errors.join('\n'), /events\[0\]: type must be one of applied, screening/);
  assert.match(errors.join('\n'), /inbound\[0\]: checks\.type must be one of full-time, contract, fail, unknown/);
});

function runFixture() {
  const dir = dataDir({
    '2026-03-01-example-co-frontend': app({}),
    '2026-03-20-globex-staff': app({ company: 'Globex', role: 'Staff Engineer', created: '2026-03-20', applied: '2026-03-20', last_contact: '2026-03-20' }),
    '2026-02-01-initech-engineer': app({ company: 'Initech', role: 'Engineer', status: 'rejected', created: '2026-02-01', applied: '2026-02-01', last_contact: '2026-02-20' }),
    '2026-03-25-acme-platform': app({ company: 'Acme', role: 'Platform Engineer', status: 'drafted', created: '2026-03-25', applied: '', last_contact: '' }),
  });
  const pass = { level: 'pass', focus: 'pass', location: 'pass', type: 'full-time', legitimacy: 'pass' };
  const input = {
    threads: 9,
    skipped: 2,
    events: [
      { folder: '2026-03-20-globex-staff', type: 'interviewing', date: '2026-03-28', evidence: 'globex.test, "Next steps"', action: 'Pick a time for the panel' },
      { company: 'Umbrella', role: 'Senior Product Engineer', type: 'applied', date: '2026-03-29', evidence: 'ats.test, "Thanks for applying to Umbrella"' },
      { company: 'Initech', role: 'Engineer', type: 'interviewing', date: '2026-03-15', evidence: 'initech.test, "Interview invite"' },
      { company: 'Initech', role: 'Engineer', type: 'applied', date: '2026-02-01', evidence: 'initech.test, "Thanks"' },
      { company: 'Hooli', type: 'contact', date: '2026-03-20', evidence: 'hooli.test, "Quick question"' },
      { company: 'Acme', role: 'Platform Engineer', type: 'applied', date: '2026-03-26', evidence: 'ats.test, "Thanks for applying to Acme"' },
    ],
    inbound: [
      { company: 'Vandelay', role: 'Senior Full-Stack Engineer', date: '2026-03-30', from: 'a recruiter at vandelay.test', evidence: 'vandelay.test, "Your background"', pay_range: '$180k-$230k', location: 'Remote (US)', checks: pass },
      { company: 'Cheapco', role: 'Senior Engineer', date: '2026-03-30', evidence: 'cheapco.test, "Opportunity"', pay_range: '$110k-$140k', checks: pass },
    ],
    unmatched: [{ evidence: 'board.test, "Application received"', date: '2026-03-27', why: 'no employer named' }],
  };
  return { dir, input, paths: pathsFor(dir) };
}

test('a run applies the mail, ghosts the silent, screens Inbound, and writes the six sections', () => {
  const { dir, input, paths } = runFixture();
  const { text, path } = run({ paths, input, today: TODAY });
  assert.equal(path, join(dir, 'reports', `${TODAY}.md`));
  assert.equal(readFileSync(path, 'utf8'), text);
  const headings = text.match(/^## .*$/gm);
  assert.deepEqual(headings, ['## 1. Needs you', '## 2. Changed', '## 3. Pipeline table', '## 4. Going quiet', '## 5. Screened out', '## 6. Unmatched']);
  assert.match(text, /^Mail read from Sep 30, 2025 to Mar 31 \(first run: the last 6 months\)\. 9 job threads read, mail matched to 3 Applications, 2 new, 2 unmatched, 2 job alerts and newsletters skipped\./m);
  assert.match(text, /\*\*Check spam by hand\*\* for recruiter mail since Sep 30, 2025/);

  // Status changes, with evidence on disk.
  const globex = read(dir, '2026-03-20-globex-staff');
  assert.match(globex, /status: interviewing\n/);
  assert.match(globex, /last_contact: 2026-03-28\n/);
  assert.match(globex, /2026-03-28: applied → interviewing \(check-status\)\. Evidence: globex\.test, "Next steps"\. Next: Pick a time for the panel/);
  assert.match(text, /- \*\*Globex, Staff Engineer\*\* \(interviewing\): Pick a time for the panel \(Mar 28\)\./);
  assert.match(text, /- \*\*Globex, Staff Engineer\*\*: applied → interviewing \(Mar 28; globex\.test, "Next steps"\)\./);

  // The 30-day rule.
  assert.match(read(dir, '2026-03-01-example-co-frontend'), /status: ghosted\n[\s\S]*2026-03-31: applied → ghosted \(check-status\): no reply in 30 days since 2026-03-01\./);
  assert.match(text, /- \*\*Example Co, Senior Frontend Engineer\*\*: applied → ghosted \(no reply since Mar 1\)\./);

  // A confirmation for an unknown company is a new Application; a drafted one moves to applied.
  const created = readdirSync(join(dir, 'applications')).find((f) => f.includes('umbrella'));
  assert.equal(created, '2026-03-29-umbrella-senior-product-engineer');
  assert.match(read(dir, created), /status: applied\ncreated: 2026-03-29\napplied: 2026-03-29\n[\s\S]*origin: check-status\n---\n\nFound by \/check-status on 2026-03-31\.\n2026-03-29: confirmation/);
  assert.match(text, /- \*\*Umbrella, Senior Product Engineer\*\*: new, applied \(Mar 29;/);
  assert.match(read(dir, '2026-03-25-acme-platform'), /status: applied\ncreated: 2026-03-25\napplied: 2026-03-26\nlast_contact: 2026-03-26/);

  // Mail that would reopen a closed Application asks; older mail on it changes nothing.
  assert.match(read(dir, '2026-02-01-initech-engineer'), /status: rejected\n/);
  assert.doesNotMatch(read(dir, '2026-02-01-initech-engineer'), /check-status/);
  assert.match(text, /- \*\*Initech, Engineer\*\* is rejected, but initech\.test, "Interview invite" \(Mar 15\) reads as interviewing\. A new Application, or a correction\?/);

  // Inbound: one passes and gets a record, one is screened out with the reason.
  const inbound = readdirSync(join(dir, 'applications')).find((f) => f.includes('vandelay'));
  assert.match(read(dir, inbound), /status: inbound\n[\s\S]*pay_range: \$180k-\$230k\n/);
  assert.match(text, /- \*\*Inbound: Vandelay, Senior Full-Stack Engineer\*\* from a recruiter at vandelay\.test \(Mar 30\): \$180k-\$230k; Remote \(US\)\. Generate a resume, or pass\?/);
  assert.ok(!readdirSync(join(dir, 'applications')).some((f) => f.includes('cheapco')));
  assert.match(text, /## 5\. Screened out\n\n- \*\*Cheapco, Senior Engineer\*\* \(Mar 30\): pay: the top of the range, \$140k, is under the \$150k floor\./);

  // Unmatched: the skill's own, and contact mail with no Application.
  assert.match(text, /- board\.test, "Application received" \(Mar 27\): no employer named\./);
  assert.match(text, /- hooli\.test, "Quick question" \(Mar 20\): no Application for Hooli\./);

  // Pipeline: open ones by stage, closed ones counted.
  assert.match(text, /\| Company \| Role \| Status \| Applied \| Last heard \|\n\|---\|---\|---\|---\|---\|\n\| Globex \| Staff Engineer \| interviewing \| Mar 20 \| Mar 28 \(3d\) \|/);
  assert.match(text, /Closed: 1 ghosted, 1 rejected\./);
  assert.match(text, /## 4\. Going quiet\n\nNothing\./);
});

test('running the same mail again changes nothing, and a dry run writes nothing', () => {
  const { dir, input, paths } = runFixture();
  run({ paths, input, today: TODAY });
  const before = readdirSync(join(dir, 'applications')).map((f) => read(dir, f)).join('\n');
  const dry = run({ paths, input, today: TODAY, dryRun: true });
  assert.equal(readdirSync(join(dir, 'reports')).length, 1);
  assert.match(dry.text, /## 2\. Changed\n\nNothing\./);
  assert.deepEqual(dry.touched, []);
  const again = run({ paths, input, today: TODAY });
  assert.match(again.path, /2026-03-31-2\.md$/);
  assert.equal(readdirSync(join(dir, 'applications')).map((f) => read(dir, f)).join('\n'), before);
  assert.match(again.text, /- \*\*Inbound: Vandelay, Senior Full-Stack Engineer\*\* \(since Mar 30\): still waiting on you\./);
});

test('mail that could be either of two Applications is unmatched, unless it changes neither', () => {
  const both = { company: 'Globex', status: 'rejected', created: '2026-03-01', applied: '2026-03-01', last_contact: '2026-03-10' };
  const dir = dataDir({
    'globex-a': app({ ...both, role: 'General Application' }),
    'globex-b': app({ ...both, role: 'Platform Engineer' }),
  });
  const old = { company: 'Globex', type: 'rejected', date: '2026-03-10', evidence: 'globex.test, "Your application"' };
  const { text } = run({ paths: pathsFor(dir), input: { since: '2026-03-01', events: [old] }, today: TODAY, dryRun: true });
  assert.match(text, /^Mail read from Mar 1 to Mar 31\. Mail matched to 2 Applications, 0 new, 0 unmatched\./m);
  const fresh = { ...old, type: 'contact', date: '2026-03-20', evidence: 'globex.test, "Following up"' };
  const again = run({ paths: pathsFor(dir), input: { events: [fresh] }, today: TODAY, dryRun: true });
  assert.match(again.text, /- globex\.test, "Following up" \(Mar 20\): could be globex-a or globex-b\./);
});

test('Needs you drops actions from old mail or closed Applications, and groups Inbound over 30 days old', () => {
  const pass = { level: 'pass', focus: 'pass', location: 'pass', type: 'full-time', legitimacy: 'pass' };
  const dir = dataDir({
    closed: app({ company: 'Globex', role: 'Staff Engineer', status: 'rejected', last_contact: '2026-03-20' }),
    open: app({ company: 'Initech', role: 'Platform Engineer', status: 'screening', last_contact: '2026-03-25' }),
  });
  const input = {
    events: [
      { folder: 'closed', type: 'screening', date: '2026-03-05', evidence: 'globex.test, "Assessment"', action: 'Take the assessment' },
      { folder: 'open', type: 'screening', date: '2026-03-10', evidence: 'initech.test, "Old ask"', action: 'An old ask' },
      { folder: 'open', type: 'interviewing', date: '2026-03-27', evidence: 'initech.test, "Panel"', action: 'Pick a panel time' },
      { folder: 'open', type: 'contact', date: '2026-03-28', evidence: 'initech.test, "Reminder"', action: 'Confirm the panel time' },
    ],
    inbound: [
      { company: 'Acme', role: 'Frontend Engineer', date: '2026-01-10', evidence: 'a', checks: pass },
      { company: 'Hooli', role: 'Platform Engineer', date: '2026-02-01', evidence: 'b', checks: pass },
      { company: 'Vandelay', role: 'Staff Engineer', date: '2026-03-25', evidence: 'c', checks: pass },
    ],
  };
  const { text } = run({ paths: pathsFor(dir), input, today: TODAY, dryRun: true });
  assert.doesNotMatch(text, /Take the assessment|An old ask|Pick a panel time/);
  assert.match(text, /- \*\*Initech, Platform Engineer\*\* \(interviewing\): Confirm the panel time \(Mar 28\)\./);
  assert.match(text, /- \*\*Inbound: Vandelay, Staff Engineer\*\* \(Mar 25\)/);
  assert.match(text, /- \*\*2 older Inbound\*\* \(Jan 10 to Feb 1\), over 30 days old: Acme, Frontend Engineer; Hooli, Platform Engineer\. Pass on all of them, or name any to pursue\?/);
});

test('an Application nearing 30 days shows under Going quiet with the date it flips', () => {
  const dir = dataDir({ a: app({ applied: '2026-03-05', last_contact: '2026-03-05', created: '2026-03-05' }) });
  const { text } = run({ paths: pathsFor(dir), input: {}, today: TODAY });
  assert.match(text, /## 4\. Going quiet\n\n- \*\*Example Co, Senior Frontend Engineer\*\*: applied Mar 5, no reply in 26 days\. Ghosted on Apr 4 unless they write\./);
  assert.match(text, /Mail matched to 0 Applications, 0 new, 0 unmatched\./);
});

test('set records the candidate\'s decision; an offer withdrawn is an offer declined', () => {
  const dir = dataDir({
    inbound: app({ status: 'inbound', applied: '' }),
    offer: app({ status: 'offer' }),
  });
  const paths = pathsFor(dir);
  setStatus({ paths, folder: 'inbound', status: 'passed', date: TODAY, note: 'not a fit' });
  assert.match(read(dir, 'inbound'), /status: passed\n[\s\S]*2026-03-31: inbound → passed, on the candidate's word: not a fit\.\n$/);
  setStatus({ paths, folder: 'offer', status: 'withdrawn', date: TODAY });
  assert.match(read(dir, 'offer'), /status: withdrawn\n[\s\S]*outcome: offer-declined\n/);
  assert.throws(() => setStatus({ paths, folder: 'inbound', status: 'maybe', date: TODAY }), /status must be one of/);
  assert.throws(() => setStatus({ paths, folder: 'nope', status: 'passed', date: TODAY }), /no Application folder "nope"/);
});

test('the CLI prints the window, writes the report and index, and refuses bad input', () => {
  const { dir, input } = runFixture();
  const env = { ...process.env, JOB_SEARCH_DATA_DIR: dir };
  const cli = (...args) => spawnSync('node', [SCRIPT, ...args, '--today', TODAY], { env, encoding: 'utf8' });
  const window = cli('window');
  assert.equal(window.status, 0);
  assert.equal(JSON.parse(window.stdout).since, '2025-09-30');
  assert.match(cli('apps').stdout, /^2026-03-25-acme-platform \| Acme \| Platform Engineer \| drafted \| - \| -$/m);
  const file = join(dir, 'input.json');
  writeFileSync(file, JSON.stringify(input));
  const dry = cli('run', file, '--dry-run');
  assert.equal(dry.status, 0);
  assert.match(dry.stderr, /Dry run, nothing written/);
  assert.ok(!existsSync(join(dir, 'reports')));
  const ok = cli('run', file);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^# Status report: Mar 31, 2026$/m);
  assert.match(ok.stderr, /index rebuilt/);
  assert.match(readFileSync(join(dir, 'applications.csv'), 'utf8'), /umbrella/);
  writeFileSync(file, JSON.stringify({ events: [{ type: 'maybe' }] }));
  const bad = cli('run', file);
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /events\[0\]: type must be one of/);
  const set = cli('set', '2026-03-25-acme-platform', 'withdrawn', '--note', 'took another role');
  assert.equal(set.status, 0);
  assert.match(set.stdout, /applied → withdrawn/);
});
