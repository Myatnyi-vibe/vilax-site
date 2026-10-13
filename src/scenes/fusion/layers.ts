// HTML-слои сцены слияния поверх холста: список болей, окно, сгиб окна в знак, сам знак, фраза сборки, финал.
// Общие для 3D (компьютер) и плоской версии (телефон); положение окна и знака приходит в px от угла сцены.
// Только transform, opacity и атрибуты SVG — без перерасчёта раскладки страницы.
import { captionState, foldPath, windowState } from './choreo';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Layers {
  lead: HTMLElement | null;
  items: HTMLElement[];
  merge: HTMLElement | null;
  final: HTMLElement | null;
  win: HTMLElement | null;
  fold: SVGSVGElement | null;
  mark: SVGSVGElement | HTMLElement | null;
}

/** Базовый размер окна в CSS (16:10); на экран оно ставится масштабом, без изменения ширины и высоты. */
export const WIN_BASE = { w: 640, h: 400 };

export function findLayers(root: HTMLElement): Layers {
  return {
    lead: root.querySelector('.fusion__lead'),
    items: [...root.querySelectorAll<HTMLElement>('.fusion__item')],
    merge: root.querySelector('.fusion__merge'),
    final: root.querySelector('.fusion__final'),
    win: root.querySelector('.fusion__window'),
    fold: root.querySelector('.fusion__fold'),
    mark: root.querySelector('.fusion__mark'),
  };
}

const px = (n: number) => `${n.toFixed(1)}px`;

export function applyLayers(L: Layers, p: number, layout: { win: Rect; mark: Rect }, pastLevel: number) {
  const c = captionState(p, pastLevel);
  if (L.lead) L.lead.style.opacity = c.lead.toFixed(3);
  L.items.forEach((el, i) => {
    const s = c.items[i];
    if (!s) return;
    el.style.opacity = s.opacity.toFixed(3);
    el.style.transform = `translate(${px(s.x)}, ${px(s.y)})`;
  });

  const ws = windowState(p);
  const { win, mark } = layout;
  if (L.win) {
    const k = win.w / WIN_BASE.w;
    L.win.style.opacity = ws.html.toFixed(3);
    L.win.style.visibility = ws.html > 0.001 ? 'visible' : 'hidden';
    L.win.style.transform = `translate(${px(win.x + (win.w * (1 - ws.scale)) / 2)}, ${px(win.y + (win.h * (1 - ws.scale)) / 2)}) scale(${(k * ws.scale).toFixed(4)})`;
    L.win.style.setProperty('--k', (k * ws.scale).toFixed(4));
  }
  if (L.fold) {
    L.fold.style.visibility = ws.svg ? 'visible' : 'hidden';
    if (ws.svg) {
      place(L.fold, mark);
      // радиус окна 20 px в единицах viewBox знака
      const r = 20 * (712 / Math.max(1, mark.w)) * ws.radius;
      const path = foldPath(ws.fold, r);
      const [fill, body, brand, top] = ['.fold-fill', '.fold-body', '.fold-brand', '.fold-top'].map((s) => L.fold!.querySelector<SVGPathElement>(s));
      fill?.setAttribute('d', path.fill);
      body?.setAttribute('d', path.body);
      brand?.setAttribute('d', path.body);
      top?.setAttribute('d', path.top);
      fill?.style.setProperty('opacity', ws.fill.toFixed(3));
      body?.style.setProperty('opacity', ((1 - ws.brand) * ws.outline).toFixed(3));
      brand?.style.setProperty('opacity', (ws.brand * ws.outline).toFixed(3));
      top?.style.setProperty('opacity', (ws.top * ws.outline).toFixed(3));
    }
  }
  if (L.mark) {
    place(L.mark, mark, ws.settle);
    L.mark.style.opacity = ws.reveal > 0 ? '1' : '0';
    L.mark.style.setProperty('--rv', ws.reveal.toFixed(3));
  }
  if (L.merge) {
    L.merge.style.opacity = c.merge.toFixed(3);
    L.merge.style.transform = `translate(${px(win.x + win.w / 2)}, ${px(win.y + win.h + 28)}) translate(-50%, 0)`;
  }
  if (L.final) {
    L.final.style.opacity = c.final.toFixed(3);
    L.final.style.transform = `translate(${px(mark.x + mark.w / 2)}, ${px(mark.y + mark.h + 28 + 8 * (1 - c.final))}) translate(-50%, 0)`;
  }
}

const sizes = new WeakMap<Element, string>();

/** Ставит элемент в прямоугольник: размер меняется только когда меняется (после 0,78 камера неподвижна), позиция — transform. */
function place(el: Element, r: Rect, scale = 1) {
  const s = el as HTMLElement;
  const key = `${r.w.toFixed(1)}x${r.h.toFixed(1)}`;
  if (sizes.get(el) !== key) {
    sizes.set(el, key);
    s.style.width = px(r.w);
    s.style.height = px(r.h);
  }
  const dx = (r.w * (1 - scale)) / 2;
  const dy = (r.h * (1 - scale)) / 2;
  s.style.transform = `translate(${px(r.x + dx)}, ${px(r.y + dy)}) scale(${scale.toFixed(4)})`;
}
