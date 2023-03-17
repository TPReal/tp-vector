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
export function assert<T>(value: T): Truthy<T> {
  if (!value)
    throw new Error(`Assertion failed, expected truthy, got ${value}`);
  return value as Truthy<T>;
}

export function almostEqual(a: number, b: number, {maxError = 1e-9} = {}) {
  const diff = a - b;
  return diff >= -maxError && diff <= maxError;
}

export async function sleep(timeMillis: number) {
  await new Promise(resolve => setTimeout(resolve, timeMillis));
}
