// Сборка src/data/media.json из media-required.json + shots-checks.json (B) + video-checks.json (C).
// Контракт — docs/media-contract.md (SITE-25). Режим: --mode local|preview|prod или VILAX_MODE (по умолчанию local).
// Снимки: local — недостающее заменяется заглушкой (только для разработки); preview/prod — ошибка, выход 1.
// Ролики: нет файлов — не ошибка (этап 1 выкладки), обложка сочетания показывает снимок блока.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const DATA = join(ROOT, 'src', 'data');

const argMode = process.argv.indexOf('--mode');
// --out <файл> — писать манифест не в src/data/media.json (для тестов).
const argOut = process.argv.indexOf('--out');
const mode = argMode > -1 ? process.argv[argMode + 1] : process.env.VILAX_MODE || 'local';
if (!['local', 'preview', 'prod'].includes(mode)) {
  console.error(`media: неизвестный режим ${mode}`);
  process.exit(1);
}

const readJson = (p, fallback) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback);
const req = readJson(join(DATA, 'media-required.json'));
const shotsChecks = readJson(join(DATA, 'shots-checks.json'), { version: 1, shots: [] });
const videoChecks = readJson(join(DATA, 'video-checks.json'), { version: 1, videos: [] });

/** Размер webp: VP8 / VP8L / VP8X. */
export function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
  return null;
}

const errors = [];
const missing = [];
const missingVideo = [];
const failed = [];
const out = { version: 1, mode, shots: {}, video: {}, missing, missingVideo, failed };

// --- снимки
const shotIndex = new Map();
for (const s of shotsChecks.shots || []) {
  const key = `${s.cur}/${s.lang}/${s.theme}/${s.id}`;
  if (shotIndex.has(key)) errors.push(`shots-checks: дубль ${key}`);
  shotIndex.set(key, s);
}
const { width: SW, height: SH } = req.shots.size;
for (const cur of ['rub', 'aed']) {
  out.shots[cur] = {};
  for (const id of req.shots[cur]) {
    out.shots[cur][id] = {};
    for (const lang of req.langs) {
      for (const theme of req.themes) {
        const key = `${cur}/${lang}/${theme}/${id}`;
        const variant = `${lang}-${theme}`;
        const rec = shotIndex.get(key);
        shotIndex.delete(key);
        const expected = `shots/${cur}/${lang}/${theme}/${id}.webp`;
        if (rec?.status === 'fail') {
          if (!rec.reason) errors.push(`снимок ${key}: fail без reason`);
          failed.push({ kind: 'shot', key, reason: rec.reason || '', bug: rec.bug || '' });
          continue;
        }
        let problem = '';
        if (!rec) problem = 'нет записи в shots-checks.json';
        else if (rec.status !== 'pass') problem = `status ${rec.status}`;
        else if (rec.file !== expected) problem = `file ${rec.file}, ожидается ${expected}`;
        else if (!existsSync(join(PUBLIC, expected))) problem = 'нет файла';
        else if (rec.checks && Object.values(rec.checks).some((v) => v !== true)) problem = 'не все checks = true';
        else {
          const size = webpSize(readFileSync(join(PUBLIC, expected)));
          if (!size || size.w !== SW || size.h !== SH) problem = `размер ${size ? `${size.w}×${size.h}` : '?'}, нужен ${SW}×${SH}`;
        }
        if (problem) {
          missing.push({ kind: 'shot', key, problem });
          if (mode === 'local') out.shots[cur][id][variant] = { src: null, w: SW, h: SH, placeholder: true };
          continue;
        }
        out.shots[cur][id][variant] = { src: expected, w: SW, h: SH, date: rec.capturedAt || '' };
      }
    }
  }
}
for (const key of shotIndex.keys()) errors.push(`shots-checks: лишняя запись ${key} (нет в media-required.json)`);

// --- ролики
const vIndex = new Map();
for (const v of videoChecks.videos || []) vIndex.set(`${v.cur}-${v.lang}-${v.theme}/${v.fmt}`, v);
for (const cur of req.video.currencies) {
  for (const lang of req.langs) {
    for (const theme of req.themes) {
      const combo = `${cur}-${lang}-${theme}`;
      out.video[combo] = {};
      for (const [fmt, spec] of Object.entries(req.video.formats)) {
        const key = `${combo}/${fmt}`;
        const rec = vIndex.get(key);
        vIndex.delete(key);
        if (rec?.status === 'fail') {
          if (!rec.reason) errors.push(`ролик ${key}: fail без reason`);
          failed.push({ kind: 'video', key, reason: rec.reason || '' });
          continue;
        }
        const entry = { w: spec.width, h: spec.height };
        let problem = '';
        if (!rec) problem = 'нет записи в video-checks.json';
        else if (rec.status !== 'pass') problem = `status ${rec.status}`;
        else if (rec.audio) problem = 'есть звук';
        else if (rec.checks && Object.values(rec.checks).some((x) => x !== true)) problem = 'не все checks = true';
        else {
          for (const ext of req.video.files) {
            const file = `video/hero-${combo}-${fmt}.${ext}`;
            if (rec.files?.[ext]?.file !== file) { problem = `${ext}: ожидается ${file}`; break; }
            if (!existsSync(join(PUBLIC, file))) { problem = `нет файла ${file}`; break; }
            const bytes = statSync(join(PUBLIC, file)).size;
            const max = ext === 'webm' || ext === 'mp4' ? spec.maxBytes : req.video.posterMaxBytes;
            if (bytes > max) { problem = `${file}: ${bytes} Б > ${max}`; break; }
            entry[ext] = file;
          }
        }
        if (problem) {
          // Этап 1 выкладки (слово Данила 14.10 ~22:10, журнал 22:12): ролика нет — не ошибка ни в одном режиме;
          // обложка этого сочетания показывает снимок блока своего же сочетания (heroPanel 'shot' прототипа).
          missingVideo.push({ key, problem });
          continue;
        }
        out.video[combo][fmt] = entry;
      }
    }
  }
}
for (const key of vIndex.keys()) errors.push(`video-checks: лишняя запись ${key}`);

writeFileSync(argOut > -1 ? process.argv[argOut + 1] : join(DATA, 'media.json'), JSON.stringify(out, null, 1) + '\n');

const strict = mode !== 'local';
if (strict && missing.length) {
  errors.push(`не хватает ${missing.length} вариантов медиа (режим ${mode}): ${missing.slice(0, 5).map((m) => `${m.key} — ${m.problem}`).join('; ')}${missing.length > 5 ? '; …' : ''}`);
}
const summary = `media: ${mode}; снимков нет ${missing.filter((m) => m.kind === 'shot').length}, роликов нет ${missingVideo.length} (обложка — снимок блока), не прошли ${failed.length}`;
if (errors.length) {
  console.error(`${summary}\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(summary + (missing.length && !strict ? ' (заглушки — только для разработки)' : ''));
