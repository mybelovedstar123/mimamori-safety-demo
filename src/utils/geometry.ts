import type { Rng } from './random';

type Pt = [number, number];

export function pointInPolygon([x, y]: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** ポリゴン内部のランダムな点（境界から少し内側） */
export function randomPointIn(poly: Pt[], rng: Rng): Pt {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  for (let i = 0; i < 200; i++) {
    const p: Pt = [rng.int(minX + 18, maxX - 18), rng.int(minY + 18, maxY - 18)];
    const probes: Pt[] = [p, [p[0] + 14, p[1]], [p[0] - 14, p[1]], [p[0], p[1] + 14], [p[0], p[1] - 14]];
    if (probes.every((q) => pointInPolygon(q, poly))) return p;
  }
  return [Math.round((minX + maxX) / 2), Math.round((minY + maxY) / 2)];
}

export const polygonPoints = (poly: Pt[]) => poly.map((p) => p.join(',')).join(' ');
