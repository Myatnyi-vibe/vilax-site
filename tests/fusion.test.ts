// Сцена слияния «Список и окно»: предметы не пересекаются, движение плавное, подписи и окно идут по раскадровке.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, BEAT, BEAT_END, captionState, intersectingPairs, poseAt, windowState, foldPath, GROUPS } from '../src/scenes/fusion/choreo.ts';
import { area, itemBox, layoutAt, overlapArea } from './helpers/screen.ts';

const STEP = 0.0005;
/** Экраны компьютера, на которых проверяем раскладку: обычный, 5:4, большой, маленький. */
const SCREENS: Array<[number, number]> = [
  [1440, 900],
  [1280, 1024],
  [1920, 1080],
  [1024, 768],
];

test('предметы не пересекаются ни при какой доле прокрутки (OBB, шаг 0,0005)', () => {
  const bad: string[] = [];
  for (let p = 0; p <= 1 + 1e-9; p += STEP) {
    for (const [i, j] of intersectingPairs(p)) bad.push(`p=${p.toFixed(4)} ${ITEMS[i].kind}#${i} × ${ITEMS[j].kind}#${j}`);
  }
  assert.deepEqual(bad.slice(0, 12), []);
});

test('движение плавное: видимый предмет смещается за шаг не больше 0,15', () => {
  const bad: string[] = [];
  for (let i = 0; i < ITEMS.length; i++) {
    let prev = poseAt(i, 0);
    for (let p = STEP; p <= 1 + 1e-9; p += STEP) {
      const cur = poseAt(i, p);
      const visible = prev.s > 0.02 && cur.s > 0.02;
      const d = Math.hypot(cur.x - prev.x, cur.y - prev.y, cur.z - prev.z);
      if (visible && d > 0.15) bad.push(`${ITEMS[i].kind}#${i} p=${p.toFixed(4)} шаг ${d.toFixed(2)}`);
      prev = cur;
    }
  }
  assert.deepEqual(bad.slice(0, 12), []);
});

test('в финале на сцене нет ни одного предмета', () => {
  for (let i = 0; i < ITEMS.length; i++) assert.equal(poseAt(i, 0.8).s, 0, `${ITEMS[i].kind}#${i}`);
});

test('пункты списка появляются по тактам, финальная подпись — только в конце', () => {
  const c0 = captionState(0.01, 0.5);
  assert.equal(c0.items[0].opacity, 1);
  assert.equal(c0.items[4].opacity, 0);
  const c = captionState(BEAT[4] + 0.05, 0.5);
  assert.ok(c.items[4].opacity > 0.99);
  assert.ok(c.items[0].opacity < 0.6 && c.items[0].opacity > 0.4);
  assert.equal(captionState(0.5, 0.5).final, 0);
  assert.equal(captionState(0.95, 0.5).final, 1);
  assert.ok(captionState(0.75, 0.5).merge > 0.99);
  assert.equal(captionState(0.7, 0.5).merge, 0);
  assert.equal(GROUPS.length, captionState(0.3, 0.5).items.length);
});

test('окно открывается на 0,60–0,645, складывается к 0,825 и уступает место знаку', () => {
  assert.equal(windowState(0.59).html, 0);
  assert.equal(windowState(0.7).html, 1);
  assert.equal(windowState(0.8).svg, true);
  assert.equal(windowState(0.9).svg, false);
  assert.equal(windowState(0.95).reveal, 1);
  assert.match(foldPath(1, 0).body, /540\.0 778\.0/);
  assert.doesNotMatch(foldPath(1, 0).body, /Z$/);
});

test('фразу «Мы собираем всё это…» не пересекает ни один предмет', () => {
  const bad: string[] = [];
  for (const [W, H] of SCREENS) {
    for (let p = 0.6; p <= 0.82; p += STEP) {
      if (captionState(p, 0.5).merge <= 0.02) continue;
      const { win } = layoutAt(p, W, H);
      const cx = (win.x0 + win.x1) / 2;
      const half = 0.55 * (win.x1 - win.x0);
      // строка фразы: от 28 до 70 px под окном, ширина с запасом на длинный английский вариант
      const band = { x0: cx - half, x1: cx + half, y0: win.y1 + 28, y1: win.y1 + 70 };
      ITEMS.forEach((it, i) => {
        const b = itemBox(i, p, W, H);
        if (b && overlapArea(b, band) > 0) bad.push(`${W}×${H} p=${p.toFixed(4)} ${it.kind}#${i}`);
      });
    }
  }
  assert.deepEqual(bad.slice(0, 12), []);
});

test('в покое такта предметы разных групп не закрывают друг друга больше чем на треть', () => {
  const bad: string[] = [];
  for (const [W, H] of SCREENS) {
    for (let g = 0; g < GROUPS.length; g++) {
      // въезд группы (первые 0,06 такта) не считаем: предмет может пройти перед соседом
      const next = g < GROUPS.length - 1 ? BEAT[g + 1] : BEAT_END;
      for (let p = BEAT[g] + 0.06; p <= next; p += 0.0025) {
        const boxes = ITEMS.map((_, i) => itemBox(i, p, W, H));
        for (let i = 0; i < ITEMS.length; i++) {
          for (let j = i + 1; j < ITEMS.length; j++) {
            const a = boxes[i];
            const b = boxes[j];
            if (!a || !b || ITEMS[i].group === ITEMS[j].group) continue;
            const cover = overlapArea(a, b) / Math.min(area(a), area(b));
            if (cover > 0.35) bad.push(`${W}×${H} p=${p.toFixed(3)} ${ITEMS[i].kind}#${i} × ${ITEMS[j].kind}#${j} ${cover.toFixed(2)}`);
          }
        }
      }
    }
  }
  assert.deepEqual(bad.slice(0, 12), []);
});
