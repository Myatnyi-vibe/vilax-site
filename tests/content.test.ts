// Сайт не обещает того, чего нет (ТЗ, «Содержание» и Р-4): у каждой функции в словарях — номер экрана реестра v16,
// статус live и проверка на стейдже под демо-сетью (src/data/verification.json), либо статус dev и «скоро» со сроком.
// Интеграции: работающие — только live, помеченные planned — только plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p: string) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));
const registry = read('src/data/registry-v16.json');
const verification = read('src/data/verification.json');
const byId = new Map<string, { id: string; status: string; name: string }>(registry.records.map((r: { id: string }) => [r.id, r]));
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

type Feature = { screen: string; verified?: string; soon?: string; title?: string };

/** Все объекты с полем screen и полем verified — строки о функциях. */
function features(value: unknown, out: Feature[] = []): Feature[] {
  if (Array.isArray(value)) value.forEach((v) => features(v, out));
  else if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (typeof o.screen === 'string' && 'verified' in o) out.push(o as Feature);
    Object.values(o).forEach((v) => features(v, out));
  }
  return out;
}

for (const lang of ['ru', 'en'] as const) {
  const dir = join(ROOT, 'src/content', lang);
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];

  for (const f of files) {
    const list = features(read(`src/content/${lang}/${f}`));
    if (!list.length) continue;
    test(`${lang}/${f}: каждая функция сверена с реестром и стейджем`, () => {
      const bad: string[] = [];
      for (const x of list) {
        const r = byId.get(x.screen);
        if (!r) { bad.push(`${x.screen}: нет в реестре v16`); continue; }
        if (r.status === 'live') {
          if (!DATE.test(x.verified ?? '')) bad.push(`${x.screen} «${x.title}»: нет даты проверки`);
          const v = verification.screens?.[x.screen]?.[lang];
          if (!v || v.result !== 'ok') bad.push(`${x.screen} «${x.title}»: нет успешной проверки на стейдже (${lang})`);
          else if (v.date !== x.verified) bad.push(`${x.screen}: дата в словаре ${x.verified} ≠ дата проверки ${v.date}`);
        } else if (r.status === 'dev') {
          if (!MONTH.test(x.soon ?? '')) bad.push(`${x.screen} «${x.title}»: статус dev — нужен срок «скоро» (Р-4), иначе не показываем`);
        } else bad.push(`${x.screen} «${x.title}»: статус ${r.status} — на сайт не идёт`);
      }
      assert.deepEqual(bad, []);
    });
  }

  test(`${lang}/integrations.json: работающие — live, «в плане» — plan`, () => {
    const p = `src/content/${lang}/integrations.json`;
    if (!existsSync(join(ROOT, p))) return;
    const d = read(p);
    const bad: string[] = [];
    for (const i of d.items ?? []) {
      const want = i.planned ? 'plan' : 'live';
      if (byId.get(i.screen)?.status !== want) bad.push(`${i.name} (${i.screen}): ожидается ${want}, в реестре ${byId.get(i.screen)?.status}`);
    }
    assert.deepEqual(bad, []);
  });
}

test('кейсы выключены, пока нет письменного согласия клиента (Р-14)', () => {
  for (const lang of ['ru', 'en']) {
    const s = read(`src/content/${lang}/sections.json`);
    const c = read(`src/content/${lang}/cases.json`);
    if (!c.items.length) assert.equal(s.enabled.cases, false);
  }
});

// Служебные адреса демо-аккаунтов (network/url) удалены из словаря для публичного репозитория;
// проверяем, что каждый снимок из verification.json лежит в public/shots.
test('снимки из проверки лежат в public/shots', () => {
  const bad: string[] = [];
  for (const [id, langs] of Object.entries(verification.screens ?? {}) as Array<[string, Record<string, { shot?: string }>]>) {
    for (const [lang, v] of Object.entries(langs)) {
      if (v.shot && !existsSync(join(ROOT, 'public', v.shot))) bad.push(`${id}/${lang}: нет файла public${v.shot}`);
    }
  }
  assert.deepEqual(bad, []);
});

test('снимки блоков: путь пустой или файл лежит в public', () => {
  const bad: string[] = [];
  for (const lang of ['ru', 'en']) {
    for (const it of read(`src/content/${lang}/blocks.json`).items) {
      if (it.shot?.src && !existsSync(join(ROOT, 'public', it.shot.src))) bad.push(`${lang}/${it.key}: нет public${it.shot.src}`);
    }
  }
  assert.deepEqual(bad, []);
});

// SITE-5: пометки needsReview (src/data/needs-review-en.json) указывают на живые строки словаря en.
test('needsReview: каждая пометка указывает на существующую строку en с тем же текстом', () => {
  const list = read('src/data/needs-review-en.json');
  const bad: string[] = [];
  for (const it of list.items as Array<{ file?: string; path?: string; shot?: string; text: string }>) {
    if (it.shot) {
      if (!existsSync(join(ROOT, 'public', it.shot))) bad.push(`${it.shot}: нет файла`);
      continue;
    }
    let v: unknown = read(`src/content/en/${it.file}`);
    for (const part of (it.path ?? '').match(/[^.[\]]+/g) ?? []) v = (v as Record<string, unknown> | undefined)?.[/^\d+$/.test(part) ? Number(part) : part];
    if (v !== it.text) bad.push(`${it.file} ${it.path}: в словаре «${String(v)}»`);
  }
  assert.deepEqual(bad, []);
});

// Цифры в словарях не пишем (FORMAT.md): ставка налога — подстановкой {taxRate} из prices.json.
test('вопросы: ставка НДС не записана цифрой', () => {
  for (const lang of ['ru', 'en']) {
    const bad = read(`src/content/${lang}/faq.json`).items.flatMap((x: { q: string; a: string }) => [x.q, x.a]).filter((s: string) => /\d\s?%/.test(s));
    assert.deepEqual(bad, [], lang);
  }
});

// Пример диалога с Координатором: пока ответ не записан на стейдже (у t104 нет снимка), конкретных цифр в нём нет.
test('AI: пример диалога без цифр, пока ответ Координатора не записан на стейдже', () => {
  for (const lang of ['ru', 'en'] as const) {
    if (verification.screens?.t104?.[lang]?.shot) continue;
    const msgs = read(`src/content/${lang}/ai.json`).chat?.messages ?? [];
    const bad = msgs.map((m: { text: string }) => m.text).filter((t: string) => /\d/.test(t));
    assert.deepEqual(bad, [], lang);
  }
});
