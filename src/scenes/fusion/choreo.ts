// Хореография сцены слияния «Список и окно» (решение владельца 10.10.2026, панель дизайна + два судьи).
// Чистый модуль: ни three, ни DOM — позы предметов, состояние окна, сгиб в знак и подписи как функции p.
// Пять болей по очереди, у каждой свой образ; в каждый момент движется только текущая группа, прошлые
// замирают и уходят в туман. Затем одно окно забирает всё, складывается в знак VILAX, под ним — подпись.
// Частиц нет. Предметы не пересекаются: проверяется тестом по OBB с шагом p 0,0005 (tests/fusion.test.ts).
import { clamp, easeInOutCubic, easeInQuad, easeOutCubic, frac, lerp, smoothstep } from './timeline.ts';

export type Kind = 'phone' | 'bubble' | 'receipt' | 'sticky' | 'doc' | 'clipboard' | 'sheet' | 'tablet' | 'laptopDoc' | 'phoneApp';
export type Group = 'chats' | 'debts' | 'reports' | 'tables' | 'services';

export interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  /** Масштаб; 0 — предмета не видно. */
  s: number;
}

/** Половины габаритов моделей после центровки (models.ts сверяет с геометрией в local). */
export const HALF: Record<Kind, [number, number, number]> = {
  phone: [0.46, 0.96, 0.06],
  phoneApp: [0.46, 0.96, 0.06],
  bubble: [1.0, 0.475, 0.07],
  receipt: [0.45, 1.03, 0.3],
  sticky: [0.575, 0.575, 0.13],
  doc: [0.85, 1.1, 0.05],
  clipboard: [0.8, 1.2, 0.06],
  sheet: [0.85, 1.1, 0.05],
  tablet: [1.2, 0.85, 0.035],
  laptopDoc: [1.2, 0.79, 1.03],
};

/** Предметы сцены по группам; порядок групп совпадает с порядком пунктов списка. */
export const ITEMS: Array<{ kind: Kind; group: Group; k: number }> = [
  { kind: 'phone', group: 'chats', k: 0 },
  { kind: 'bubble', group: 'chats', k: 1 },
  { kind: 'bubble', group: 'chats', k: 2 },
  { kind: 'bubble', group: 'chats', k: 3 },
  { kind: 'receipt', group: 'debts', k: 0 },
  { kind: 'receipt', group: 'debts', k: 1 },
  { kind: 'sticky', group: 'debts', k: 2 },
  { kind: 'doc', group: 'reports', k: 0 },
  { kind: 'clipboard', group: 'reports', k: 1 },
  { kind: 'doc', group: 'reports', k: 2 },
  { kind: 'sheet', group: 'tables', k: 0 },
  { kind: 'sheet', group: 'tables', k: 1 },
  { kind: 'sheet', group: 'tables', k: 2 },
  { kind: 'sheet', group: 'tables', k: 3 },
  { kind: 'tablet', group: 'services', k: 0 },
  { kind: 'laptopDoc', group: 'services', k: 1 },
  { kind: 'phoneApp', group: 'services', k: 2 },
];

export const GROUPS: Group[] = ['chats', 'debts', 'reports', 'tables', 'services'];
/** Начало такта каждой боли (пункт списка появляется тогда же). */
export const BEAT = [0, 0.12, 0.24, 0.36, 0.48];
export const BEAT_END = 0.6;
/** Окно открывается и забирает группы: сервисы первыми (оно открывается прямо на них), дальше снизу вверх. */
// нижние группы втягиваются до появления фразы сборки, чтобы не пролетать сквозь неё
export const PULL: Record<Group, number> = { services: 0.6, tables: 0.612, reports: 0.624, debts: 0.636, chats: 0.66 };
const PULL_DUR = 0.055;
const PULL_STAGGER = 0.01;

/** Окно в координатах сцены: ширина как у знака, верх на линии кончиков нитей. */
export const LOGO_W = 6.4;
export const LOGO_Y = 0.6;
/** Высота знака при ширине LOGO_W (пропорции viewBox 712 × 608). */
export const LOGO_H = (LOGO_W * 608) / 712;
export const WIN = { x0: -LOGO_W / 2, x1: LOGO_W / 2, y1: LOGO_Y + LOGO_H / 2, y0: LOGO_Y + LOGO_H / 2 - 4.0 };
/** То же окно в единицах viewBox знака (184 170 712 608): нижний край y = 615. */
export const WIN_VB = { x0: 184, x1: 896, y0: 170, y1: 170 + (4.0 / LOGO_H) * 608 };
export const VERTEX_VB = { x: 540, y: 778 };

const pose = (x: number, y: number, z: number, rx: number, ry: number, rz: number, s = 1): Pose => ({ x, y, z, rx, ry, rz, s });

/** Прошлая группа уходит в глубину и чуть уменьшается. */
function recede(q: Pose, from: number, p: number): Pose {
  const r = smoothstep(from, from + 0.04, p);
  q.z -= 2.2 * r;
  q.s *= 1 - 0.18 * r;
  return q;
}

function cubic(a: number[], b: number[], c: number[], d: number[], t: number): number[] {
  const u = 1 - t;
  return [0, 1, 2].map((i) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i]);
}

// ---- 1 · Миллион чатов: телефон и лента сообщений, которая всё лезет вверх и тает в тумане ----
const THREAD = [
  [6.25, 2.4, 0.6],
  [5.75, 3.4, -0.6],
  [5.2, 4.5, -3.4],
  [4.4, 5.6, -7.0],
];
function chats(k: number, p: number): Pose {
  if (k === 0) return recede(pose(6.7, 0.9, 0.4, 0.05, -0.4, 0.06), 0.15, p);
  // два новых сообщения за такт, ещё четверть после — и лента замирает
  const F = 2 * clamp(p / 0.12) + 0.25 * clamp((p - 0.12) / 0.03);
  const u = frac((k - 1) / 3 + F);
  const [x, y, z] = cubic(THREAD[0], THREAD[1], THREAD[2], THREAD[3], u);
  const s = smoothstep(0, 0.12, u) * (1 - smoothstep(0.8, 1, u));
  return recede(pose(x, y, z, -0.25 - 0.3 * u, -0.3, k % 2 ? 0.05 : -0.05, s), 0.15, p);
}

// ---- 2 · Долги: веер неоплаченных чеков и стикер с суммой ----
function debts(k: number, p: number): Pose {
  const enter = smoothstep(0.12, 0.17, p);
  const fan = easeOutCubic(smoothstep(0.155, 0.195, p));
  const on = smoothstep(0.12, 0.124, p);
  if (k < 2) {
    const a = (k === 0 ? 0.3 : -0.3) * fan;
    const px = 6.0;
    const py = -5.5 - (1 - enter) * 4.5;
    const reach = 1.85;
    const q = pose(px - Math.sin(a) * reach + (k === 0 ? -0.5 : 0.5), py + Math.cos(a) * reach, k === 0 ? -1.05 : 0, 0.05, -0.3, a, on);
    return recede(q, 0.27, p);
  }
  const d = easeOutCubic(smoothstep(0.185, 0.215, p));
  const q = pose(lerp(7.0, 6.1, d), lerp(0.6, -2.7, d), lerp(1.6, 0.9, d), 0.05, -0.3, lerp(-0.6, -0.14, d), smoothstep(0.183, 0.188, p));
  return recede(q, 0.27, p);
}

// ---- 3 · Отчёты: стопка растёт, каждый новый влетает слева и ложится перед прошлым ----
const REPORT_SLOTS = [
  [-6.6, -2.4, -1.6],
  [-5.65, -3.0, -0.55],
  [-4.7, -3.6, 0.5],
];
function reports(k: number, p: number): Pose {
  const st = 0.24 + k * 0.022;
  const t = smoothstep(st, st + 0.04, p);
  const [sx, sy, sz] = REPORT_SLOTS[k];
  // влетает слева в своём слое глубины, чтобы не задеть уже лежащие
  const q = pose(lerp(-12.5, sx, t), lerp(sy + 1.2, sy, t), sz, lerp(-0.2, 0.05, t), 0.3, lerp(0.7, -0.05, t), smoothstep(st, st + 0.004, p));
  return recede(q, 0.39, p);
}

// ---- 4 · Бесконечные таблицы: конвейер листов выходит из тумана к зрителю, темп растёт ----
const CONV_F = [-0.9, -3.5, 1.2];
const CONV_B = [-2.2, -1.5, -15];
function tables(k: number, p: number): Pose {
  // темп растёт: каждый следующий лист выходит быстрее
  const t4 = clamp((p - 0.36) / 0.12);
  const F = 1.2 * (0.5 * t4 + 0.5 * easeInQuad(t4)) + 0.25 * clamp((p - 0.48) / 0.03);
  const v = frac(k / 4 - F + 8);
  const light = smoothstep(0.355 + 0.012 * (3 - k), 0.385 + 0.012 * (3 - k), p);
  const s = light * smoothstep(0, 0.12, v) * (1 - smoothstep(0.9, 1, v));
  const flip = 1 - smoothstep(0, 0.16, v);
  const q = pose(lerp(CONV_F[0], CONV_B[0], v), lerp(CONV_F[1], CONV_B[1], v), lerp(CONV_F[2], CONV_B[2], v), 0.12 + 1.25 * flip, 0.18, 0, s);
  return recede(q, 0.51, p);
}

// ---- 5 · Непонятные сервисы: три устройства по центру, каждое смотрит в свою сторону ----
const SERVICE_BASE = [
  { at: [0, 1.25, -1.6], rot: [0, 0.45, -0.08], from: [0, 7.8, -2.4] },
  { at: [2.8, -0.5, -0.4], rot: [0.3, -0.5, 0], from: [2.8, -8.6, -0.4] },
  { at: [0.5, -2.5, 1.3], rot: [0.1, 0.35, 0.22], from: [0.5, -8.4, 1.3] },
];
function services(k: number, p: number): Pose {
  const b = SERVICE_BASE[k];
  const e = smoothstep(0.48 + 0.012 * k, 0.53 + 0.012 * k, p);
  const wobble = smoothstep(0.49, 0.51, p) * (1 - smoothstep(0.585, 0.6, p));
  return pose(
    lerp(b.from[0], b.at[0], e),
    lerp(b.from[1], b.at[1], e),
    lerp(b.from[2], b.at[2], e),
    b.rot[0] + 0.12 * Math.sin(7 * p + k) * wobble,
    b.rot[1] + 0.35 * Math.sin(9 * p + 2.1 * k) * wobble,
    b.rot[2],
    smoothstep(0.48 + 0.012 * k, 0.484 + 0.012 * k, p),
  );
}

const GROUP_POSE: Record<Group, (k: number, p: number) => Pose> = { chats, debts, reports, tables, services };

/** Очередь втягивания внутри группы: первым уходит ближний к зрителю, чтобы дальние не пролетали сквозь него. */
const PULL_RANK = ITEMS.map((it, i) => {
  const mates = ITEMS.map((x, j) => ({ x, j })).filter(({ x }) => x.group === it.group);
  const z = (j: number) => GROUP_POSE[ITEMS[j].group](ITEMS[j].k, PULL[it.group]).z;
  return mates.sort((a, b) => z(b.j) - z(a.j)).findIndex(({ j }) => j === i);
});
const pullStart = (i: number) => PULL[ITEMS[i].group] + PULL_RANK[i] * PULL_STAGGER;

/** Насколько предмет уже «вошёл» в окно (0…1). */
export function pullLocal(i: number, p: number): number {
  return clamp((p - pullStart(i)) / PULL_DUR);
}

/** Поза предмета i при доле прокрутки p. */
export function poseAt(i: number, p: number): Pose {
  const it = ITEMS[i];
  const start = pullStart(i);
  if (p <= start) return GROUP_POSE[it.group](it.k, p);
  const A = GROUP_POSE[it.group](it.k, start);
  const local = clamp((p - start) / PULL_DUR);
  if (local >= 1) return { ...A, s: 0 };
  // дальние предметы в тумане не летят через всю сцену — гаснут на месте
  if (A.z < -5) return { ...A, s: A.s * (1 - smoothstep(0, 0.6, local)) };
  const e = smoothstep(0, 1, local);
  const T = [clamp(A.x * 0.3, -2.3, 2.3), (WIN.y0 + WIN.y1) / 2 + clamp(A.y * 0.2, -1.1, 1.1), -1.8];
  const C = [0.35 * A.x, 0.35 * A.y + 1.6, 0.5 * A.z];
  const u = 1 - e;
  return {
    x: u * u * A.x + 2 * u * e * C[0] + e * e * T[0],
    y: u * u * A.y + 2 * u * e * C[1] + e * e * T[1],
    z: u * u * A.z + 2 * u * e * C[2] + e * e * T[2],
    rx: A.rx * u,
    ry: A.ry * u,
    rz: A.rz * u,
    s: A.s * (1 - 0.45 * e) * (1 - smoothstep(0.85, 1, local)),
  };
}

/** Камера: лёгкий сдвиг к текущей боли (не больше 0,45), затем наезд к окну и знаку; после 0,78 неподвижна. */
const TRUCK: Array<[number, number]> = [
  [0.4, 0.25],
  [0.4, -0.3],
  [-0.4, -0.25],
  [-0.1, -0.35],
  [0, 0.1],
];
export function cameraAt(p: number): { x: number; y: number; z: number } {
  let x = 0;
  let y = 0;
  for (let g = 0; g < 5; g++) {
    const a = g === 0 ? 1 : smoothstep(BEAT[g] - 0.02, BEAT[g] + 0.02, p);
    const next = g < 4 ? BEAT[g + 1] : BEAT_END;
    const w = a * (1 - smoothstep(next - 0.02, next + 0.02, p));
    x += w * TRUCK[g][0];
    y += w * TRUCK[g][1];
  }
  return { x, y, z: lerp(14.2, 13.5, smoothstep(0.62, 0.78, p)) };
}

/** Окно и его сгиб в знак. */
export function windowState(p: number) {
  const open = smoothstep(0.6, 0.645, p);
  const fold = easeInOutCubic(smoothstep(0.79, 0.825, p));
  return {
    /** HTML-окно над canvas (до передачи сгибу на 0,79). */
    html: p < 0.79 ? open : 0,
    scale: lerp(0.94, 1, easeOutCubic(open)),
    /** Сгиб — SVG в координатах знака. */
    svg: p >= 0.79 && p < 0.885,
    fold,
    fill: 1 - smoothstep(0.79, 0.825, p),
    radius: 1 - smoothstep(0.79, 0.8, p),
    brand: smoothstep(0.815, 0.835, p),
    top: 1 - smoothstep(0.8, 0.83, p),
    outline: 1 - smoothstep(0.85, 0.885, p),
    /** Знак проявляется от кончиков к вершине. */
    reveal: smoothstep(0.815, 0.865, p),
    settle: lerp(1.015, 1, smoothstep(0.86, 0.9, p)),
  };
}

/** Контур окна при сгибе: верхние углы на кончиках крайних нитей, нижние сходятся в вершину V. */
export function foldPath(k: number, r: number): { fill: string; body: string; top: string } {
  const { x0, x1, y0 } = WIN_VB;
  const y1 = WIN_VB.y1;
  const bl = [lerp(x0, VERTEX_VB.x, k), lerp(y1, VERTEX_VB.y, k)];
  const br = [lerp(x1, VERTEX_VB.x, k), lerp(y1, VERTEX_VB.y, k)];
  // бока изгибаются внутрь, как крайние нити знака
  const bow = 70 * k;
  const cl = [(x0 + bl[0]) / 2 + bow, (y0 + bl[1]) / 2 + bow * 0.4];
  const cr = [(x1 + br[0]) / 2 - bow, (y0 + br[1]) / 2 + bow * 0.4];
  const rr = Math.max(0, r);
  const f = (n: number) => n.toFixed(1);
  const sides =
    `Q${f(cr[0])} ${f(cr[1])} ${f(br[0])} ${f(br[1])} L${f(bl[0])} ${f(bl[1])} ` + `Q${f(cl[0])} ${f(cl[1])} ${f(x0)} ${f(y0 + rr)} Q${f(x0)} ${f(y0)} ${f(x0 + rr)} ${f(y0)}`;
  const fill = `M${f(x0 + rr)} ${f(y0)} L${f(x1 - rr)} ${f(y0)} Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + rr)} ${sides} Z`;
  // бока без верхней грани: верх гаснет отдельно, и в конце остаётся V, а не треугольник
  const body = `M${f(x1 - rr)} ${f(y0)} Q${f(x1)} ${f(y0)} ${f(x1)} ${f(y0 + rr)} ${sides}`;
  const top = `M${f(x0 + rr)} ${f(y0)} L${f(x1 - rr)} ${f(y0)}`;
  return { fill, body, top };
}

/** Подписи: вступление, пять пунктов списка, фраза сборки, финал. */
export function captionState(p: number, pastLevel: number) {
  const groupOf: Group[] = GROUPS;
  const items = groupOf.map((g, i) => {
    const reveal = i === 0 ? 1 : smoothstep(BEAT[i], BEAT[i] + 0.02, p);
    const next = i < 4 ? BEAT[i + 1] : BEAT_END;
    const past = smoothstep(next, next + 0.015, p);
    const exit = smoothstep(PULL[g], PULL[g] + 0.03, p);
    return {
      opacity: reveal * (1 - (1 - pastLevel) * past) * (1 - exit),
      y: 12 * (1 - reveal),
      x: -12 * exit,
    };
  });
  return {
    lead: 1 - smoothstep(0.6, 0.62, p),
    items,
    merge: smoothstep(0.705, 0.725, p) * (1 - smoothstep(0.785, 0.81, p)),
    final: smoothstep(0.87, 0.9, p),
  };
}

// ---------- проверка пересечений: ориентированные коробки (OBB) по теореме о разделяющей оси ----------

export function rotation(rx: number, ry: number, rz: number): number[][] {
  // порядок XYZ, как у Euler в three.js: R = Rx · Ry · Rz
  const [a, b, c, d, e, f] = [Math.cos(rx), Math.sin(rx), Math.cos(ry), Math.sin(ry), Math.cos(rz), Math.sin(rz)];
  return [
    [c * e, -c * f, d],
    [a * f + b * e * d, a * e - b * f * d, -b * c],
    [b * f - a * e * d, b * e + a * f * d, a * c],
  ];
}

/** Пересекаются ли две позы предметов (с учётом масштаба). */
export function obbIntersect(pa: Pose, ha: [number, number, number], pb: Pose, hb: [number, number, number]): boolean {
  const A = rotation(pa.rx, pa.ry, pa.rz);
  const B = rotation(pb.rx, pb.ry, pb.rz);
  const ea = ha.map((h) => h * pa.s);
  const eb = hb.map((h) => h * pb.s);
  const axA = [0, 1, 2].map((i) => [A[0][i], A[1][i], A[2][i]]);
  const axB = [0, 1, 2].map((i) => [B[0][i], B[1][i], B[2][i]]);
  const t = [pb.x - pa.x, pb.y - pa.y, pb.z - pa.z];
  const dot = (u: number[], v: number[]) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const cross = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const axes = [...axA, ...axB];
  for (const u of axA) for (const v of axB) axes.push(cross(u, v));
  for (const L of axes) {
    const len = Math.hypot(L[0], L[1], L[2]);
    if (len < 1e-6) continue;
    const ra = axA.reduce((s, ax, i) => s + Math.abs(dot(ax, L)) * ea[i], 0);
    const rb = axB.reduce((s, ax, i) => s + Math.abs(dot(ax, L)) * eb[i], 0);
    if (Math.abs(dot(t, L)) > ra + rb) return false;
  }
  return true;
}

/** Пары предметов, которые пересекаются при доле p (невидимые и уже скрытые окном не считаются). */
export function intersectingPairs(p: number): Array<[number, number]> {
  const poses = ITEMS.map((_, i) => poseAt(i, p));
  const pairs: Array<[number, number]> = [];
  const hidden = (i: number) => poses[i].s < 0.05 || pullLocal(i, p) > 0.45;
  for (let i = 0; i < ITEMS.length; i++) {
    if (hidden(i)) continue;
    for (let j = i + 1; j < ITEMS.length; j++) {
      if (hidden(j)) continue;
      if (obbIntersect(poses[i], HALF[ITEMS[i].kind], poses[j], HALF[ITEMS[j].kind])) pairs.push([i, j]);
    }
  }
  return pairs;
}

