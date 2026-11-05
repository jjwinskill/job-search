#!/usr/bin/env node
// Checks a Generated Resume against the Super Resume's fact blocks: every employer, title, date range, client, role,
// project and school must print exactly as its fact block says, and the contact lines must match Candidate Info.
// With --form, it checks a parse-check form instead: what an agent read from the PDF's text, as an application form.
// Usage: node scripts/check-resume.mjs <resume.md> [--form <form.json>] [--super-resume <file>]
// Exit codes: 0 consistent (warnings allowed), 1 mismatches found, 2 not set up or bad usage.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ConfigError, loadConfig } from './config.mjs';
import { parseFactBlocks } from './fact-blocks.mjs';
import { DATE_RANGE, ResumeFormatError, parseResume, plain } from './resume-md.mjs';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const point = (part) => {
  if (part === 'present') return 'Present';
  if (/^\d{4}$/.test(part)) return part;
  const [y, m] = part.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
};

// "2016-04..2026-04" -> { start: 'Apr 2016', end: 'Apr 2026' }; "2013, 2014" -> 2013 to 2014; "2014" -> one year.
export function factSpan(dates) {
  const parts = String(dates).split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return null;
  const [firstStart] = parts[0].split('..');
  const lastEnd = parts.at(-1).split('..').at(-1);
  return { start: point(firstStart), end: point(lastEnd) };
}

export const formatSpan = (span) => (span.start === span.end ? span.start : `${span.start} - ${span.end}`);

// Normalizes a printed or parsed date ("April 2016", "Apr. 2016", "present", "current") to the fact-block style.
export function normalizeDate(text) {
  const t = String(text ?? '').trim().replace(/\.$/, '');
  if (/^(present|current|now|ongoing)$/i.test(t)) return 'Present';
  const m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/.exec(t);
  if (m) {
    const month = MONTHS.find((x) => x.toLowerCase() === m[1].toLowerCase());
    return month ? `${month} ${m[2]}` : t;
  }
  const n = /^(\d{1,2})\/(\d{4})$/.exec(t);
  if (n && Number(n[1]) >= 1 && Number(n[1]) <= 12) return `${MONTHS[Number(n[1]) - 1]} ${n[2]}`;
  return t;
}

export function rangeOf(text) {
  const [start, end] = String(text).split(/\s*[-–—]\s*/);
  return { start: normalizeDate(start), end: normalizeDate(end ?? start) };
}

// "## Candidate Info" in the Super Resume: "- Name: Jane Doe", "- Email: ...". Keys compare case-blind.
export function candidateInfo(markdown) {
  const section = /(?:^|\n)## Candidate Info[^\n]*\n([\s\S]*?)(?=\n## |\n---|(?![\s\S]))/.exec(markdown.replaceAll('\r\n', '\n'));
  if (!section) return null;
  const info = {};
  for (const [, key, value] of section[1].matchAll(/^[-*]\s*([^:]+):\s*(.+)$/gm)) info[key.trim().toLowerCase()] = value.trim();
  return info;
}

const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
const bareUrl = (u) => String(u ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
const digits = (s) => String(s ?? '').replace(/\D/g, '');

// A role may drop a trailing parenthetical, the one shortening that adds nothing ("Lead (React, tooling)" -> "Lead").
const roleMatches = (printed, role) => same(printed, role) || same(printed, String(role).replace(/\s*\([^()]*\)\s*$/, ''));

const listNames = (text) => plain(text).replace(/^Other [^:]+:\s*/i, '').replace(/\.$/, '').split(/,\s*|\s+and\s+/).map((s) => s.trim()).filter(Boolean);

function checkContact(resume, info, problems) {
  if (!info) return;
  const contact = resume.contact.join(' | ');
  const hrefs = [...contact.matchAll(/\]\(([^)]+)\)/g)].map((m) => bareUrl(m[1]));
  const shown = plain(contact).toLowerCase();
  if (info.name && !same(plain(resume.name), info.name)) problems.push(`the name "${plain(resume.name)}" doesn't match Candidate Info ("${info.name}")`);
  if (info.email && !shown.includes(info.email.toLowerCase())) problems.push(`the contact lines don't show the Candidate Info email (${info.email})`);
  if (info.phone && !digits(contact).includes(digits(info.phone))) problems.push(`the contact lines don't show the Candidate Info phone (${info.phone})`);
  if (info.location && !shown.includes(info.location.toLowerCase())) problems.push(`the contact lines don't show the Candidate Info location (${info.location})`);
  for (const key of ['linkedin', 'github', 'website']) {
    const url = bareUrl(info[key]);
    if (url && !hrefs.includes(url) && !shown.includes(url)) problems.push(`the contact lines don't link the Candidate Info ${key} (${info[key]})`);
  }
}

function checkExperience(section, facts, problems, warnings, shown) {
  const employers = facts.filter((f) => f.kind === 'employer');
  const engagements = facts.filter((f) => f.kind === 'engagement');
  for (const entry of section.entries) {
    if (!entry.head) {
      problems.push(`"${section.title}" has a \`####\` line with no employer above it`);
      continue;
    }
    const [name, title] = entry.head.parts.map(plain);
    const employer = employers.find((f) => same(f.name, name));
    if (!employer) {
      const client = engagements.find((f) => same(f.name, name));
      problems.push(client ? `${name} is a client of ${client.employer}, shown as if it were an employer` : `"${name}" has no employer fact block`);
      continue;
    }
    shown.add(employer);
    if (employer.archived) warnings.push(`${name} is archived: keep it only if the JD asks for exactly this work`);
    if (!same(title, employer.title)) problems.push(`${name}: the title "${title ?? ''}" should be "${employer.title}"`);
    const expected = formatSpan(factSpan(employer.dates));
    if (!entry.head.dates) problems.push(`${name}: no dates; they should be "${expected}"`);
    else if (formatSpan(rangeOf(entry.head.dates)) !== expected) problems.push(`${name}: the dates "${entry.head.dates}" should be "${expected}"`);

    const mine = engagements.filter((f) => same(f.employer, employer.name));
    const seen = new Set();
    for (const sub of entry.subs) {
      const m = /^Client:\s*(.+?)(?:\s+—\s+(.+?))?(?:\s+\|\s+(.+))?$/.exec(plain(sub.head));
      if (!m) {
        problems.push(`${name}: "${plain(sub.head)}" should read "Client: <name> — <role> | <domain>"`);
        continue;
      }
      const [, clientName, role, domain] = m;
      const client = mine.find((f) => same(f.name, clientName));
      if (!client) {
        problems.push(`${name}: "${clientName}" has no engagement fact block under ${employer.name}`);
        continue;
      }
      if (seen.has(client)) problems.push(`${name}: ${client.name} appears twice`);
      seen.add(client);
      shown.add(client);
      if (client.archived) warnings.push(`${client.name} is archived: keep it only if the JD asks for exactly this work`);
      if (role && !roleMatches(role, client.role)) problems.push(`${client.name}: the role "${role}" should be "${client.role}"`);
      if (!role) warnings.push(`${client.name}: the client line names no role ("${client.role}")`);
      if (domain && client.domain && !same(domain, client.domain)) problems.push(`${client.name}: the domain "${domain}" should be "${client.domain}"`);
    }
    for (const block of entry.after.filter((b) => b.type === 'p' && /^(\*\*)?Other [^:]+:/i.test(b.text))) {
      for (const other of listNames(block.text)) {
        const client = mine.find((f) => same(f.name, other));
        if (!client) problems.push(`${name}: "${other}" on the other-clients line has no engagement fact block`);
        else if (seen.has(client)) problems.push(`${name}: ${client.name} is both detailed and on the other-clients line`);
        else {
          seen.add(client);
          shown.add(client);
          if (client.archived) warnings.push(`${client.name} is archived: keep it only if the JD asks for exactly this work`);
        }
      }
    }
    const missing = mine.filter((f) => !f.archived && !seen.has(f)).map((f) => f.name);
    if (mine.length && missing.length) warnings.push(`${name}: ${missing.join(', ')} ${missing.length === 1 ? 'is' : 'are'} on neither a client line nor the other-clients line`);
  }
}

function checkProjects(section, facts, problems, warnings) {
  const projects = facts.filter((f) => f.kind === 'project');
  for (const entry of section.entries) {
    for (const sub of entry.subs) {
      const [label, ...rest] = sub.head.split(/\s+[|—]\s+/);
      const project = projects.find((f) => same(f.name, plain(label)));
      if (!project) {
        problems.push(`"${plain(label)}" has no project fact block`);
        continue;
      }
      if (project.archived) warnings.push(`${project.name} is archived: keep it only if the JD asks for exactly this work`);
      const link = rest.map((r) => /\]\(([^)]+)\)/.exec(r)?.[1] ?? plain(r)).find((r) => /\.\w{2,}\//.test(r));
      if (link && bareUrl(link) !== bareUrl(project.link)) problems.push(`${project.name}: the link "${link}" should be ${project.link ? `"${project.link}"` : 'left out (its fact block has none)'}`);
    }
  }
}

function checkEducation(section, facts, problems) {
  const schools = facts.filter((f) => f.kind === 'education');
  const items = section.intro.flatMap((b) => (b.type === 'ul' ? b.items : [b.text]));
  for (const item of items) {
    const text = plain(item);
    const cut = text.indexOf(' — ');
    const [school, rest] = cut === -1 ? [text, ''] : [text.slice(0, cut), text.slice(cut + 3)];
    const fact = schools.find((f) => same(f.name, school));
    if (!fact) {
      problems.push(`"${school}" has no education fact block`);
      continue;
    }
    const parts = rest.split(/\s+\|\s+/).map((p) => p.trim());
    if (!same(parts[0], fact.credential)) problems.push(`${fact.name}: the credential "${parts[0] ?? ''}" should be "${fact.credential}"`);
    const printed = parts.slice(1).find((p) => DATE_RANGE.test(p));
    const expected = formatSpan(factSpan(fact.dates));
    if (printed && formatSpan(rangeOf(printed)) !== expected) problems.push(`${fact.name}: the date "${printed}" should be "${expected}"`);
  }
}

export function checkResume(resume, facts, info = null) {
  const problems = [];
  const warnings = [];
  const shown = new Set();
  checkContact(resume, info, problems);
  for (const section of resume.sections) {
    if (/experience/i.test(section.title)) checkExperience(section, facts, problems, warnings, shown);
    else if (/project/i.test(section.title)) checkProjects(section, facts, problems, warnings);
    else if (/education/i.test(section.title)) checkEducation(section, facts, problems);
  }
  return { problems, warnings, shown };
}

/**
 * Compares a parse-check form with the fact blocks. The form is what an application system would fill in:
 * { name, email, phone, location, linkedin, github,
 *   work_history: [{ employer, title, start, end }], education: [{ school, credential, year }] }
 * Employers the resume shows must all be there, each with its fact-block title and dates; nothing else may be.
 */
export function checkForm(form, facts, { info = null, resume = null } = {}) {
  const problems = [];
  const warnings = [];
  const employers = facts.filter((f) => f.kind === 'employer');
  const engagements = facts.filter((f) => f.kind === 'engagement');
  const expectedEmployers = resume ? checkResume(resume, facts).shown : new Set(employers);
  const groups = resume ? resume.sections.filter((s) => /project/i.test(s.title)).flatMap((s) => s.entries).filter((e) => e.head).map((e) => plain(e.head.parts[0])) : [];
  if (info) {
    for (const key of ['name', 'email']) if (info[key] && !same(form[key], info[key])) problems.push(`the form's ${key} "${form[key] ?? ''}" should be "${info[key]}"`);
    if (info.phone && digits(form.phone) !== digits(info.phone)) problems.push(`the form's phone "${form.phone ?? ''}" should be "${info.phone}"`);
    for (const key of ['linkedin', 'github']) if (info[key] && bareUrl(form[key]) !== bareUrl(info[key])) problems.push(`the form's ${key} "${form[key] ?? ''}" should be "${info[key]}"`);
  }
  const found = new Set();
  for (const job of form.work_history ?? []) {
    const employer = employers.find((f) => same(f.name, job.employer));
    if (!employer) {
      const client = engagements.find((f) => same(f.name, job.employer));
      if (client) problems.push(`the parser read the client "${job.employer}" as an employer (it was ${client.employer})`);
      else if (groups.some((g) => same(g, job.employer))) warnings.push(`the parser read "${job.employer}" (the Selected Projects group) as a job`);
      else problems.push(`the parser read "${job.employer}" as an employer, which no fact block has`);
      continue;
    }
    found.add(employer);
    if (!same(job.title, employer.title)) problems.push(`${employer.name}: the parser read the title "${job.title ?? ''}", not "${employer.title}"`);
    const want = factSpan(employer.dates);
    const got = { start: normalizeDate(job.start), end: normalizeDate(job.end) };
    if (got.start !== want.start || got.end !== want.end) problems.push(`${employer.name}: the parser read ${got.start} - ${got.end}, not ${want.start} - ${want.end}`);
  }
  for (const employer of employers) {
    if (expectedEmployers.has(employer) && !found.has(employer)) problems.push(`the parser missed the employer ${employer.name}`);
  }
  const schools = facts.filter((f) => f.kind === 'education');
  for (const ed of form.education ?? []) {
    const fact = schools.find((f) => same(f.name, ed.school));
    if (!fact) {
      problems.push(`the parser read the school "${ed.school}", which no fact block has`);
      continue;
    }
    if (ed.credential && !same(ed.credential, fact.credential)) problems.push(`${fact.name}: the parser read "${ed.credential}", not "${fact.credential}"`);
    const year = formatSpan(factSpan(fact.dates));
    if (ed.year && String(ed.year).trim() !== year) problems.push(`${fact.name}: the parser read ${ed.year}, not ${year}`);
  }
  return { problems, warnings };
}

function parseArgs(argv) {
  const opts = {};
  const named = { '--form': 'form', '--super-resume': 'superResume' };
  for (let i = 0; i < argv.length; i += 1) {
    if (named[argv[i]]) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) return null;
      opts[named[argv[i]]] = argv[(i += 1)];
    } else if (argv[i].startsWith('--') || opts.source) return null;
    else opts.source = argv[i];
  }
  return opts.source ? opts : null;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts) {
    console.error('Usage: node scripts/check-resume.mjs <resume.md> [--form <form.json>] [--super-resume <file>]');
    process.exit(2);
  }
  let superResume = opts.superResume;
  if (!superResume) {
    try {
      superResume = loadConfig().paths.superResume;
    } catch (err) {
      if (!(err instanceof ConfigError)) throw err;
      console.error(err.message);
      process.exit(2);
    }
  }
  for (const file of [opts.source, superResume, opts.form].filter(Boolean)) {
    if (!existsSync(file)) {
      console.error(`No file at ${file}.`);
      process.exit(2);
    }
  }
  const srText = readFileSync(superResume, 'utf8');
  const facts = parseFactBlocks(srText);
  const info = candidateInfo(srText);
  let resume;
  try {
    resume = parseResume(readFileSync(opts.source, 'utf8'));
  } catch (err) {
    if (!(err instanceof ResumeFormatError)) throw err;
    console.error(`error: ${opts.source} doesn't follow the resume format: ${err.message}`);
    process.exit(1);
  }
  let result;
  if (opts.form) {
    let form;
    try {
      form = JSON.parse(readFileSync(opts.form, 'utf8'));
    } catch (err) {
      console.error(`error: ${opts.form} is not valid JSON: ${err.message}`);
      process.exit(1);
    }
    result = checkForm(form, facts, { info, resume });
  } else {
    result = checkResume(resume, facts, info);
  }
  if (!info) result.warnings.push('the Super Resume has no "## Candidate Info" section, so contact details went unchecked');
  for (const w of result.warnings) console.error(`warning: ${w}`);
  for (const p of result.problems) console.error(`error: ${p}`);
  console.log(result.problems.length ? `${result.problems.length} mismatch(es) with the fact blocks.` : `${opts.form ? 'The parse-check form' : 'The resume'} matches the fact blocks.`);
  process.exit(result.problems.length ? 1 : 0);
}
