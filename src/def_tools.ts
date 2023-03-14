import {Attributes} from './elements.ts';
import {Piece, PiecePartArg} from './pieces.ts';
import {Point} from './point.ts';
import {Transform} from './transform.ts';
import {OrArray, hasOwnProperty} from './util.ts';

interface AttributesAndId {
  attributes?: Attributes;
  id?: string;
}

type PiecesAttributesAndId<P extends string = "pieces"> = AttributesAndId & {
  [key in P]: OrArray<PiecePartArg | undefined>;
}
type PartialPieceAttributesAndId<P extends string> =
  PiecePartArg | PiecesAttributesAndId<P>;

function isPiecePartArg<P extends string>(
  arg: PartialPieceAttributesAndId<P>, piecesPath: P): arg is PiecePartArg {
  return !(Object.getPrototypeOf(arg) === Object.prototype &&
    hasOwnProperty(arg, piecesPath));
}

function piecesAttributesAndIdFromPartial<P extends string>(
  arg: PartialPieceAttributesAndId<P>, piecesPath: P): PiecesAttributesAndId {
  if (isPiecePartArg(arg, piecesPath))
    return {pieces: arg};
  const {attributes, id, [piecesPath]: pieces} = arg;
  return {attributes, id, pieces};
}

export function createClipPath(arg: PartialPieceAttributesAndId<"paths">) {
  const {pieces, attributes, id} = piecesAttributesAndIdFromPartial(arg, "paths");
  return Piece.createElement({
    tagName: "clipPath",
    children: pieces,
    attributes,
  }).asDefTool(id).useByAttribute("clip-path");
}

export function createMask(arg: PartialPieceAttributesAndId<"mask">) {
  const {pieces, attributes, id} = piecesAttributesAndIdFromPartial(arg, "mask");
  return Piece.createElement({
    tagName: "mask",
    children: pieces,
    attributes,
  }).asDefTool(id).useByAttribute("mask");
}

type AttributeValue = number | string;
type AttributePoint = Point | [AttributeValue | undefined, AttributeValue | undefined];

export interface GradientStopValue {
  readonly color?: string;
  readonly opacity?: number | string;
}

export interface GradientStop extends GradientStopValue {
  readonly offset: number | string;
}

export type GradientStops = GradientStop[];

export interface GradientStopFunc {
  (offset: number): GradientStopValue | undefined;
}

export interface GradientStopsFuncWithRange {
  startOffset?: number;
  endOffset?: number;
  numStops?: number;
  offsetStep?: number;
  func: GradientStopFunc;
}

export type PartialGradientStops =
  | GradientStops
  | [GradientStopValue, GradientStopValue]
  | GradientStopFunc
  | GradientStopsFuncWithRange;

export function gradientStopsFromPartial(arg: PartialGradientStops): GradientStops {
  if (Array.isArray(arg)) {
    function isGradientStops(arg: GradientStops | [GradientStopValue, GradientStopValue]):
      arg is GradientStops {
      return arg.length !== 2 || hasOwnProperty(arg[0], "offset");
    }
    if (isGradientStops(arg))
      return arg;
    return [0, 1].map(offset => ({offset, ...arg[offset]}));
  }
  const {
    startOffset = 0,
    endOffset = 1,
    numStops = 11,
    offsetStep = (endOffset - startOffset) / (numStops - 1),
    func,
  } = typeof arg === "function" ? {func: arg} satisfies GradientStopsFuncWithRange : arg;
  if (offsetStep <= 0)
    throw new Error(`Expected positive offset step, got ${offsetStep}`);
  const stops = [];
  for (let offset = startOffset; offset <= endOffset + 1e-9; offset += offsetStep) {
    const value = func(offset);
    if (value)
      stops.push({offset, ...value});
  }
  return stops;
}

export interface RadialGradientEnd {
  readonly center?: AttributePoint;
  readonly radius?: AttributeValue;
}

const NO_POINT: AttributePoint = [undefined, undefined];

function createStopElement({offset, color, opacity}: GradientStop) {
  return Piece.createElement({
    tagName: "stop",
    attributes: {
      offset,
      stopColor: color,
      stopOpacity: opacity,
    },
  });
}

export function createLinearGradient({
  stops,
  spread,
  from = NO_POINT,
  to = NO_POINT,
  transform,
  attributes,
  id,
}: {
  stops: PartialGradientStops,
  spread?: "pad" | "reflect" | "repeat",
  from?: AttributePoint,
  to?: AttributePoint,
  transform?: Transform,
} & AttributesAndId) {
  return Piece.createElement({
    tagName: "linearGradient",
    children: gradientStopsFromPartial(stops).map(createStopElement),
    attributes: {
      spreadMethod: spread,
      x1: from[0],
      y1: from[1],
      x2: to[0],
      y2: to[1],
      gradientTransform: transform?.svgTransform,
      ...attributes,
    },
  }).asDefTool(id);
}

export function createRadialGradient({
  stops,
  spread,
  circle = {},
  from = {},
  transform,
  attributes,
  id,
}: {
  stops: PartialGradientStops,
  spread?: "pad" | "reflect" | "repeat",
  circle?: RadialGradientEnd,
  from?: RadialGradientEnd,
  transform?: Transform,
} & AttributesAndId) {
  return Piece.createElement({
    tagName: "radialGradient",
    children: gradientStopsFromPartial(stops).map(createStopElement),
    attributes: {
      spreadMethod: spread,
      cx: circle.center && circle.center[0],
      cy: circle.center && circle.center[1],
      r: circle.radius,
      fx: from.center && from.center[0],
      fy: from.center && from.center[1],
      fr: from.radius,
      gradientTransform: transform && transform.svgTransform,
      ...attributes,
    },
  }).asDefTool(id);
}
