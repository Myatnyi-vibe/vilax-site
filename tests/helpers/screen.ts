// Проекция сцены слияния на экран для проверок в тестах: та же камера, что в scene3d.ts (FOV 40, смотрит прямо на z = 0).
import { HALF, ITEMS, LOGO_H, LOGO_W, LOGO_Y, WIN, cameraAt, poseAt, rotation } from '../../src/scenes/fusion/choreo.ts';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const TAN = Math.tan((40 / 2) * (Math.PI / 180));

export function projector(p: number, W: number, H: number) {
  const aspect = W / H;
  const fit = Math.max(1, 1.5 / aspect);
  const cam = cameraAt(p);
  const cz = cam.z * fit;
  return (x: number, y: number, z: number): [number, number] => {
    const d = cz - z;
    const nx = (x - cam.x) / (d * TAN * aspect);
    const ny = (y - cam.y) / (d * TAN);
    return [(nx * 0.5 + 0.5) * W, (-ny * 0.5 + 0.5) * H];
  };
}

/** Экранная рамка предмета по восьми углам его OBB; null — предмет не виден. */
export function itemBox(i: number, p: number, W: number, H: number): Box | null {
  const o = poseAt(i, p);
  if (o.s < 0.05) return null;
  const R = rotation(o.rx, o.ry, o.rz);
  const h = HALF[ITEMS[i].kind];
  const pr = projector(p, W, H);
  const b: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  for (const sx of [-1, 1])
    for (const sy of [-1, 1])
      for (const sz of [-1, 1]) {
        const l = [sx * h[0] * o.s, sy * h[1] * o.s, sz * h[2] * o.s];
        const w = [0, 1, 2].map((r) => R[r][0] * l[0] + R[r][1] * l[1] + R[r][2] * l[2]);
        const [x, y] = pr(o.x + w[0], o.y + w[1], o.z + w[2]);
        b.x0 = Math.min(b.x0, x);
        b.y0 = Math.min(b.y0, y);
        b.x1 = Math.max(b.x1, x);
        b.y1 = Math.max(b.y1, y);
      }
  return b;
}

/** Окно и знак на экране — как FusionLayout в scene3d.ts. */
export function layoutAt(p: number, W: number, H: number) {
  const pr = projector(p, W, H);
  const [wx0, wy0] = pr(WIN.x0, WIN.y1, 0);
  const [wx1, wy1] = pr(WIN.x1, WIN.y0, 0);
  const [mx0, my0] = pr(-LOGO_W / 2, LOGO_Y + LOGO_H / 2, 0);
  const [mx1, my1] = pr(LOGO_W / 2, LOGO_Y - LOGO_H / 2, 0);
  return { win: { x0: wx0, y0: wy0, x1: wx1, y1: wy1 }, mark: { x0: mx0, y0: my0, x1: mx1, y1: my1 } };
}

export function overlapArea(a: Box, b: Box): number {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
  const h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? w * h : 0;
}

export const area = (b: Box) => (b.x1 - b.x0) * (b.y1 - b.y0);
