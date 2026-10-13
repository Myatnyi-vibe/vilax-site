// Общие математические помощники сцены слияния: всё состояние — чистые функции доли прокрутки p ∈ [0, 1].

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function smoothstep(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
export const easeInCubic = (t: number) => t * t * t;
export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
export const easeInQuad = (t: number) => t * t;
/** Дробная часть, всегда в [0, 1). */
export const frac = (x: number) => x - Math.floor(x);
/** Колокол: 0 до a, 1 в пике b, 0 после c. */
export const bump = (x: number, a: number, b: number, c: number) => (x < b ? smoothstep(a, b, x) : 1 - smoothstep(b, c, x));

/** Детерминированный генератор: одинаковая раскладка при каждой загрузке. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
