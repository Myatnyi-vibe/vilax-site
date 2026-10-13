// Лица предметов сцены слияния — рисуются кодом на canvas, без картинок и чужих логотипов (Р-8).
// Общие для 3D (атлас) и плоской версии на телефоне. Здесь нет three — модуль лёгкий.
// Версии различаются: English — зелёные чаты (в духе WhatsApp, без знаков), суммы в AED и с запятой;
// РФ — голубые чаты, суммы в ₽ и с пробелом.
import { rng } from './timeline';

export type Version = 'ru' | 'en';
type Ctx = CanvasRenderingContext2D;
type Draw = (ctx: Ctx, w: number, h: number, v: Version) => void;

export interface Face {
  /** Размер лица в единицах сцены: ширина, высота. */
  size: [number, number];
  draw: Draw;
  /** Шероховатость и металличность поверхности (0…1). */
  rough: number;
  metal?: number;
}

export interface Swatch {
  color: string | ((v: Version) => string);
  rough: number;
  metal?: number;
}

const PAPER = '#F3F5F8';
const INK = '#2A3445';
const MUTED = '#9AA6B6';
const LINE = '#D5DCE5';

const num = (n: number, v: Version) => (v === 'en' ? n.toLocaleString('en-US') : n.toLocaleString('ru-RU').replace(/\s/g, ' '));
const font = (px: number, weight = 500, mono = false) =>
  `${weight} ${Math.round(px)}px ${mono ? '"JetBrains Mono", ui-monospace, Consolas, monospace' : 'Inter, "Segoe UI", system-ui, sans-serif'}`;

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill?: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

/** Зерно бумаги: еле заметные точки, детерминированно. */
function grain(ctx: Ctx, w: number, h: number, seed: number, alpha = 0.05) {
  const rand = rng(seed);
  for (let i = 0; i < (w * h) / 90; i++) {
    ctx.fillStyle = rand() > 0.5 ? `rgba(0,0,0,${alpha * rand()})` : `rgba(255,255,255,${alpha * 2 * rand()})`;
    ctx.fillRect(rand() * w, rand() * h, 1.5, 1.5);
  }
}

function textLines(ctx: Ctx, x: number, y: number, w: number, step: number, n: number, color = LINE, lw = 5, seed = 1) {
  const rand = rng(seed);
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const len = i === n - 1 ? 0.45 + rand() * 0.2 : 0.78 + rand() * 0.22;
    rr(ctx, x, y + i * step, w * len, lw, lw / 2);
    ctx.fill();
  }
}

/** Таблица: шапка с буквами столбцов, номера строк, числа, итоговая строка. */
function grid(ctx: Ctx, x: number, y: number, w: number, h: number, v: Version, seed: number, accent = '#1E7B4A', rows = 13) {
  const rand = rng(seed);
  const cols = 5;
  const rowH = h / (rows + 1);
  const firstW = w * 0.08;
  const cw = (w - firstW) / cols;
  ctx.fillStyle = '#EAF3EE';
  ctx.fillRect(x, y, w, rowH);
  ctx.fillRect(x, y, firstW, h);
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(x, y + rowH * rows, w, rowH);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#CFDDD5';
  ctx.lineWidth = 2;
  for (let c = 0; c <= cols; c++) {
    ctx.beginPath();
    ctx.moveTo(x + firstW + c * cw, y);
    ctx.lineTo(x + firstW + c * cw, y + h);
    ctx.stroke();
  }
  for (let r = 0; r <= rows + 1; r++) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * rowH);
    ctx.lineTo(x + w, y + r * rowH);
    ctx.stroke();
  }
  ctx.textBaseline = 'middle';
  ctx.font = font(rowH * 0.5, 600);
  ctx.fillStyle = '#5E7A69';
  ctx.textAlign = 'center';
  'ABCDE'.split('').forEach((ch, c) => ctx.fillText(ch, x + firstW + c * cw + cw / 2, y + rowH / 2));
  ctx.font = font(rowH * 0.42, 500);
  for (let r = 1; r <= rows; r++) ctx.fillText(String(r), x + firstW / 2, y + r * rowH + rowH / 2);
  ctx.textAlign = 'right';
  ctx.font = font(rowH * 0.46, 500, true);
  for (let r = 1; r <= rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (c === 0) {
        ctx.fillStyle = '#B9C4CF';
        rr(ctx, x + firstW + 6, y + r * rowH + rowH * 0.36, cw * (0.4 + rand() * 0.45), rowH * 0.28, 3);
        ctx.fill();
        continue;
      }
      const total = r === rows;
      ctx.fillStyle = total ? '#1F3A2A' : INK;
      ctx.font = font(rowH * 0.46, total ? 700 : 500, true);
      const n = Math.round((total ? 40000 : 400) + rand() * (total ? 90000 : 9000));
      ctx.fillText(num(n, v), x + firstW + (c + 1) * cw - 8, y + r * rowH + rowH / 2 + 1);
    }
  }
}

function windowChrome(ctx: Ctx, w: number, h: number, band: string) {
  ctx.fillStyle = '#E9EDF2';
  ctx.fillRect(0, 0, w, h * 0.07);
  ['#E2685C', '#E8B84A', '#5DB26A'].forEach((c, i) => {
    ctx.beginPath();
    ctx.arc(w * 0.03 + i * w * 0.025, h * 0.035, h * 0.011, 0, Math.PI * 2);
    ctx.fillStyle = c;
    ctx.fill();
  });
  ctx.fillStyle = band;
  ctx.fillRect(0, h * 0.07, w, h * 0.06);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (let i = 0; i < 6; i++) rr(ctx, w * (0.03 + i * 0.07), h * 0.088, w * 0.05, h * 0.024, 3, 'rgba(255,255,255,0.7)');
}

/** Экран в чёрной рамке: рисует рамку и возвращает область содержимого. */
function bezel(ctx: Ctx, w: number, h: number, frac: number, r: number): [number, number, number, number] {
  ctx.fillStyle = '#0B0F14';
  ctx.fillRect(0, 0, w, h);
  const b = Math.min(w, h) * frac;
  ctx.save();
  rr(ctx, b, b, w - 2 * b, h - 2 * b, r);
  ctx.clip();
  return [b, b, w - 2 * b, h - 2 * b];
}

// ---------------- бумага ----------------

/** Кромка листа: на светлом фоне EN белая бумага иначе сливается с фоном. */
function paperEdge(ctx: Ctx, w: number, h: number, v: Version) {
  if (v !== 'en') return;
  // ~1,5 px на экране при обычном размере предмета
  ctx.strokeStyle = 'rgba(2,8,23,0.2)';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);
}

const sheet: Draw = (ctx, w, h, v) => {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 3);
  paperEdge(ctx, w, h, v);
  ctx.fillStyle = '#1E7B4A';
  ctx.fillRect(w * 0.06, h * 0.045, w * 0.38, h * 0.022);
  ctx.fillStyle = MUTED;
  ctx.fillRect(w * 0.06, h * 0.08, w * 0.24, h * 0.012);
  grid(ctx, w * 0.06, h * 0.12, w * 0.88, h * 0.8, v, 11);
};

const doc: Draw = (ctx, w, h, v) => {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 5);
  paperEdge(ctx, w, h, v);
  ctx.fillStyle = '#2F62C9';
  ctx.fillRect(0, 0, w, h * 0.012);
  ctx.fillStyle = INK;
  rr(ctx, w * 0.1, h * 0.07, w * 0.62, h * 0.03, 4, INK);
  rr(ctx, w * 0.1, h * 0.115, w * 0.36, h * 0.016, 4, MUTED);
  textLines(ctx, w * 0.1, h * 0.17, w * 0.8, h * 0.032, 6, LINE, h * 0.011, 2);
  // врезка-график
  rr(ctx, w * 0.1, h * 0.38, w * 0.8, h * 0.2, 8, '#EAF0FB');
  ctx.strokeStyle = '#2F62C9';
  ctx.lineWidth = 5;
  ctx.beginPath();
  [0.08, 0.22, 0.16, 0.35, 0.3, 0.52, 0.47, 0.66, 0.6].forEach((y, i, a) => {
    const px = w * (0.14 + (i / (a.length - 1)) * 0.72);
    const py = h * (0.55 - y * 0.24);
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.stroke();
  textLines(ctx, w * 0.1, h * 0.63, w * 0.8, h * 0.032, 5, LINE, h * 0.011, 4);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(w * 0.115, h * (0.82 + i * 0.04), h * 0.007, 0, Math.PI * 2);
    ctx.fillStyle = MUTED;
    ctx.fill();
    rr(ctx, w * 0.14, h * (0.815 + i * 0.04), w * (0.4 + i * 0.1), h * 0.011, 4, LINE);
  }
};

const sticky: Draw = (ctx, w, h, v) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#F8DE6E');
  g.addColorStop(1, '#F1CB45');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(160,120,10,0.10)';
  ctx.fillRect(0, 0, w, h * 0.13);
  grain(ctx, w, h, 7, 0.05);
  // долг поставщику, написано от руки
  ctx.save();
  ctx.translate(w * 0.5, h * 0.42);
  ctx.rotate(-0.05);
  ctx.fillStyle = '#2E2A20';
  const debt = v === 'en' ? `AED −${num(18400, v)}` : `−${num(184000, v)} ₽`;
  const hand = (px: number) => `italic 600 ${px}px "Segoe Print", "Comic Sans MS", Inter, sans-serif`;
  // сумма должна уместиться внутри красного овала при любом запасном шрифте
  const size = Math.round(h * 0.15);
  ctx.font = hand(size);
  const fit = (w * 0.74) / ctx.measureText(debt).width;
  if (fit < 1) ctx.font = hand(Math.floor(size * fit));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(debt, 0, 0);
  ctx.restore();
  ctx.strokeStyle = '#3A3424';
  ctx.lineCap = 'round';
  ctx.lineWidth = w * 0.012;
  const rand = rng(17);
  for (let i = 0; i < 2; i++) {
    const y = h * (0.64 + i * 0.12);
    ctx.beginPath();
    ctx.moveTo(w * 0.16, y);
    const end = i === 1 ? 0.52 : 0.8;
    for (let x = 0.16; x < end; x += 0.02) ctx.lineTo(w * x, y + Math.sin(x * 50 + i * 2) * h * 0.01 + (rand() - 0.5) * h * 0.005);
    ctx.stroke();
  }
  ctx.strokeStyle = '#C0392B';
  ctx.lineWidth = w * 0.016;
  ctx.beginPath();
  ctx.ellipse(w * 0.5, h * 0.42, w * 0.42, h * 0.14, -0.06, 0, Math.PI * 2);
  ctx.stroke();
};

const checklist: Draw = (ctx, w, h, v) => {
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 13);
  paperEdge(ctx, w, h, v);
  rr(ctx, w * 0.1, h * 0.1, w * 0.5, h * 0.03, 4, INK);
  rr(ctx, w * 0.1, h * 0.15, w * 0.3, h * 0.014, 4, MUTED);
  for (let i = 0; i < 7; i++) {
    const y = h * (0.22 + i * 0.1);
    const s = w * 0.085;
    ctx.strokeStyle = '#7E8BA0';
    ctx.lineWidth = 4;
    rr(ctx, w * 0.1, y, s, s, 5);
    ctx.stroke();
    if (i % 3 !== 2) {
      ctx.strokeStyle = '#1E7B4A';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(w * 0.1 + s * 0.18, y + s * 0.52);
      ctx.lineTo(w * 0.1 + s * 0.43, y + s * 0.78);
      ctx.lineTo(w * 0.1 + s * 0.9, y + s * 0.15);
      ctx.stroke();
    }
    rr(ctx, w * 0.25, y + s * 0.34, w * (0.36 + ((i * 13) % 7) / 20), h * 0.013, 4, i % 3 !== 2 ? '#C3CCDA' : '#8D99AB');
  }
};

const bubble: Draw = (ctx, w, h, v) => {
  const base = v === 'en' ? '#22B35E' : '#3A9EDF';
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, v === 'en' ? '#33C46E' : '#55B1EA');
  g.addColorStop(1, base);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  rr(ctx, w * 0.09, h * 0.22, w * 0.72, h * 0.09, h * 0.045);
  ctx.fill();
  rr(ctx, w * 0.09, h * 0.4, w * 0.52, h * 0.09, h * 0.045);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = font(h * 0.1, 500);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText('12:30', w * 0.8, h * 0.62);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 3;
  for (const dx of [0, 0.03]) {
    ctx.beginPath();
    ctx.moveTo(w * (0.83 + dx), h * 0.62);
    ctx.lineTo(w * (0.85 + dx), h * 0.66);
    ctx.lineTo(w * (0.89 + dx), h * 0.57);
    ctx.stroke();
  }
};

const receipt: Draw = (ctx, w, h, v) => {
  ctx.clearRect(0, 0, w, h);
  const zig = h * 0.018;
  ctx.fillStyle = '#FBFBF8';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h - zig);
  const teeth = 12;
  for (let i = teeth; i >= 0; i--) ctx.lineTo((w / teeth) * i, i % 2 ? h : h - zig);
  ctx.closePath();
  ctx.fill();
  if (v === 'en') {
    // кромка чека на светлом фоне; наружная половина линии отсекается alphaTest
    ctx.strokeStyle = 'rgba(2,8,23,0.2)';
    ctx.lineWidth = 8;
    ctx.stroke();
  }
  ctx.save();
  ctx.clip();
  grain(ctx, w, h, 19, 0.04);
  ctx.restore();
  ctx.textBaseline = 'middle';
  rr(ctx, w * 0.3, h * 0.03, w * 0.4, h * 0.012, 3, '#7E8BA0');
  rr(ctx, w * 0.22, h * 0.055, w * 0.56, h * 0.007, 3, '#B5BECB');
  const rand = rng(23);
  ctx.font = font(w * 0.07, 500, true);
  ctx.textAlign = 'right';
  for (let i = 0; i < 12; i++) {
    const y = h * (0.1 + i * 0.042);
    rr(ctx, w * 0.1, y - h * 0.004, w * (0.32 + rand() * 0.18), h * 0.008, 3, '#C9D0DA');
    ctx.fillStyle = '#5B6678';
    ctx.fillText(num(Math.round(90 + rand() * 900), v), w * 0.9, y);
  }
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = '#9AA6B6';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(w * 0.08, h * 0.63);
  ctx.lineTo(w * 0.92, h * 0.63);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = INK;
  ctx.font = font(w * 0.095, 700, true);
  ctx.fillText(v === 'en' ? `AED ${num(1990, v)}` : `${num(1990, v)} ₽`, w * 0.9, h * 0.67);
  rr(ctx, w * 0.1, h * 0.663, w * 0.22, h * 0.012, 3, INK);
  for (let x = w * 0.14; x < w * 0.86; x += 5) {
    const bw = 1 + ((x * 7) % 3);
    ctx.fillRect(x, h * 0.75, bw, h * 0.08);
  }
  // штамп неоплаченного счёта
  ctx.save();
  ctx.translate(w * 0.5, h * 0.42);
  ctx.rotate(-0.14);
  ctx.strokeStyle = 'rgba(214,69,69,0.88)';
  ctx.fillStyle = 'rgba(214,69,69,0.88)';
  ctx.lineWidth = w * 0.02;
  const sw = w * 0.82;
  const sh = h * 0.07;
  rr(ctx, -sw / 2, -sh / 2, sw, sh, 6);
  ctx.stroke();
  ctx.font = font(sh * 0.5, 800);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(v === 'en' ? 'UNPAID' : 'НЕ ОПЛАЧЕНО', 0, 2);
  ctx.restore();
};




// ---------------- экраны ----------------


const laptopDoc: Draw = (ctx, w, h) => {
  const [x, y, cw, ch] = bezel(ctx, w, h, 0.035, 6);
  ctx.translate(x, y);
  ctx.fillStyle = '#EEF1F5';
  ctx.fillRect(0, 0, cw, ch);
  windowChrome(ctx, cw, ch, '#2F62C9');
  rr(ctx, cw * 0.22, ch * 0.17, cw * 0.56, ch * 0.83, 0, '#FFFFFF');
  rr(ctx, cw * 0.27, ch * 0.23, cw * 0.32, ch * 0.035, 4, INK);
  textLines(ctx, cw * 0.27, ch * 0.31, cw * 0.46, ch * 0.045, 7, LINE, ch * 0.014, 8);
  rr(ctx, cw * 0.27, ch * 0.64, cw * 0.46, ch * 0.18, 6, '#EAF0FB');
  textLines(ctx, cw * 0.27, ch * 0.86, cw * 0.46, ch * 0.045, 3, LINE, ch * 0.014, 9);
  ctx.restore();
};

const keyboard: Draw = (ctx, w, h) => {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#C9CED5');
  g.addColorStop(1, '#B7BDC6');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  rr(ctx, w * 0.08, h * 0.08, w * 0.84, h * 0.5, 10, '#A9B0BA');
  const rows = 5;
  const cols = 14;
  const kw = (w * 0.82) / cols;
  const kh = (h * 0.48) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (r === rows - 1 && c > 3 && c < 10) continue;
      rr(ctx, w * 0.09 + c * kw + 2, h * 0.09 + r * kh + 2, kw - 4, kh - 4, 4, '#2B3038');
    }
  }
  rr(ctx, w * 0.09 + 4 * kw + 2, h * 0.09 + (rows - 1) * kh + 2, kw * 6 - 4, kh - 4, 4, '#2B3038');
  rr(ctx, w * 0.33, h * 0.64, w * 0.34, h * 0.3, 12, '#BCC2CA');
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();
};

const phone: Draw = (ctx, w, h, v) => {
  const [x, y, cw, ch] = bezel(ctx, w, h, 0.045, w * 0.1);
  ctx.translate(x, y);
  ctx.fillStyle = v === 'en' ? '#EFEAE2' : '#E7EEF5';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, cw, ch * 0.11);
  ctx.beginPath();
  ctx.arc(cw * 0.14, ch * 0.065, ch * 0.028, 0, Math.PI * 2);
  ctx.fillStyle = v === 'en' ? '#8FCBA6' : '#9CC4E4';
  ctx.fill();
  rr(ctx, cw * 0.24, ch * 0.05, cw * 0.36, ch * 0.016, 4, INK);
  rr(ctx, cw * 0.24, ch * 0.075, cw * 0.22, ch * 0.012, 4, MUTED);
  // счётчик непрочитанных
  ctx.font = font(ch * 0.024, 700);
  const badge = num(1248, v);
  const bwid = ctx.measureText(badge).width + ch * 0.03;
  rr(ctx, cw * 0.94 - bwid, ch * 0.048, bwid, ch * 0.036, ch * 0.018, '#E2463F');
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, cw * 0.94 - bwid / 2, ch * 0.067);
  ctx.fillStyle = '#0B0F14';
  rr(ctx, cw * 0.38, ch * 0.012, cw * 0.24, ch * 0.022, ch * 0.011, '#0B0F14');
  const out = v === 'en' ? '#D7F7C5' : '#D5ECFB';
  const msgs: Array<[boolean, number, number]> = [
    [false, 0.62, 2],
    [true, 0.55, 1],
    [false, 0.7, 3],
    [true, 0.46, 2],
    [false, 0.5, 1],
    [true, 0.6, 2],
  ];
  let yy = ch * 0.15;
  for (const [mine, bw, lines] of msgs) {
    const bh = ch * (0.035 + lines * 0.028);
    const bx = mine ? cw * (0.94 - bw) : cw * 0.06;
    rr(ctx, bx, yy, cw * bw, bh, cw * 0.05, mine ? out : '#FFFFFF');
    for (let l = 0; l < lines; l++) rr(ctx, bx + cw * 0.05, yy + ch * 0.022 + l * ch * 0.028, cw * (bw - 0.12) * (l === lines - 1 ? 0.6 : 1), ch * 0.012, 3, '#9AA6B6');
    yy += bh + ch * 0.022;
  }
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, ch * 0.9, cw, ch * 0.1);
  rr(ctx, cw * 0.05, ch * 0.92, cw * 0.72, ch * 0.055, ch * 0.027, '#EEF1F5');
  ctx.beginPath();
  ctx.arc(cw * 0.87, ch * 0.948, ch * 0.03, 0, Math.PI * 2);
  ctx.fillStyle = v === 'en' ? '#22B35E' : '#3A9EDF';
  ctx.fill();
  ctx.restore();
};

const phoneApp: Draw = (ctx, w, h, v) => {
  const [x, y, cw, ch] = bezel(ctx, w, h, 0.045, w * 0.1);
  ctx.translate(x, y);
  ctx.fillStyle = '#F4F6F9';
  ctx.fillRect(0, 0, cw, ch);
  rr(ctx, cw * 0.38, ch * 0.012, cw * 0.24, ch * 0.022, ch * 0.011, '#0B0F14');
  rr(ctx, cw * 0.36, ch * 0.13, cw * 0.28, cw * 0.28, cw * 0.07, '#E8803A');
  rr(ctx, cw * 0.46, ch * 0.165, cw * 0.08, cw * 0.12, 4, 'rgba(255,255,255,0.85)');
  rr(ctx, cw * 0.2, ch * 0.3, cw * 0.6, ch * 0.022, 4, INK);
  rr(ctx, cw * 0.28, ch * 0.34, cw * 0.44, ch * 0.014, 4, MUTED);
  for (let i = 0; i < 6; i++) rr(ctx, cw * (0.08 + i * 0.145), ch * 0.42, cw * 0.12, ch * 0.075, 8, i < 2 ? '#DCE3EC' : '#FFFFFF');
  ctx.strokeStyle = '#C7D0DC';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    rr(ctx, cw * (0.08 + i * 0.145), ch * 0.42, cw * 0.12, ch * 0.075, 8);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.font = font(ch * 0.04, 700, true);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('4', cw * 0.14, ch * 0.458);
  ctx.fillText('7', cw * 0.285, ch * 0.458);
  rr(ctx, cw * 0.08, ch * 0.56, cw * 0.84, ch * 0.065, ch * 0.03, '#B5BECB');
  ctx.fillStyle = '#5B6678';
  ctx.font = font(ch * 0.022, 500);
  ctx.fillText(v === 'en' ? 'Forgot password?' : 'Забыли пароль?', cw * 0.5, ch * 0.67);
  ctx.fillText(v === 'en' ? 'Code sent to +971 •• ••• 41' : 'Код отправлен на +7 ••• ••• 41', cw * 0.5, ch * 0.71);
  ctx.restore();
};

const tablet: Draw = (ctx, w, h, v) => {
  const [x, y, cw, ch] = bezel(ctx, w, h, 0.04, 10);
  ctx.translate(x, y);
  ctx.fillStyle = '#F4F6F9';
  ctx.fillRect(0, 0, cw, ch);
  ctx.fillStyle = '#1F2633';
  ctx.fillRect(0, 0, cw * 0.14, ch);
  for (let i = 0; i < 6; i++) rr(ctx, cw * 0.03, ch * (0.1 + i * 0.1), cw * 0.08, ch * 0.03, 4, i === 1 ? '#E8803A' : '#4A5568');
  const kpi = [12840, 486, 3170];
  kpi.forEach((k, i) => {
    const kx = cw * (0.18 + i * 0.27);
    rr(ctx, kx, ch * 0.06, cw * 0.24, ch * 0.2, 10, '#FFFFFF');
    rr(ctx, kx + cw * 0.02, ch * 0.095, cw * 0.1, ch * 0.025, 4, '#B5BECB');
    ctx.fillStyle = INK;
    ctx.font = font(ch * 0.075, 650, true);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(num(k, v), kx + cw * 0.02, ch * 0.185);
  });
  rr(ctx, cw * 0.18, ch * 0.31, cw * 0.5, ch * 0.62, 10, '#FFFFFF');
  ctx.strokeStyle = '#E8803A';
  ctx.lineWidth = ch * 0.012;
  ctx.beginPath();
  [0.2, 0.35, 0.28, 0.5, 0.44, 0.62, 0.58, 0.75].forEach((p, i, a) => {
    const px = cw * (0.21 + (i / (a.length - 1)) * 0.44);
    const py = ch * (0.86 - p * 0.45);
    if (i) ctx.lineTo(px, py);
    else ctx.moveTo(px, py);
  });
  ctx.stroke();
  rr(ctx, cw * 0.71, ch * 0.31, cw * 0.26, ch * 0.62, 10, '#FFFFFF');
  [0.5, 0.8, 0.35, 0.65, 0.9].forEach((b, i) => rr(ctx, cw * (0.74 + i * 0.045), ch * (0.88 - b * 0.45), cw * 0.03, ch * b * 0.45, 3, i === 4 ? '#E8803A' : '#B5BECB'));
  ctx.restore();
};

export const FACES = {
  sheet: { size: [1.7, 2.2], draw: sheet, rough: 0.92 },
  doc: { size: [1.7, 2.2], draw: doc, rough: 0.92 },
  sticky: { size: [1.15, 1.15], draw: sticky, rough: 0.85 },
  checklist: { size: [1.42, 1.85], draw: checklist, rough: 0.92 },
  bubble: { size: [2.0, 0.95], draw: bubble, rough: 0.35 },
  receipt: { size: [0.9, 2.5], draw: receipt, rough: 0.9 },
  laptopDoc: { size: [2.3, 1.48], draw: laptopDoc, rough: 0.18 },
  keyboard: { size: [2.3, 1.55], draw: keyboard, rough: 0.45, metal: 0.4 },
  phone: { size: [0.92, 1.92], draw: phone, rough: 0.15 },
  phoneApp: { size: [0.92, 1.92], draw: phoneApp, rough: 0.15 },
  tablet: { size: [2.4, 1.7], draw: tablet, rough: 0.15 },
} satisfies Record<string, Face>;

export type FaceId = keyof typeof FACES;

/** Сплошные цвета торцов и деталей (металл, пластик, резинка, клавиши). */
export const SWATCHES = {
  paper: { color: '#EEF1F5', rough: 0.95 },
  stickyEdge: { color: '#E9C54B', rough: 0.9 },
  board: { color: '#28313E', rough: 0.6 },
  clip: { color: '#C9CED6', rough: 0.28, metal: 1 },
  alu: { color: '#C3C9D1', rough: 0.32, metal: 0.9 },
  aluDark: { color: '#3A414B', rough: 0.35, metal: 0.8 },
  glassBlack: { color: '#0B0F14', rough: 0.15 },
  bubbleEdge: { color: (v: Version) => (v === 'en' ? '#1E9A51' : '#2D8AC6'), rough: 0.35 },
  receiptEdge: { color: '#ECECE6', rough: 0.9 },
} satisfies Record<string, Swatch>;

export type SwatchId = keyof typeof SWATCHES;

/** Лица для плоской версии на телефоне и картинки «до → после». */
export const CHIP_FACES: FaceId[] = ['phone', 'bubble', 'receipt', 'sticky', 'doc', 'checklist', 'sheet', 'tablet', 'phoneApp'];
