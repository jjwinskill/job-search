// Parses a Generated Resume's Markdown source (resume.md) and turns it into the HTML the resume template prints.
// The source has a fixed shape (docs/resume-format.md): the writer owns the words, this file and the CSS own the layout.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const CSS_PATH = fileURLToPath(new URL('../templates/resume.css', import.meta.url));

const MONTH = '(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)';
// "Apr 2016 - Apr 2026", "Sep 2026 – Present", "2013 - 2014" or a single year.
export const DATE_RANGE = new RegExp(`^((${MONTH} )?\\d{4})(\\s*[-–—]\\s*((${MONTH} )?\\d{4}|Present))?$`, 'i');

// "Other clients: A, B" closes the client above it and belongs to the whole entry.
export const OTHER_LINE = /^(\*\*)?Other [^:]{1,30}:/i;
// Sections whose list items print as plain lines rather than bullets.
export const LINE_SECTIONS = /skill|education|certif/i;

export class ResumeFormatError extends Error {}

// Splits "A | B | Apr 2016 - Apr 2026" into its parts, taking a trailing date range out as `dates`.
export function splitHead(text) {
  const parts = text.split(/\s+\|\s+/).map((p) => p.trim());
  const dates = parts.length > 1 && DATE_RANGE.test(parts.at(-1)) ? parts.pop() : '';
  return { parts, dates };
}

// Some parsers stumble on en and em dashes inside a date range, so ranges print with a plain hyphen.
export const displayDates = (dates) => dates.replace(/\s*[-–—]\s*/, ' - ');

/**
 * resume.md -> { name, headline, contact: [line], sections: [section] }
 * section: { title, intro: [block], entries: [entry] }
 * entry (###): { head: { parts, dates } | null, intro: [block], subs: [sub], after: [block] }
 * sub (####): { head, blocks: [block] }
 * block: { type: 'p', text } | { type: 'ul', items: [text] }. A bullet's continuation lines are indented.
 */
export function parseResume(markdown) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const resume = { name: '', headline: '', contact: [], sections: [] };
  let section = null;
  let entry = null;
  let sub = null;
  let para = null;
  let list = null;
  const fail = (i, why) => {
    throw new ResumeFormatError(`line ${i + 1}: ${why}\n  ${lines[i]}`);
  };
  const target = () => (sub ? sub.blocks : entry ? (entry.subs.length ? entry.after : entry.intro) : section.intro);
  const close = () => {
    para = null;
    list = null;
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) return close();
    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (heading) {
      close();
      const [, hashes, text] = heading;
      if (hashes === '#') {
        if (resume.name || section) fail(i, 'only one `#` heading, the name, at the top');
        resume.name = text.trim();
      } else if (hashes === '##') {
        section = { title: text.trim(), intro: [], entries: [] };
        resume.sections.push(section);
        entry = null;
        sub = null;
      } else if (hashes === '###') {
        if (!section) fail(i, '`###` entries go inside a `##` section');
        entry = { head: splitHead(text.trim()), intro: [], subs: [], after: [] };
        section.entries.push(entry);
        sub = null;
      } else if (hashes === '####') {
        if (!section) fail(i, '`####` lines go inside a `##` section');
        if (!entry) {
          entry = { head: null, intro: [], subs: [], after: [] };
          section.entries.push(entry);
        }
        sub = { head: text.trim(), blocks: [] };
        entry.subs.push(sub);
      } else {
        fail(i, 'headings go no deeper than `####`');
      }
      return undefined;
    }
    if (!resume.name) fail(i, 'the file starts with `# <name>`');
    if (!section) {
      // Between the name and the first section: an optional headline, then contact lines.
      const looksLikeContact = / \| |@|\]\(|\d{3}/.test(line);
      if (!resume.headline && !resume.contact.length && !looksLikeContact) resume.headline = line.trim();
      else resume.contact.push(line.trim());
      return undefined;
    }
    const bullet = /^[-*] (.+)$/.exec(line);
    if (bullet) {
      para = null;
      if (!list) {
        list = { type: 'ul', items: [] };
        target().push(list);
      }
      list.items.push(bullet[1].trim());
      return undefined;
    }
    if (/^\s+\S/.test(line) && list) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      return undefined;
    }
    if (/^\s*([-*+]|\d+\.)\s/.test(line)) fail(i, 'bullets start at the left margin with `- `');
    list = null;
    if (para) {
      para.text += ` ${line.trim()}`;
      return undefined;
    }
    para = { type: 'p', text: line.trim() };
    if (entry && OTHER_LINE.test(para.text)) {
      sub = null;
      entry.after.push(para);
    } else {
      target().push(para);
    }
    return undefined;
  });
  if (!resume.name) throw new ResumeFormatError('the file starts with `# <name>`');
  return resume;
}

export const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The only inline Markdown a resume uses: links, **bold** and *italic*. Anything else prints as written.
export function inline(text) {
  const links = [];
  const s = escapeHtml(String(text).replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, label, href) => {
    links.push(`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`);
    return `\u0000${links.length - 1}\u0000`;
  }))
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?![*\w])/g, '$1<em>$2</em>')
    .replace(/(^|[^_\w])_([^_\s][^_]*)_(?![_\w])/g, '$1<em>$2</em>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, n) => links[Number(n)]);
}

// The text of an inline string as a reader or parser sees it.
export const plain = (text) => String(text)
  .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1')
  .replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?![*\w])/g, '$1$2')
  .replace(/(^|[^_\w])_([^_\s][^_]*)_(?![_\w])/g, '$1$2');

function blockHtml(block, lines = false) {
  if (block.type === 'p') return `<p${OTHER_LINE.test(block.text) ? ' class="other"' : ''}>${inline(block.text)}</p>`;
  if (lines) return block.items.map((item) => `<p class="line">${inline(item)}</p>`).join('\n');
  return `<ul>${block.items.map((item) => `<li>${inline(item)}</li>`).join('')}</ul>`;
}

// Splits off the first bullet (or block) so it can stay on the page with the heading above it.
function splitLead(blocks) {
  const [first, ...rest] = blocks;
  if (!first) return { lead: '', rest: '' };
  if (first.type === 'ul' && first.items.length > 1) {
    rest.unshift({ type: 'ul', items: first.items.slice(1) });
    return { lead: blockHtml({ type: 'ul', items: first.items.slice(0, 1) }), rest: rest.map((b) => blockHtml(b)).join('\n') };
  }
  return { lead: blockHtml(first), rest: rest.map((b) => blockHtml(b)).join('\n') };
}

function headHtml({ parts, dates }) {
  const [title, ...more] = parts;
  const rest = more.length ? `<span class="entry-role"> | ${more.map(inline).join(' | ')}</span>` : '';
  const when = dates ? `<span class="entry-dates">${escapeHtml(displayDates(dates))}</span>` : '';
  return `<div class="entry-head"><span class="entry-title"><strong>${inline(title)}</strong>${rest}</span>${when}</div>`;
}

// "Client: Name — Role | Domain": the name carries the weight and the rest reads as body text.
function subParts(sub) {
  const m = /^(Client:\s*)?([^—|]+?)(\s+[—|]\s+.*)?$/.exec(sub.head);
  const head = m
    ? `${m[1] ? `<span class="label">${escapeHtml(m[1].trim())}</span> ` : ''}<strong>${inline(m[2])}</strong>${m[3] ? `<span class="sub-role">${inline(m[3])}</span>` : ''}`
    : inline(sub.head);
  const { lead, rest } = splitLead(sub.blocks);
  return { lead: `<div class="lead"><p class="sub-head">${head}</p>${lead}</div>`, rest };
}

function entryHtml(entry) {
  let n = 0;
  while (entry.intro[n]?.type === 'p') n += 1;
  const notes = entry.intro.slice(0, n).map((b) => `<p class="entry-note">${inline(b.text)}</p>`).join('');
  // The heading, its descriptor and the first client (or first bullet) stay together, so no heading is stranded.
  let lead = `${entry.head ? headHtml(entry.head) : ''}${notes}`;
  let body = '';
  const subs = entry.subs.map(subParts);
  if (entry.intro.length > n) {
    const split = splitLead(entry.intro.slice(n));
    lead += split.lead;
    body = split.rest;
  } else if (subs.length) {
    // Only the first client's heading and first bullet join the lead; its other bullets flow across the page break.
    const first = subs.shift();
    lead += first.lead;
    body = first.rest;
  }
  return `<div class="entry"><div class="lead">${lead}</div>${body}${subs.map((p) => `<div class="sub">${p.lead}${p.rest}</div>`).join('\n')}${entry.after.map((b) => blockHtml(b)).join('\n')}</div>`;
}

export function toHtml(resume, css = readFileSync(CSS_PATH, 'utf8')) {
  const out = [`<h1>${inline(resume.name)}</h1>`];
  if (resume.headline) out.push(`<p class="headline">${inline(resume.headline)}</p>`);
  for (const line of resume.contact) out.push(`<p class="contact">${line.split(/\s+\|\s+/).map(inline).join(' &nbsp;|&nbsp; ')}</p>`);
  for (const section of resume.sections) {
    const lines = LINE_SECTIONS.test(section.title);
    out.push(`<section${section.entries.length ? '' : ' class="keep"'}><h2>${inline(section.title)}</h2>`);
    for (const block of section.intro) out.push(blockHtml(block, lines));
    for (const entry of section.entries) out.push(entryHtml(entry));
    out.push('</section>');
  }
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(plain(resume.name))} — Resume</title>
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

// Changes whenever the template or the HTML it's fed changes, so a skim check can say which layout it saw.
export function templateVersion() {
  const hash = createHash('sha256');
  hash.update(readFileSync(CSS_PATH));
  hash.update(readFileSync(fileURLToPath(import.meta.url)));
  return hash.digest('hex').slice(0, 7);
}
