import {roundReasonably} from './util.ts';

export type Point = readonly [number, number]

export function isPoint(arg: Point | {} | null | undefined): arg is Point {
  return Array.isArray(arg) && arg.length === 2 &&
    typeof arg[0] === "number" && typeof arg[1] === "number";
}

export function pointsToString(points: readonly Point[]) {
  return points.map(([x, y]) =>
    `${roundReasonably(x)},${roundReasonably(y)}`
  ).join(" ");
}

export function pointDebugString(point: Point) {
  return `[${point.map(c => roundReasonably(c, {significantDigits: 4})).join(", ")}]`;
}

export function isZeroPoint([x, y]: Point) {
  return x === 0 && y === 0;
}

export function pointsDist([x1, y1]: Point, [x2, y2]: Point) {
  return Math.hypot(x2 - x1, y2 - y1);
}

export function pointsMid([x1, y1]: Point, [x2, y2]: Point, p = 0.5): Point {
  return [x1 * p + x2 * (1 - p), y1 * p + y2 * (1 - p)];
}
