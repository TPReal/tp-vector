import {Point, isPoint} from './point.ts';

export type OrArray<T> = T | T[];
export type OrArrayRest<T> = OrArray<T>[];

export function flatten<T>(items: OrArrayRest<T>): T[];
export function flatten<T>(items: OrArray<T>): T[];
export function flatten<T>(items: OrArray<T> | OrArrayRest<T>): T[] {
  if (Array.isArray(items))
    return items.flat(2) as T[];
  return [items];
}

export function flattenFilter<T>(items: OrArrayRest<T>): Exclude<T, undefined>[];
export function flattenFilter<T>(items: OrArray<T>): Exclude<T, undefined>[];
export function flattenFilter<T>(items: OrArray<T> | OrArrayRest<T>): Exclude<T, undefined>[] {
  return (flatten(items) as T[]).filter((e): e is Exclude<T, undefined> => e !== undefined);
}

export function flattenPoints(points: OrArrayRest<Point>): Point[];
export function flattenPoints(points: OrArray<Point>): Point[];
export function flattenPoints(points: OrArray<Point> | OrArrayRest<Point>): Point[] {
  if (Array.isArray(points))
    return (points as OrArrayRest<Point>).flatMap(p => isPoint(p) ? [p] : p);
  return [points];
}

export function round(v: number, {
  maxDigits = 6,
  maxRelativeError = 1e-6,
} = {}) {
  for (let digits = 0; digits < maxDigits; digits++) {
    const str = v.toFixed(digits);
    if (Math.abs(v - Number(str)) / v <= maxRelativeError)
      return str;
  }
  return v.toFixed(maxDigits);
}

type Truthy<T> = Exclude<T, null | undefined | 0 | "" | false>;
export function assert<T>(value: T, message?: string): Truthy<T> {
  if (!value)
    throw new Error(message || `Expected truthy, got ${value}`);
  return value as Truthy<T>;
}

export function assertNumber(value: unknown): number {
  if (typeof value !== "number")
    throw new Error(`Assertion failed, expected number, got ${value}`);
  return value;
}

export function almostEqual(a: number, b: number, {tolerance = 1e-9} = {}) {
  const diff = a - b;
  return diff >= -tolerance && diff <= tolerance;
}

const REASONABLE_SIGNIFICANT_DIGITS = 5;
const REASONABLE_ZERO_TOLERANCE = 1e-9;

export function roundReasonably(value: number, {
  significantDigits = REASONABLE_SIGNIFICANT_DIGITS,
  zeroTolerance = REASONABLE_ZERO_TOLERANCE,
} = {}): string {
  if (!Number.isFinite(value))
    return String(value);
  if (!value)
    return "0";
  const absValue = Math.abs(value);
  if (absValue <= zeroTolerance)
    return "0";
  const mult = 10 ** (significantDigits - 1 - Math.floor(Math.log10(absValue)));
  return String(Math.round(value * mult) / mult);
}

export function sinCos(angleDeg: number): [number, number] {
  const angleRad = angleDeg / 180 * Math.PI;
  return [Math.sin(angleRad), Math.cos(angleRad)];
}
