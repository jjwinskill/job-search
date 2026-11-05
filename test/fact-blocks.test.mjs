import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { monthsCovered, parseDates, parseFactBlocks, validate } from '../scripts/fact-blocks.mjs';

const block = (fields) => `\`\`\`facts\n${Object.entries(fields).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\`\`\``;
const doc = (...blocks) => blocks.map((b, i) => `### Entry ${i}\n\n${b}\n\nProse.\n`).join('\n');
const employer = { kind: 'employer', name: 'Example Consultancy', title: 'Senior Engineer', type: 'full-time', dates: '2016-04..2026-04', weight: 'lead' };
const engagement = { kind: 'engagement', name: 'Client A', employer: 'Example Consultancy', role: 'Senior Front-End Engineer', dates: '2024-05..2024-12', weight: 'lead' };

test('dates: ranges, present, single years and several intervals', () => {
  assert.deepEqual(parseDates('2025-01..2025-05, 2025-09..present'), [{ start: '2025-01', end: '2025-05' }, { start: '2025-09', end: 'present' }]);
  assert.deepEqual(parseDates('2014'), [{ start: '2014-01', end: '2014-12' }]);
  assert.equal(parseDates('Jan 2025 - May 2025'), null);
  assert.equal(parseDates('2025-06..2025-01'), null);
  assert.equal(parseDates('2025-13..2025-14'), null);
});

test('blocks parse with their heading and line', () => {
  const [e] = parseFactBlocks(doc(block(employer)));
  assert.equal(e.name, 'Example Consultancy');
  assert.equal(e.heading, 'Entry 0');
  assert.equal(e.line, 3); // the ```facts fence, 1-based
});

test('a valid set has no problems', () => {
  const { problems, warnings } = validate(parseFactBlocks(doc(block(employer), block(engagement))));
  assert.deepEqual(problems, []);
  assert.deepEqual(warnings, []);
});

test('missing keys, bad dates, bad weight, unknown employer and duplicates are problems', () => {
  const bad = { ...engagement, employer: 'Nobody', weight: 'high', dates: 'last year' };
  delete bad.role;
  const { problems } = validate(parseFactBlocks(doc(block(employer), block(bad), block(engagement), block(engagement))));
  const text = problems.join('\n');
  assert.match(text, /needs `role`/);
  assert.match(text, /dates "last year"/);
  assert.match(text, /weight must be/);
  assert.match(text, /employer "Nobody" has no employer block/);
  assert.match(text, /a second engagement block named "Client A"/);
});

test('an unknown kind and an unclosed block are problems; an unknown key is a warning', () => {
  const { problems, warnings } = validate(parseFactBlocks(`${block({ kind: 'hobby', name: 'x' })}\n\n\`\`\`facts\nkind: project\nname: y\nmood: great\n`));
  assert.match(problems.join('\n'), /kind must be one of/);
  assert.match(problems.join('\n'), /never closed/);
  assert.match(warnings.join('\n'), /unknown key `mood`/);
});

test('overlapping months count once', () => {
  const entries = [{ dates: '2020-01..2020-12' }, { dates: '2020-07..2021-06' }];
  assert.equal(monthsCovered(entries), 18);
  assert.equal(monthsCovered([{ dates: '2026-01..present' }], '2026-03'), 3);
});
