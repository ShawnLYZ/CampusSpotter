import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { htmlToText, liveNationEventLinks, parseNewsRss } from './news.ts';

const rss = readFileSync(new URL('../fixtures/recorded/news-rss-bts.xml', import.meta.url), 'utf8');
const home = readFileSync(new URL('../fixtures/recorded/livenation-home.html', import.meta.url), 'utf8');

describe('parseNewsRss', () => {
  it('gives the titles, links and ISO publish dates of the recorded feed', () => {
    const items = parseNewsRss(rss);
    expect(items.length).toBeGreaterThanOrEqual(3);
    expect(items[0].title).toBe('BTS World Tour KL: two nights at Stadium Nasional Bukit Jalil - The Star');
    expect(items[0].link).toBe('https://news.example.my/articles/bts-world-tour-kl-stadium-nasional');
    expect(items[0].publishedAt).toBe('2026-10-20T02:00:00.000Z');
  });
  it('decodes entities and CDATA, and gives null for a missing or bad pubDate', () => {
    const xml = `<rss><channel><item><title><![CDATA[Tom &amp; Jerry &quot;Live&quot; &#39;26 &lt;KL&gt;]]></title><link>https://a.example/x?a=1&amp;b=2</link></item>
      <item><title>Plain</title><link>https://a.example/y</link><pubDate>not a date</pubDate></item></channel></rss>`;
    expect(parseNewsRss(xml)).toEqual([
      { title: `Tom & Jerry "Live" '26 <KL>`, link: 'https://a.example/x?a=1&b=2', publishedAt: null },
      { title: 'Plain', link: 'https://a.example/y', publishedAt: null },
    ]);
  });
  it('skips items without a link and returns [] for non-RSS input', () => {
    expect(parseNewsRss('<item><title>x</title></item>')).toEqual([]);
    expect(parseNewsRss('<html>nope</html>')).toEqual([]);
  });
});

describe('htmlToText', () => {
  it('strips a <script> block, styles and tags, decodes entities and collapses whitespace', () => {
    const html = '<html><head><style>p{color:red}</style><script>var secret = "x";</script></head><body><p>BTS &amp; friends</p>\n\n<div>12&nbsp;Dec</div></body></html>';
    expect(htmlToText(html)).toBe('BTS & friends 12 Dec');
  });
  it('leaves invalid numeric entities as they are instead of throwing', () => {
    expect(htmlToText('<p>a &#99999999; b &#x110000; c &#65;</p>')).toBe('a &#99999999; b &#x110000; c A');
    expect(parseNewsRss('<item><title>Bad &#x110000; title</title><link>https://a.example/z</link></item>')[0].title).toBe('Bad &#x110000; title');
  });
  it('caps at 20,000 characters by default, or at maxChars', () => {
    const big = `<p>${'a '.repeat(30_000)}</p>`;
    expect(htmlToText(big).length).toBe(20_000);
    expect(htmlToText(big, 10)).toBe('a a a a a ');
  });
});

describe('liveNationEventLinks', () => {
  it('gives the absolute, de-duplicated /event/ URLs', () => {
    const links = liveNationEventLinks(home, 'https://www.livenation.my/');
    expect(links[0]).toBe('https://www.livenation.my/event/bts-kuala-lumpur-2026-edp123456');
    expect(new Set(links).size).toBe(links.length);
    expect(links.every((l) => l.startsWith('https://www.livenation.my/') && l.includes('/event/'))).toBe(true);
    expect(links).not.toContain('https://www.livenation.my/about');
  });
  it('keeps at most 15', () => {
    const html = Array.from({ length: 20 }, (_, i) => `<a href="/event/e${i}">e</a>`).join('');
    const links = liveNationEventLinks(html, 'https://www.livenation.my/');
    expect(links.length).toBe(15);
    expect(links[0]).toBe('https://www.livenation.my/event/e0');
  });
});
