#!/usr/bin/env node
// Fetches a job description verbatim and writes it as Markdown, so every Application keeps the JD it was written against.
// Tries, in order: the live page's JobPosting structured data, the ATS's public API (Greenhouse, Lever, Ashby),
// the live page's main text, then the newest Wayback Machine snapshot (structured data, then text).
// Usage: node scripts/fetch-jd.mjs <url> [--out <file>]. Exit codes: 0 saved, 1 nothing usable found, 2 usage error.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', bull: '•' };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const n = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

// Good enough for job postings: headings, paragraphs, lists, emphasis and links survive; everything else becomes text.
export function htmlToMarkdown(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|svg|nav|head|template|iframe|button|form)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, inner) => `\n\n${'#'.repeat(Number(level))} ${inner.trim()}\n\n`)
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/?(p|div|section|article|ul|ol|table|tr|header|footer|main|blockquote)\b[^>]*>/gi, '\n\n')
    .replace(/<\/?(strong|b)\b[^>]*>/gi, '**')
    .replace(/<\/?(em|i)\b[^>]*>/gi, '_')
    .replace(/<a\b[^>]*href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${text.trim()}](${href})`)
    .replace(/<[^>]+>/g, '');
  s = decodeEntities(s)
    .split('\n')
    .map((line) => line.replace(/[ \t ]+/g, ' ').trim())
    .join('\n')
    .replace(/\*\*\s*\*\*/g, '')
    .replace(/\n-\s*\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

// Some sources send HTML escaped (`&lt;p&gt;`); decode it once, and only then, so literal `&lt;` in prose survives.
const unescapeHtml = (s) => (/<[a-z]/i.test(s) || !/&lt;[a-z/]/i.test(s) ? s : decodeEntities(s));

export function extractJobPosting(html) {
  for (const [, raw] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data;
    try {
      data = JSON.parse(raw.trim());
    } catch {
      try {
        data = JSON.parse(decodeEntities(raw.trim()));
      } catch {
        continue;
      }
    }
    const items = Array.isArray(data) ? data : data['@graph'] ?? [data];
    for (const item of items) {
      const type = item?.['@type'];
      if ((type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) && item.description) return item;
    }
  }
  return null;
}

export function postingToMarkdown(item) {
  const org = typeof item.hiringOrganization === 'object' ? item.hiringOrganization?.name : item.hiringOrganization;
  const place = [item.jobLocation].flat().filter(Boolean).map((loc) => {
    const a = loc.address ?? {};
    return [a.addressLocality, a.addressRegion, a.addressCountry?.name ?? a.addressCountry].filter((x) => typeof x === 'string' && x).join(', ');
  }).filter(Boolean).join('; ');
  const lines = [`**Title:** ${item.title ?? ''}`, `**Company:** ${org ?? ''}`];
  if (place) lines.push(`**Location:** ${place}`);
  if (item.jobLocationType) lines.push(`**Location type:** ${item.jobLocationType}`);
  if (item.datePosted) lines.push(`**Posted:** ${item.datePosted}`);
  const value = item.baseSalary?.value;
  if (value && (value.minValue || value.maxValue || value.value)) {
    const range = value.value ?? [value.minValue, value.maxValue].filter(Boolean).join('–');
    lines.push(`**Pay:** ${range} ${item.baseSalary.currency ?? ''} ${value.unitText ?? ''}`.replace(/\s+/g, ' ').trim());
  }
  return { title: item.title ?? '', company: org ?? '', markdown: `${lines.join('\n')}\n\n${htmlToMarkdown(unescapeHtml(item.description))}` };
}

// Public ATS APIs return the posting even when the page itself is a JavaScript shell.
export function atsApi(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const parts = u.pathname.split('/').filter(Boolean);
  if (/(^|\.)greenhouse\.io$/.test(u.hostname) && parts[1] === 'jobs' && parts[2]) {
    return { kind: 'Greenhouse', api: `https://boards-api.greenhouse.io/v1/boards/${parts[0]}/jobs/${parts[2]}` };
  }
  if (u.hostname === 'jobs.lever.co' && parts.length >= 2) {
    return { kind: 'Lever', api: `https://api.lever.co/v0/postings/${parts[0]}/${parts[1]}` };
  }
  if (u.hostname === 'jobs.ashbyhq.com' && parts.length >= 2) {
    return { kind: 'Ashby', api: `https://api.ashbyhq.com/posting-api/job-board/${parts[0]}?includeCompensation=true`, id: parts[1] };
  }
  return null;
}

function atsToMarkdown(kind, json, id) {
  if (kind === 'Greenhouse') {
    return { title: json.title ?? '', company: '', markdown: `**Title:** ${json.title ?? ''}\n**Location:** ${json.location?.name ?? ''}\n\n${htmlToMarkdown(unescapeHtml(json.content ?? ''))}` };
  }
  if (kind === 'Lever') {
    const lists = (json.lists ?? []).map((l) => `## ${l.text}\n\n${htmlToMarkdown(l.content ?? '')}`).join('\n\n');
    return { title: json.text ?? '', company: '', markdown: `**Title:** ${json.text ?? ''}\n**Location:** ${json.categories?.location ?? ''}\n\n${htmlToMarkdown(json.description ?? '')}\n\n${lists}\n\n${htmlToMarkdown(json.additional ?? '')}` };
  }
  const job = (json.jobs ?? []).find((j) => j.id === id || j.jobUrl?.includes(id));
  if (!job) return null;
  const pay = job.compensation?.compensationTierSummary;
  return { title: job.title ?? '', company: '', markdown: `**Title:** ${job.title}\n**Location:** ${job.location ?? ''}${pay ? `\n**Pay:** ${pay}` : ''}\n\n${htmlToMarkdown(job.descriptionHtml ?? '')}` };
}

// Structured data and ATS APIs are the posting itself, so a short one still counts; scraped page text must clear a higher bar.
export function looksLikeJd(markdown, minLength = 1200) {
  return markdown.length > minLength && /responsib|requir|qualif|you will|what you|you'll|experience/i.test(markdown);
}

// Page text is the last resort, so trim the page chrome: start at the first H1 (job pages title the posting with one)
// and drop lines that are leaked script rather than prose.
export function pageToJd(html) {
  const main = /<main\b[^>]*>([\s\S]*)<\/main>/i.exec(html) ?? /<body\b[^>]*>([\s\S]*)<\/body>/i.exec(html);
  let md = htmlToMarkdown(main ? main[1] : html);
  const h1 = md.search(/^# /m);
  if (h1 > 0 && h1 < md.length * 0.3) md = md.slice(h1);
  const isCode = (line) => /function\s*\(|=>|\)\s*\{|\}\s*\(|\bvar\s+\w+\s*=|document\.|window\.|\}\s*;|;\s*\}/.test(line);
  md = md
    .split('\n')
    .filter((line) => !isCode(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const title = /^# (.+)$/m.exec(md)?.[1].trim() ?? '';
  return { title, company: '', markdown: md };
}

async function realFetch(url) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(30000) });
  return { status: res.status, body: Buffer.from(await res.arrayBuffer()), finalUrl: res.url };
}

// A closed posting often redirects to the careers index; treat that page as "gone", not as the JD.
export function redirectedAway(requested, finalUrl) {
  if (!finalUrl) return false;
  try {
    const a = new URL(requested);
    const b = new URL(finalUrl);
    const id = a.pathname.split('/').filter(Boolean).pop() ?? '';
    return a.pathname !== b.pathname && !(id && finalUrl.includes(id));
  } catch {
    return false;
  }
}

// Wayback's raw (id_) snapshots can arrive still gzipped.
const asText = (body) => (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body).toString('utf8');

export async function fetchJd(url, { fetcher = realFetch } = {}) {
  const tried = [];
  const get = async (target) => {
    try {
      const res = await fetcher(target);
      if (res.status < 200 || res.status >= 300) return (tried.push(`${target} → HTTP ${res.status}`), null);
      if (redirectedAway(target, res.finalUrl)) return (tried.push(`${target} → redirected to ${res.finalUrl} (posting likely closed)`), null);
      return asText(res.body);
    } catch (err) {
      tried.push(`${target} → ${err.message}`);
      return null;
    }
  };
  const found = (result, source, how, min) => (result && looksLikeJd(result.markdown, min) ? { ...result, source, how } : null);

  const live = await get(url);
  const posting = live && extractJobPosting(live);
  let result = posting && found(postingToMarkdown(posting), url, 'live page, structured data', 300);
  if (result) return result;

  const ats = atsApi(url);
  if (ats) {
    const raw = await get(ats.api);
    try {
      result = raw && found(atsToMarkdown(ats.kind, JSON.parse(raw), ats.id), ats.api, `${ats.kind} API`, 300);
    } catch {
      tried.push(`${ats.api} → not JSON`);
    }
    if (result) return result;
  }

  if (live) {
    result = found(pageToJd(live), url, 'live page, text');
    if (result) return result;
    tried.push(`${url} → page has no recognizable job description`);
  }

  const cdx = await get(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(url)}&output=json&filter=statuscode:200&limit=-3`);
  let rows = [];
  try {
    rows = cdx ? JSON.parse(cdx).slice(1) : [];
  } catch {
    tried.push('Wayback CDX → not JSON');
  }
  for (const [, timestamp, original] of rows.reverse()) {
    const snap = await get(`https://web.archive.org/web/${timestamp}id_/${original}`);
    if (!snap) continue;
    const source = `https://web.archive.org/web/${timestamp}/${original}`;
    const p = extractJobPosting(snap);
    result = (p && found(postingToMarkdown(p), source, 'Wayback snapshot, structured data', 300))
      ?? found(pageToJd(snap), source, 'Wayback snapshot, text');
    if (result) return result;
  }
  if (!rows.length) tried.push('Wayback → no snapshots');
  return { tried };
}

export function toJdFile(url, result, today = new Date().toISOString().slice(0, 10)) {
  const heading = [result.title, result.company].filter(Boolean).join(' — ') || 'Job description';
  return `# ${heading}\n- Source URL: ${url}\n- Retrieved from: ${result.source} (${result.how})\n- Retrieved: ${today}\n\n${result.markdown.trim()}\n`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf('--out');
  const out = outIndex === -1 ? null : args[outIndex + 1];
  const url = args.find((a, i) => !a.startsWith('--') && (outIndex === -1 || i !== outIndex + 1));
  const validUrl = (() => {
    try {
      return Boolean(url && new URL(url));
    } catch {
      return false;
    }
  })();
  if (!validUrl || (outIndex !== -1 && !out)) {
    console.error('Usage: node scripts/fetch-jd.mjs <url> [--out <file>]  (the URL needs its https:// scheme)');
    process.exit(2);
  }
  const result = await fetchJd(url);
  if (!result.markdown) {
    console.error(`No job description found for ${url}. Tried:\n- ${result.tried.join('\n- ')}\nAsk the user to paste the posting text.`);
    process.exit(1);
  }
  const file = toJdFile(url, result);
  if (out) {
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, file);
    console.error(`Saved the JD from ${result.how} to ${out}.`);
  } else {
    process.stdout.write(file);
  }
}
