import {Piece, PieceFunc} from './pieces.ts';
import {Turtle, TurtleFunc} from './turtle.ts';

export interface FinderParams {
  readonly min: number;
  readonly max: number;
  readonly resolution: number;
  readonly startStep: number;
  readonly maxStep: number;
  readonly valueOnNotFound: number | undefined;
}

interface PartialFinderParams extends Partial<FinderParams> {
}

function finderParamsFromPartial({
  min = 0,
  max = 1e6,
  resolution = 1e-3,
  startStep = 1,
  maxStep = max,
  valueOnNotFound,
}: PartialFinderParams = {}): FinderParams {
  return {min, max, resolution, startStep, maxStep, valueOnNotFound};
}

/**
 * Uses a binary search to find a value of `x` that satisfies `value(x) === 0` as good as possible,
 * i.e. such that `value(x)` changes sign around this value.
 */
export function solveForZero(value: (x: number) => number, params?: PartialFinderParams) {
  const {resolution, min, max, startStep, maxStep, valueOnNotFound} = finderParamsFromPartial(params);
  let x1 = min;
  let y1 = value(x1);
  if (y1 === 0)
    return x1;
  let step = startStep;
  let x2 = Number.NaN;
  let y2 = Number.NaN;
  function stepCrosses() {
    x2 = Math.min(Math.max(x1 + step, min), max);
    y2 = value(x2);
    return y1 * y2 <= 0;
  }
  function setX1() {
    x1 = x2;
    y1 = y2;
  }
  while (!stepCrosses()) {
    if (x2 === max) {
      if (valueOnNotFound !== undefined)
        return valueOnNotFound;
      throw new Error(
        `No zero found in the range (min=${min}, value(min)=${y1}, max=${max}, value(max)=${y2})`);
    }
    step = Math.min(step * 2, maxStep);
    setX1();
  }
  while (step > resolution) {
    step /= 2;
    if (!stepCrosses())
      setX1()
  }
  return x1;
}

function turtleFinderParamsFromPartial({
  min = 1e-3,
  max = 1000,
  resolution = 1e-3,
  startStep = 1,
  maxStep = max,
  valueOnNotFound,
}: PartialFinderParams = {}): FinderParams {
  return {min, max, resolution, startStep, maxStep, valueOnNotFound};
}

/**
 * Finds the value of `x` with which `t.andThen(action, x)` gives the best result.
 * A good result is one that satisfies `findZero(t) === 0` as good as possible,
 * i.e. such that `findZero(t)` changes sign around this point.
 */
export function turtleSolve(t: Turtle, {action, testAction = action, findZero, params}: {
  action: TurtleFunc<[x: number]>,
  testAction?: TurtleFunc<[x: number]>
  findZero: (t: Turtle, appliedX: number) => number,
  params?: PartialFinderParams,
}) {
  return action(t,
    solveForZero(x => findZero(t.andThen(testAction, x), x), turtleFinderParamsFromPartial(params)));
}

/**
 * Finds the value of `x` with which `piece.andThen(func, x)` gives the best result.
 * A good result is one that satisfies `findZero(result) === 0` as good as possible,
 * i.e. such that `findZero(result)` changes sign around this point.
 *
 * Note: In case of type inference issues, call explicitly like this:
 *
 *     somePiece.andThen(pc => pieceSolve(pc, {...})
 */
export function pieceSolve<P extends Piece, R = P>(piece: P, {func, findZero, params}: {
  func: PieceFunc<P, R, [x: number]>,
  findZero: (result: R, appliedX: number) => number,
  params?: PartialFinderParams,
}): R;
export function pieceSolve<P extends Piece, T = P, R = P>(piece: P, {func, testFunc, findZero, params}: {
  func: PieceFunc<P, R, [x: number]>,
  testFunc: PieceFunc<P, T, [x: number]>,
  findZero: (result: T, appliedX: number) => number,
  params?: PartialFinderParams,
}): R;
export function pieceSolve<P extends Piece, T = P, R = P>(piece: P, {func, testFunc, findZero, params}: {
  func: PieceFunc<P, R, [x: number]>,
  testFunc?: PieceFunc<P, T, [x: number]>,
  findZero: (result: T, appliedX: number) => number,
  params?: PartialFinderParams,
}) {
  return func(piece, solveForZero(x => findZero((testFunc || func as NonNullable<typeof testFunc>)(piece, x), x), params));
}
