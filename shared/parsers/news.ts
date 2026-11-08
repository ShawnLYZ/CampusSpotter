/** Parsers for the event-scan fallback sources: Google News RSS, generic HTML pages and the Live Nation listing. */

export interface NewsItem { title: string; link: string; publishedAt: string | null }

const NAMED: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ', ndash: '–', mdash: '—', copy: '©' };

/** The character for a numeric reference, or the reference unchanged when the code point is invalid. */
const codePoint = (ref: string, n: number): string => (Number.isInteger(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ref);

/** Decodes the named entities above and numeric (&#39; / &#x27;) references. `&amp;` goes last so "&amp;lt;" stays "&lt;". */
function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (ref, n) => codePoint(ref, Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (ref, n) => codePoint(ref, parseInt(n, 16)))
    .replace(/&(quot|apos|lt|gt|nbsp|ndash|mdash|copy);/g, (_, n: string) => NAMED[n])
    .replace(/&amp;/g, '&');
}

const tagText = (block: string, tag: string): string | null => {
  const m = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(block);
  if (!m) return null;
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(m[1]);
  return decodeEntities(cdata ? cdata[1] : m[1]).trim();
};

/** Items of an RSS feed (title, link, pubDate as ISO or null). Items without a link are skipped. */
export function parseNewsRss(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const link = tagText(m[1], 'link');
    if (!link) continue;
    const pub = tagText(m[1], 'pubDate');
    const t = pub ? Date.parse(pub) : NaN;
    out.push({ title: tagText(m[1], 'title') ?? '', link, publishedAt: Number.isNaN(t) ? null : new Date(t).toISOString() });
  }
  return out;
}

/** Visible text of an HTML page: no scripts, styles or tags, entities decoded, whitespace collapsed, at most maxChars. */
export function htmlToText(html: string, maxChars = 20_000): string {
  const text = html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(text).replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

/** Absolute, de-duplicated links to Live Nation event pages (href containing /event/), at most 15, in page order. */
export function liveNationEventLinks(html: string, base: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const href = decodeEntities(m[1]);
    if (!/\/event\//.test(href)) continue;
    let abs: string;
    try {
      abs = new URL(href, base).toString();
    } catch {
      continue;
    }
    if (!out.includes(abs)) out.push(abs);
    if (out.length === 15) break;
  }
  return out;
}
