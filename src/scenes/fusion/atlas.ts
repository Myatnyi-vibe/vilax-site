// Общий атлас сцены (ТЗ: «общий атлас текстур»): цвет 2048×1536 и карта шероховатости/металла в 1/4 размера.
// Сетка 4×3 ячейки по 512 px: 11 лиц предметов и ячейка сплошных образцов цвета для торцов и деталей.
import { FACES, SWATCHES, type FaceId, type SwatchId, type Version } from './faces';

export const ATLAS_W = 2048;
export const ATLAS_H = 1536;
const CELL = 512;
const FACE = 484;
const RM_SCALE = 4;
const SWATCH = 56;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Atlas {
  color: HTMLCanvasElement;
  rm: HTMLCanvasElement;
  faces: Record<FaceId, Rect>;
  swatches: Record<SwatchId, Rect>;
}

const rmColor = (rough: number, metal = 0) => `rgb(255, ${Math.round(rough * 255)}, ${Math.round(metal * 255)})`;

export function buildAtlas(v: Version): Atlas {
  const color = document.createElement('canvas');
  color.width = ATLAS_W;
  color.height = ATLAS_H;
  const ctx = color.getContext('2d')!;
  const rm = document.createElement('canvas');
  rm.width = ATLAS_W / RM_SCALE;
  rm.height = ATLAS_H / RM_SCALE;
  const rmx = rm.getContext('2d')!;
  rmx.fillStyle = rmColor(0.9);
  rmx.fillRect(0, 0, rm.width, rm.height);

  const faces = {} as Record<FaceId, Rect>;
  (Object.keys(FACES) as FaceId[]).forEach((id, i) => {
    const face = FACES[id];
    const cx = (i % 4) * CELL;
    const cy = Math.floor(i / 4) * CELL;
    const [w, h] = face.size;
    const scale = FACE / Math.max(w, h);
    const fw = Math.round(w * scale);
    const fh = Math.round(h * scale);
    const r = { x: cx + Math.round((CELL - fw) / 2), y: cy + Math.round((CELL - fh) / 2), w: fw, h: fh };
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.beginPath();
    ctx.rect(0, 0, fw, fh);
    ctx.clip();
    face.draw(ctx, fw, fh, v);
    ctx.restore();
    rmx.fillStyle = rmColor(face.rough, 'metal' in face ? (face.metal as number) : 0);
    rmx.fillRect(r.x / RM_SCALE, r.y / RM_SCALE, r.w / RM_SCALE, r.h / RM_SCALE);
    faces[id] = r;
  });

  const swatches = {} as Record<SwatchId, Rect>;
  const base = Object.keys(FACES).length;
  const sx = (base % 4) * CELL;
  const sy = Math.floor(base / 4) * CELL;
  (Object.keys(SWATCHES) as SwatchId[]).forEach((id, i) => {
    const s = SWATCHES[id] as { color: string | ((v: Version) => string); rough: number; metal?: number };
    const r = { x: sx + (i % 8) * (SWATCH + 8) + 8, y: sy + Math.floor(i / 8) * (SWATCH + 8) + 8, w: SWATCH, h: SWATCH };
    ctx.fillStyle = typeof s.color === 'function' ? s.color(v) : s.color;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    rmx.fillStyle = rmColor(s.rough, s.metal ?? 0);
    rmx.fillRect(r.x / RM_SCALE - 1, r.y / RM_SCALE - 1, r.w / RM_SCALE + 2, r.h / RM_SCALE + 2);
    swatches[id] = r;
  });
  return { color, rm, faces, swatches };
}

