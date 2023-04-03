import {AttributesDefTool, IdHelper} from './def_tool.ts';
import {Attributes, AttributesBuilder, createElement} from './elements.ts';
import * as figures from './figures.ts';
import {generateId} from './ids.ts';
import {Piece, PiecePartArg} from './pieces.ts';
import {Transform} from './transform.ts';
import {OrArray} from './util.ts';

interface AttributesAndId {
  attributes?: Attributes;
  id?: string;
}

type PiecesArg = OrArray<PiecePartArg | undefined>;
type PiecesAttributesAndId<P extends string = "pieces"> = AttributesAndId & {
  [key in P]: PiecesArg;
}
type PartialPieceAttributesAndId<P extends string> =
  PiecesArg | PiecesAttributesAndId<P>;

function isPiecesArg<P extends string>(
  arg: PartialPieceAttributesAndId<P>, piecesPath: P): arg is PiecesArg {
  return !(arg && Object.getPrototypeOf(arg) === Object.prototype &&
    Object.hasOwn(arg, piecesPath));
}

function piecesAttributesAndIdFromPartial<P extends string>(
  arg: PartialPieceAttributesAndId<P>, piecesPath: P): PiecesAttributesAndId {
  if (isPiecesArg(arg, piecesPath))
    return {pieces: arg};
  const {attributes, id, [piecesPath]: pieces} = arg;
  return {attributes, id, pieces};
}

/**
 * Creates a clip path AttributesDefTool, used to restrict the painting region of a Piece.
 *
 * Usage example:
 *
 *     myPiece.useDefTool(createClipPath({...}))
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/clipPath
 */
export function createClipPath(path: PiecesArg): AttributesDefTool;
/**
 * Creates a clip path AttributesDefTool, used to restrict the painting region of a Piece.
 *
 * Usage example:
 *
 *     myPiece.useDefTool(createClipPath({...}))
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/clipPath
 */
export function createClipPath(args: {
  paths: PiecePartArg,
  attributes?: Attributes,
  id?: string,
}): AttributesDefTool;
export function createClipPath(arg: PartialPieceAttributesAndId<"paths">) {
  const {pieces, attributes, id} = piecesAttributesAndIdFromPartial(arg, "paths");
  return Piece.createElement({
    tagName: "clipPath",
    children: pieces,
    attributes,
  }).asDefTool(id).useByAttribute("clip-path");
}

/**
 * Creates an alpha mask AttributesDefTool.
 * @deprecated Use Mask instead.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/mask
 */
export function createMask(mask: PiecesArg): AttributesDefTool;
/**
 * Creates an alpha mask AttributesDefTool.
 * @deprecated Use Mask instead.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/mask
 */
export function createMask(args: {
  mask: PiecePartArg,
  attributes?: Attributes,
  id?: string,
}): AttributesDefTool;
export function createMask(arg: PartialPieceAttributesAndId<"mask">) {
  const {pieces, attributes, id} = piecesAttributesAndIdFromPartial(arg, "mask");
  return Piece.createElement({
    tagName: "mask",
    children: pieces,
    attributes,
  }).asDefTool(id).useByAttribute("mask");
}

export interface MaskPartAttributes {
  /** Whether to include fill. */
  fill?: boolean;
  /** Whether to include stroke, optionally with stroke width. */
  stroke?: boolean | number;
}

function applyMaskPartAttributes(
  maskPiece: Piece,
  color: string, {
    fill = true,
    stroke,
  }: MaskPartAttributes = {},
) {
  const attributes: AttributesBuilder = {};
  if (fill === false)
    attributes.fill = "none";
  else if (fill === true)
    attributes.fill = color;
  if (stroke) {
    attributes.stroke = color;
    if (typeof stroke === "number")
      attributes.strokeWidth = stroke;
  }
  return maskPiece.setAttributes(attributes);
}

const DEFAULT_EVERYTHING_MASK_SIDE = 1e6;

function everythingRect(side: number) {
  return figures.rectangle({centered: true, side});
}

/**
 * An object representing a mask.
 *
 * Usage example:
 *
 *     myPiece.useDefTool(Mask.incl(...).excl(...))
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/mask
 */
export class Mask implements AttributesDefTool {

  static readonly NOTHING = new Mask(Piece.EMPTY, {}, "mask_nothing");
  static readonly EVERYTHING = Mask.incl(everythingRect(DEFAULT_EVERYTHING_MASK_SIDE))
    .setId("mask_everything");

  private genId;

  protected constructor(
    readonly mask: Piece,
    private readonly attributes: Attributes | undefined,
    private readonly id: string | undefined,
  ) {
    this.genId = id;
  }

  static everything(everythingSide?: number) {
    return everythingSide ? Mask.incl(everythingRect(everythingSide)) : Mask.EVERYTHING;
  }

  static incl(includePart: Piece, maskPartAttributes?: MaskPartAttributes) {
    return Mask.NOTHING.incl(includePart, maskPartAttributes);
  }

  static excl(excludePart: Piece, {
    everythingSide,
    ...maskPartAttributes
  }: {everythingSide?: number} & MaskPartAttributes = {}) {
    return Mask.everything(everythingSide).excl(excludePart, maskPartAttributes);
  }

  static create(mask: Piece, {attributes, id}: {
    attributes?: Attributes,
    id?: string,
  } = {}) {
    return new Mask(mask, attributes, id);
  }

  add(maskPart: Piece) {
    return new Mask(this.mask.add(maskPart), this.attributes, undefined);
  }

  incl(includePart: Piece, maskPartAttributes?: MaskPartAttributes) {
    return this.add(applyMaskPartAttributes(includePart, "white", maskPartAttributes));
  }

  excl(excludePart: Piece, maskPartAttributes?: MaskPartAttributes) {
    return this.add(applyMaskPartAttributes(excludePart, "black", maskPartAttributes));
  }

  setAttributes(attributes: Attributes) {
    return new Mask(this.mask, {...this.attributes, ...attributes}, undefined);
  }

  setId(id: string) {
    return new Mask(this.mask, this.attributes, id);
  }

  getDefs() {
    return [createElement({
      tagName: "mask",
      attributes: {id: this.getId()},
      children: this.mask.getElements(),
    })];
  }

  asAttributes() {
    return {mask: new IdHelper(this.getId()).url};
  }

  private getId() {
    if (!this.genId)
      this.genId = generateId("mask");
    return this.genId;
  }

}

/**
 * Value of a coordinate, expressed as the fraction of size.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
 */
export type GradientCoordFrac = number;
export type GradientFracPoint = readonly [GradientCoordFrac | undefined, GradientCoordFrac | undefined];

export interface GradientStopValue {
  readonly color?: string;
  readonly opacity?: number;
}

export interface GradientStop extends GradientStopValue {
  readonly offset: number;
}

export type GradientStops = GradientStop[];

export interface GradientStopFunc {
  (offset: number): GradientStopValue | undefined;
}

const DEFAULT_NUM_STOPS_FOR_FUNC = 11;

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
      return arg.length !== 2 || Object.hasOwn(arg[0], "offset");
    }
    if (isGradientStops(arg))
      return arg;
    return [0, 1].map(offset => ({offset, ...arg[offset]}));
  }
  const {
    startOffset = 0,
    endOffset = 1,
    numStops = DEFAULT_NUM_STOPS_FOR_FUNC,
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

const NO_POINT: GradientFracPoint = [undefined, undefined];

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

/**
 * Creates a linear gradient GenericDefTool, usable as fill or stroke.
 *
 * Usage example:
 *
 *     myPiece.useDefTool(createLinearGradient({...}), "stroke")
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient
 */
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
  from?: GradientFracPoint,
  to?: GradientFracPoint,
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

export interface RadialGradientEnd {
  readonly center?: GradientFracPoint;
  readonly radius?: GradientCoordFrac;
}

/**
 * Creates a radial gradient GenericDefTool, usable as fill or stroke.
 *
 * Usage example:
 *
 *     myPiece.useDefTool(createRadialGradient({...}), "fill")
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient
 */
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
      cx: circle.center?.[0],
      cy: circle.center?.[1],
      r: circle.radius,
      fx: from.center?.[0],
      fy: from.center?.[1],
      fr: from.radius,
      gradientTransform: transform?.svgTransform,
      ...attributes,
    },
  }).asDefTool(id);
}
