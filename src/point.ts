import {roundReasonably} from './util.ts';

export type Point = readonly [number, number]

export function isPoint(arg: Point | {} | null | undefined): arg is Point {
  return Array.isArray(arg) && arg.length === 2 &&
    typeof arg[0] === "number" && typeof arg[1] === "number";
}

export function pointsToString(points: Point[]) {
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
