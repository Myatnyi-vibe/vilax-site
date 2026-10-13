// Плоская версия сцены слияния для телефона (Р-3): та же история без WebGL — плоские предметы (canvas из faces.ts),
// пять болей по очереди, одно окно забирает всё и складывается в знак. Только transform и opacity, всё от p.
import { FACES, type FaceId, type Version } from './faces';
import { BEAT, BEAT_END, PULL, type Group } from './choreo';
import { applyLayers, findLayers, type Rect } from './layers';
import { clamp, frac, smoothstep } from './timeline';

function chip(id: FaceId, version: Version, px: number): HTMLCanvasElement {
  const face = FACES[id];
  const [w, h] = face.size;
  const scale = px / Math.max(w, h);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  c.width = Math.round(cw * dpr);
  c.height = Math.round(ch * dpr);
  c.style.width = `${cw}px`;
  c.style.height = `${ch}px`;
  c.className = `fx-chip fx-chip--${id}`;
  // рисуем в масштабе атласа (лицо ~484 px), чтобы толщины линий совпадали с 3D-версией
  const base = 484 / Math.max(w, h);
  const ctx = c.getContext('2d')!;
  ctx.scale((cw * dpr) / (w * base), (ch * dpr) / (h * base));
  face.draw(ctx, w * base, h * base, version);
  return c;
}

interface Chip {
  el: HTMLCanvasElement;
  group: Group;
  /** Положение покоя в долях ширины и высоты сцены и поворот в градусах. */
  at: [number, number];
  rot: number;
  /** Своё движение в такте: лента чата, стопка таблиц. */
  loop?: (p: number) => { dx: number; dy: number; s: number; o: number };
  /** Лента чата поднимается не выше низа списка болей. */
  rise?: boolean;
}

const GROUP_INDEX: Record<Group, number> = { chats: 0, debts: 1, reports: 2, tables: 3, services: 4 };

/** Плоская анимация для телефона: возвращает функцию кадра от доли прокрутки. */
export function mountFlat(stage: HTMLElement, version: Version, pastLevel: number): (p: number) => void {
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  stage.prepend(layer);
  const caps = stage.querySelector<HTMLElement>('.fusion__captions');
  const layers = findLayers(stage);
  const f = Math.min(1.25, stage.clientWidth / 390);
  const make = (id: FaceId, size: number) => {
    const el = chip(id, version, size * f);
    layer.append(el);
    return el;
  };

  // два новых сообщения за такт, ещё четверть после — и лента замирает (как в 3D)
  const chatF = (p: number) => 2 * clamp(p / 0.12) + 0.25 * clamp((p - 0.12) / 0.03);
  const bubbleLoop = (j: number) => (p: number) => {
    const u = frac(j / 3 + chatF(p));
    // лента поднимается от телефона, но не выше списка болей
    return { dx: -0.14 * u, dy: -0.12 * u, s: smoothstep(0, 0.12, u) * (1 - smoothstep(0.8, 1, u)), o: 1 };
  };
  const tableF = (p: number) => 1.2 * clamp((p - 0.36) / 0.12) + 0.25 * clamp((p - 0.48) / 0.03);
  const sheetLoop = (j: number) => (p: number) => {
    const v = frac(j / 3 - tableF(p) + 8);
    return { dx: 0, dy: -0.06 * v, s: (1 - 0.25 * v) * smoothstep(0, 0.1, 1 - v), o: 1 - 0.6 * v };
  };

  const chips: Chip[] = [
    { el: make('phone', 92), group: 'chats', at: [0.82, 0.58], rot: -6 },
    ...[0, 1, 2].map((j) => ({ el: make('bubble', 78), group: 'chats' as Group, at: [0.72, 0.52] as [number, number], rot: 3, loop: bubbleLoop(j), rise: true })),
    { el: make('receipt', 82), group: 'debts', at: [0.2, 0.66], rot: 14 },
    { el: make('receipt', 82), group: 'debts', at: [0.3, 0.66], rot: -12 },
    { el: make('sticky', 56), group: 'debts', at: [0.4, 0.58], rot: -8 },
    { el: make('doc', 80), group: 'reports', at: [0.17, 0.86], rot: -4 },
    { el: make('checklist', 74), group: 'reports', at: [0.27, 0.88], rot: 5 },
    ...[0, 1, 2].map((j) => ({ el: make('sheet', 78), group: 'tables' as Group, at: [0.78, 0.87] as [number, number], rot: 2, loop: sheetLoop(j) })),
    { el: make('tablet', 104), group: 'services', at: [0.48, 0.74], rot: -8 },
    { el: make('phoneApp', 80), group: 'services', at: [0.64, 0.66], rot: 11 },
  ];

  return (p: number) => {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    // окно и знак: ширина окна = ширина знака, верх окна = линия кончиков нитей
    const ww = Math.min(W * 0.78, 360);
    const wh = ww / 1.6;
    const win: Rect = { x: (W - ww) / 2, y: H * 0.6 - wh / 2, w: ww, h: wh };
    const mark: Rect = { x: win.x, y: win.y, w: ww, h: (ww * 608) / 712 };
    const cx = win.x + ww / 2;
    const cy = win.y + wh / 2;
    // на низких экранах лента чата короче: верх пузыря не заходит под список
    const listBottom = caps ? caps.offsetTop + caps.offsetHeight + 8 : 0;

    chips.forEach((c, n) => {
      const g = GROUP_INDEX[c.group];
      const start = BEAT[g];
      const next = g < 4 ? BEAT[g + 1] : BEAT_END;
      const appear = g === 0 ? 1 : smoothstep(start, start + 0.03, p);
      const past = smoothstep(next + 0.01, next + 0.04, p);
      const wobble = c.group === 'services' ? 6 * Math.sin(9 * p + n) * smoothstep(0.49, 0.51, p) * (1 - smoothstep(0.585, 0.6, p)) : 0;
      const loop = c.loop ? c.loop(p) : { dx: 0, dy: 0, s: 1, o: 1 };
      let x = (c.at[0] + loop.dx) * W;
      const room = c.rise ? clamp((c.at[1] * H - listBottom - c.el.offsetHeight / 2) / (0.12 * H)) : 1;
      let y = (c.at[1] + loop.dy * room) * H + 24 * (1 - appear);
      let s = loop.s * (1 - 0.08 * past);
      let o = appear * loop.o * (1 - 0.45 * past);
      // втягивание в окно: к центру, уменьшаясь; окно лежит сверху и прячет вошедшее
      const lag = 0.008 * (n % 4);
      const pull = smoothstep(PULL[c.group] + lag, PULL[c.group] + lag + 0.05, p);
      x += (cx - x) * pull;
      y += (cy - y) * pull;
      s *= 1 - 0.7 * pull;
      o *= 1 - smoothstep(0.7, 1, pull);
      c.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) rotate(${(c.rot * (1 - pull) + wobble).toFixed(2)}deg) scale(${Math.max(0, s).toFixed(3)})`;
      c.el.style.opacity = Math.max(0, o).toFixed(3);
    });
    applyLayers(layers, p, { win, mark }, pastLevel);
  };
}
