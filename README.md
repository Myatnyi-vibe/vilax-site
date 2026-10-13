# vilax-site — сайт vilax.ai

Новый сайт VILAX: две версии — «Россия · Русский» (`/ru/`) и «International · English» (`/en/`), экран выбора на `/`.
Выкладка — только по команде владельца: превью на GitHub Pages — [docs/deploy/preview.md](docs/deploy/preview.md), боевой vilax.ai — [docs/deploy/prod.md](docs/deploy/prod.md).

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер на 4321 (B — `npm run dev -- --port 4322`, C — `--port 4323`) |
| `npm run check` | типы (`astro check`) → сборка `local` → тесты → проверка `dist/` |
| `npm run build:local` / `build:preview` / `build:prod` | сборка в режиме (см. ниже) |
| `npm test` | тесты `tests/**/*.test.ts` на встроенном `node:test` |
| `npm run lighthouse` | Lighthouse `/ru/` и `/en/` против бюджета ТЗ — только под HEAVY LOCK |

## Режимы сборки

`VILAX_MODE` = `local` (по умолчанию) · `preview` · `prod`. В коде — `src/lib/mode.ts` (`MODE`, `NOINDEX`).
Режим задаёт только адрес приёмника заявок и плашку. Адрес приёмника приходит из окружения при сборке и в код не вшивается.

## Где что лежит и чьё

| Путь | Что | Владелец |
|---|---|---|
| `src/pages/` | `/`, `/ru/`, `/en/`, `/privacy`, `/terms`, `/support`, `/ru/…`, `404` | A |
| `src/layouts/`, `src/components/` (кроме ниже), `src/themes/`, `src/scenes/` | каркас, темы-токены, секции, 3D | A |
| `src/i18n/{ru,en}.json` | строки каркаса: шапка, подвал, экран выбора, 404, подписи для дикторов | A |
| `src/content/{ru,en}/*.json` | словари секций, FAQ, контакты, юрблок | B |
| `src/data/`, `src/lib/pricing*`, `src/components/calculator/`, `public/shots/` | справочник цен, реестр v16, калькулятор, снимки демо | B |
| `src/content/{ru,en}/legal/` | правовые тексты (сейчас — копия нынешнего vilax.ai) | C |
| `src/components/demo-form/`, `src/lib/lead*` | форма «Запросить демо» | C |

Правила:

- В разметке нет видимых строк — только из словарей (`tests/templates.test.ts` ловит кириллицу в `.astro`).
- У каждого файла словаря в `ru` есть пара в `en` с тем же набором ключей; списки могут быть разной длины (`tests/dictionaries.test.ts`).
- В английских страницах (`/en/…`, `/privacy`, `/terms`, `/support`) нет ни одной русской буквы (`scripts/verify-dist.mjs`).
- Фиолетового нет (канон с 29.09.2026): `#7B5CFF` в сборке — ошибка.
- Компоненты цвета не задают — только переменные темы (`src/themes/ru.css`, `en.css`).

## Бренд

- `public/logo.svg`, `public/wordmark.svg` — знак и надпись VILAX, вынуты из `landing/index.html` платформы (символы `vlxMark`, `vlxWord`), градиент Data Cyan → Signal Blue без фиолетового. Контуры для встраивания — `src/components/brand/logo-paths.ts`.
- Шрифты — `public/fonts/`: Inter и JetBrains Mono, урезанные (латиница + кириллица), копии из платформы (`src/app/fonts`, SIL OFL 1.1).
- `public/google1e0ecdafaa681c29.html` — подтверждение Google Search Console, переносится как есть.
