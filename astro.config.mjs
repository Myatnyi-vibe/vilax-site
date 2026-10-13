// @ts-check
import { defineConfig } from 'astro/config';

// Режим сборки задаёт только адрес приёмника заявок и плашку (ТЗ, «Сайт: режимы сборки»).
// local — заявки в локальный стенд трекера; preview — форма в режиме показа, страницы закрыты от поисковиков;
// prod — боевой vilax.ai. Адрес приёмника приходит из окружения при сборке (PUBLIC_VILAX_LEAD_URL), в код не вшивается.
const MODES = ['local', 'preview', 'prod'];
const mode = process.env.VILAX_MODE || 'local';
if (!MODES.includes(mode)) throw new Error(`VILAX_MODE=${mode}: ожидается ${MODES.join(' | ')}`);

// Превью в GitHub Pages живёт под подпутём: VILAX_SITE=https://myatnyi-vibe.github.io VILAX_BASE=/vilax-site
// (.github/workflows/preview.yml). Прод — только корень vilax.ai.
const site = process.env.VILAX_SITE || 'https://vilax.ai';
const base = process.env.VILAX_BASE || '/';
if (mode === 'prod' && (site !== 'https://vilax.ai' || base !== '/')) {
  throw new Error(`VILAX_MODE=prod собирается только для https://vilax.ai в корне (VILAX_SITE=${site}, VILAX_BASE=${base})`);
}

export default defineConfig({
  site,
  base,
  // Lighthouse собирает в .lighthouse/dist, чтобы не трогать рабочий dist/.
  outDir: process.env.VILAX_OUT_DIR || './dist',
  // /privacy → privacy.html, /ru/ → ru/index.html: адреса нынешнего сайта не меняются.
  build: { format: 'preserve', inlineStylesheets: 'auto' },
  trailingSlash: 'ignore',
  compressHTML: true,
  devToolbar: { enabled: false },
  vite: {
    define: {
      'import.meta.env.VILAX_MODE': JSON.stringify(mode),
    },
  },
});
