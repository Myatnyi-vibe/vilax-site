// sitemap.xml: обе версии и правовые страницы, пары ru/en через xhtml:link (hreflang).
import type { APIRoute } from 'astro';
import { SITE_URL, LEGAL_DOCS, homePath, legalPath, url as path } from '../lib/site';

type Entry = { loc: string; ru?: string; en?: string; xDefault?: boolean };

const entries: Entry[] = [
  { loc: path('/'), ru: homePath('ru'), en: homePath('en'), xDefault: true },
  { loc: homePath('ru'), ru: homePath('ru'), en: homePath('en'), xDefault: true },
  { loc: homePath('en'), ru: homePath('ru'), en: homePath('en'), xDefault: true },
  ...LEGAL_DOCS.flatMap((d) => [
    { loc: legalPath('ru', d), ru: legalPath('ru', d), en: legalPath('en', d) },
    { loc: legalPath('en', d), ru: legalPath('ru', d), en: legalPath('en', d) },
  ]),
];

function url(e: Entry): string {
  const alt = [
    e.ru && `<xhtml:link rel="alternate" hreflang="ru" href="${SITE_URL}${e.ru}"/>`,
    e.en && `<xhtml:link rel="alternate" hreflang="en" href="${SITE_URL}${e.en}"/>`,
    e.xDefault && `<xhtml:link rel="alternate" hreflang="x-default" href="${SITE_URL}${path('/')}"/>`,
  ].filter(Boolean);
  return `<url><loc>${SITE_URL}${e.loc}</loc>${alt.join('')}</url>`;
}

export const GET: APIRoute = () =>
  new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.map(url).join('\n')}\n</urlset>\n`,
    { headers: { 'Content-Type': 'application/xml; charset=utf-8' } },
  );
