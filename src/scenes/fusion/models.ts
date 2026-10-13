// Модели предметов сцены слияния: простые формы, собранные из нескольких частей, с UV в общий атлас.
// Бумага слегка изогнута, у стикера загнут уголок, чек закручивается снизу; у устройств скруглённые корпуса,
// стекло и металл. Каждая модель — одна геометрия, все экземпляры вида рисуются одним вызовом.
import { BoxGeometry, BufferAttribute, BufferGeometry, ExtrudeGeometry, Matrix4, Shape, Vector3 } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ATLAS_H, ATLAS_W, type Atlas, type Rect } from './atlas';
import type { SwatchId } from './faces';
import type { Kind } from './choreo';

type Side = 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
const SIDES: Side[] = ['px', 'nx', 'py', 'ny', 'pz', 'nz'];

export interface Model {
  id: Kind;
  geometry: BufferGeometry;
  /** Половины габаритов после центровки — для проверки по OBB (сверяются с HALF в choreo.ts). */
  half: [number, number, number];
}

const uvAt = (r: Rect, u: number, v: number): [number, number] => [(r.x + u * r.w) / ATLAS_W, 1 - (r.y + (1 - v) * r.h) / ATLAS_H];

/** Коробка: выбранные стороны — лица из атласа, остальные — образец цвета. Неиндексированная. */
function box(w: number, h: number, d: number, map: Partial<Record<Side, Rect>>, rest: Rect, seg: [number, number, number] = [1, 1, 1], deform?: (g: BufferGeometry) => void): BufferGeometry {
  const geo = new BoxGeometry(w, h, d, ...seg);
  const uv = geo.getAttribute('uv') as BufferAttribute;
  const index = geo.getIndex()!;
  const [su, sv] = uvAt(rest, 0.5, 0.5);
  for (const g of geo.groups) {
    const rect = map[SIDES[g.materialIndex ?? 0]];
    const done = new Set<number>();
    for (let i = g.start; i < g.start + g.count; i++) {
      const vi = index.getX(i);
      if (done.has(vi)) continue;
      done.add(vi);
      if (rect) {
        const [a, b] = uvAt(rect, uv.getX(vi), uv.getY(vi));
        uv.setXY(vi, a, b);
      } else uv.setXY(vi, su, sv);
    }
  }
  geo.clearGroups();
  if (deform) {
    deform(geo);
    geo.computeVertexNormals();
  }
  const out = geo.toNonIndexed();
  geo.dispose();
  return out;
}

function roundedOutline(s: Shape, x0: number, y0: number, x1: number, y1: number, r: number) {
  s.moveTo(x0 + r, y0);
  s.lineTo(x1 - r, y0);
  s.quadraticCurveTo(x1, y0, x1, y0 + r);
  s.lineTo(x1, y1 - r);
  s.quadraticCurveTo(x1, y1, x1 - r, y1);
  s.lineTo(x0 + r, y1);
  s.quadraticCurveTo(x0, y1, x0, y1 - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
}

/** Скруглённый корпус с фаской: лицевая крышка (+z) и тыльная — из атласа, бока — образец. */
function rounded(w: number, h: number, d: number, r: number, front: Rect, back: Rect, side: Rect, bevel = 0.02, outline?: (s: Shape) => void): BufferGeometry {
  const s = new Shape();
  if (outline) outline(s);
  else roundedOutline(s, -w / 2 + bevel, -h / 2 + bevel, w / 2 - bevel, h / 2 - bevel, Math.max(0.001, r - bevel));
  const depth = Math.max(0.001, d - bevel * 2);
  const geo = new ExtrudeGeometry(s, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 8 });
  geo.translate(0, 0, -depth / 2);
  const pos = geo.getAttribute('position') as BufferAttribute;
  const uv = geo.getAttribute('uv') as BufferAttribute;
  const [su, sv] = uvAt(side, 0.5, 0.5);
  for (const g of geo.groups) {
    for (let i = g.start; i < g.start + g.count; i++) {
      if (g.materialIndex === 0) {
        const [a, b] = uvAt(pos.getZ(i) > 0 ? front : back, (pos.getX(i) + w / 2) / w, (pos.getY(i) + h / 2) / h);
        uv.setXY(i, a, b);
      } else uv.setXY(i, su, sv);
    }
  }
  geo.clearGroups();
  return geo;
}

/** Изгиб листа вокруг вертикальной оси: R > 0 — края уходят назад, R < 0 — вперёд. */
const bendX = (R: number) => (g: BufferGeometry) => {
  const p = g.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i) / R;
    const rz = R + p.getZ(i);
    p.setXYZ(i, rz * Math.sin(a), p.getY(i), rz * Math.cos(a) - R);
  }
};

/** Загнутый к зрителю правый нижний уголок. */
const curlCorner = (w: number, h: number, k: number) => (g: BufferGeometry) => {
  const p = g.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const u = (p.getX(i) + w / 2) / w;
    const v = (p.getY(i) + h / 2) / h;
    const t = Math.max(0, u + (1 - v) - 1.3) / 0.7;
    p.setZ(i, p.getZ(i) + k * t * t);
  }
};

/** Нижняя часть ленты (ниже y0) закручивается назад по окружности радиуса R. */
const rollBottom = (y0: number, R: number) => (g: BufferGeometry) => {
  const p = g.getAttribute('position') as BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y >= y0) continue;
    const a = (y0 - y) / R;
    const rz = R + p.getZ(i);
    p.setXYZ(i, p.getX(i), y0 - rz * Math.sin(a), rz * Math.cos(a) - R);
  }
};

/** Поворот вокруг осей X, затем Y, затем Z и перенос. */
function at(geo: BufferGeometry, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): BufferGeometry {
  const m = new Matrix4().makeRotationX(rx);
  if (ry) m.premultiply(new Matrix4().makeRotationY(ry));
  if (rz) m.premultiply(new Matrix4().makeRotationZ(rz));
  m.setPosition(x, y, z);
  geo.applyMatrix4(m);
  return geo;
}

export function buildModels(a: Atlas): Model[] {
  const F = a.faces;
  const S = (id: SwatchId) => a.swatches[id];
  const models: Model[] = [];

  const add = (id: Kind, parts: BufferGeometry[]) => {
    for (const p of parts) for (const name of Object.keys(p.attributes)) if (!['position', 'normal', 'uv'].includes(name)) p.deleteAttribute(name);
    const geometry = mergeGeometries(parts, false)!;
    for (const p of parts) p.dispose();
    geometry.computeBoundingBox();
    const c = new Vector3();
    geometry.boundingBox!.getCenter(c);
    geometry.translate(-c.x, -c.y, -c.z);
    geometry.computeBoundingBox();
    const size = new Vector3();
    geometry.boundingBox!.getSize(size);
    models.push({ id, geometry, half: [size.x / 2, size.y / 2, size.z / 2] });
  };

  // Таблицы и отчёты: лист слегка изогнут
  add('sheet', [box(1.7, 2.2, 0.012, { pz: F.sheet }, S('paper'), [16, 1, 1], bendX(5.5))]);
  add('doc', [box(1.7, 2.2, 0.012, { pz: F.doc }, S('paper'), [16, 1, 1], bendX(-6.5))]);

  // Стикер с суммой долга и загнутым уголком
  add('sticky', [box(1.15, 1.15, 0.01, { pz: F.sticky }, S('stickyEdge'), [10, 10, 1], curlCorner(1.15, 1.15, 0.24))]);

  // Чек-лист отчёта на планшете с зажимом
  add(
    'clipboard',
    [
      rounded(1.6, 2.3, 0.04, 0.08, S('board'), S('board'), S('board'), 0.012),
      at(box(1.42, 1.85, 0.006, { pz: F.checklist }, S('paper')), 0, -0.12, 0.024),
      at(rounded(0.72, 0.24, 0.09, 0.05, S('clip'), S('clip'), S('clip'), 0.02), 0, 1.0, 0.05),
      at(rounded(0.36, 0.14, 0.05, 0.05, S('clip'), S('clip'), S('clip'), 0.015), 0, 1.17, 0.04),
    ],
  );

  // Пузыри чата: мягкая фаска и хвостик снизу слева
  const bw = 2.0;
  const bh = 0.95;
  add(
    'bubble',
    [
      rounded(bw, bh, 0.14, 0.22, F.bubble, S('bubbleEdge'), S('bubbleEdge'), 0.045, (s) => {
        const e = 0.045;
        const x0 = -bw / 2 + e;
        const x1 = bw / 2 - e;
        const y0 = -bh / 2 + bh * 0.16;
        const y1 = bh / 2 - e;
        const r = bh * 0.22;
        s.moveTo(x0 + r, y0);
        s.lineTo(x0 + bw * 0.14, y0);
        s.lineTo(x0 + bw * 0.06, -bh / 2 + e);
        s.lineTo(x0 + bw * 0.3, y0);
        s.lineTo(x1 - r, y0);
        s.quadraticCurveTo(x1, y0, x1, y0 + r);
        s.lineTo(x1, y1 - r);
        s.quadraticCurveTo(x1, y1, x1 - r, y1);
        s.lineTo(x0 + r, y1);
        s.quadraticCurveTo(x0, y1, x0, y1 - r);
        s.lineTo(x0, y0 + r);
        s.quadraticCurveTo(x0, y0, x0 + r, y0);
      }),
    ],
  );

  // Неоплаченный чек, закрученный снизу назад
  add('receipt', [box(0.9, 2.5, 0.006, { pz: F.receipt }, S('receiptEdge'), [1, 28, 1], rollBottom(-0.5, 0.3))]);

  // Ноутбук с документом на экране: основание с клавиатурой и откинутая крышка
  const t = -0.28;
  const hingeY = 0.035;
  const hingeZ = -0.81;
  const lidY = hingeY + Math.cos(t) * 0.775;
  const lidZ = hingeZ + Math.sin(t) * 0.775;
  add(
    'laptopDoc',
    [box(2.4, 0.07, 1.62, { py: F.keyboard }, S('alu')), at(box(2.4, 1.55, 0.05, { pz: F.laptopDoc }, S('alu')), 0, lidY, lidZ, t)],
  );

  // Телефоны: переписка с непрочитанными и «непонятный сервис» со входом по коду; планшет с панелью
  const phoneBody = (screen: Rect) => [
    rounded(0.92, 1.92, 0.085, 0.14, screen, S('aluDark'), S('aluDark'), 0.02),
    at(rounded(0.3, 0.3, 0.03, 0.08, S('glassBlack'), S('glassBlack'), S('glassBlack'), 0.01), -0.22, 0.68, -0.05),
  ];
  add('phone', phoneBody(F.phone));
  add('phoneApp', phoneBody(F.phoneApp));
  add('tablet', [rounded(2.4, 1.7, 0.065, 0.12, F.tablet, S('alu'), S('alu'), 0.02)]);

  return models;
}
