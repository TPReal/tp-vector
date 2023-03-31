import {almostEqual} from './util.ts';

/** A rectangle defining bounding box of an element, or the view box of the SVG. */
export interface ViewBox {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export interface IncompleteDimSpec {
  readonly pos?: "default" | "center";
  readonly min?: number;
  readonly max?: number;
  readonly len?: number;
}

export type FullDimSpec =
  IncompleteDimSpec & Pick<Required<IncompleteDimSpec>, "min" | "max" | "len">;

export type DefiniteDimSpec =
  Pick<Required<IncompleteDimSpec>, "min" | "max"> |
  Pick<Required<IncompleteDimSpec>, "min" | "len"> |
  Pick<Required<IncompleteDimSpec>, "max" | "len"> |
  Pick<Required<IncompleteDimSpec>, "min" | "pos"> |
  Pick<Required<IncompleteDimSpec>, "max" | "pos"> |
  Pick<Required<IncompleteDimSpec>, "len" | "pos">;

export interface DimSpec {
  readonly min: number;
  readonly len: number;
}

interface IncompleteDimSpecData {
  readonly inferred: IncompleteDimSpec;
  readonly forceInferred?: DimSpec;
  readonly error?: string;
}
interface DefiniteDimSpecData {
  readonly inferred: FullDimSpec;
  readonly forceInferred?: DimSpec;
  readonly error?: string;
}

function getDimSpecData(dimSpec: DefiniteDimSpec): DefiniteDimSpecData;
function getDimSpecData(dimSpec: IncompleteDimSpec): IncompleteDimSpecData;
function getDimSpecData(input: IncompleteDimSpec) {
  const {pos, min, max, len} = input;
  const incompatibleDimensions: IncompleteDimSpecData = {
    inferred: input,
    error: `Incompatible dimensions`,
  };
  function ret({min, max, len, forced = false}:
    {min: number, max: number, len: number, forced?: boolean}) {
    let lPos = pos;
    if (!almostEqual(len, max - min))
      return incompatibleDimensions;
    if (lPos === "default" && min)
      return incompatibleDimensions;
    const centered = almostEqual(max, -min);
    if (lPos === "center" && !centered)
      return incompatibleDimensions;
    if (!lPos) {
      if (!min)
        lPos = "default";
      else if (centered)
        lPos = "center";
    }
    let error: string | undefined;
    if (len < 0)
      error = `Negative dimension length`;
    return {
      inferred: forced ? input : {pos: lPos, min, max, len},
      forceInferred: {min, len},
      error,
    };
  }
  if (min !== undefined) {
    if (max !== undefined) {
      if (len !== undefined)
        return ret({min, max, len});
      return ret({min, max, len: max - min});
    }
    if (len !== undefined)
      return ret({min, max: min + len, len});
    if (pos === "default")
      return ret({min, max: 0, len: 0});
    if (pos === "center")
      return ret({min, max: -min, len: -2 * min});
    return ret({min, max: 0, len: -min, forced: true});
  }
  if (max !== undefined) {
    if (len !== undefined)
      return ret({min: max - len, max, len});
    if (pos === "default")
      return ret({min: 0, max, len: max});
    if (pos === "center")
      return ret({min: -max, max, len: 2 * max});
    return ret({min: 0, max, len: max, forced: true});
  }
  if (len !== undefined) {
    if (pos === "default")
      return ret({min: 0, max: len, len});
    if (pos === "center")
      return ret({min: -len / 2, max: len / 2, len});
    return ret({min: 0, max: len, len, forced: true});
  }
  if (!pos || pos === "default")
    return ret({min: 0, max: 1, len: 1, forced: true});
  return ret({min: -0.5, max: 0.5, len: 1, forced: true});
}

export function inferDimSpec(spec: DefiniteDimSpec): FullDimSpec;
export function inferDimSpec(spec: IncompleteDimSpec): IncompleteDimSpec;
export function inferDimSpec(spec: IncompleteDimSpec) {
  return getDimSpecData(spec).inferred;
}

export function dimSpecFromIncomplete(spec?: IncompleteDimSpec): DimSpec {
  const {forceInferred, error} = getDimSpecData(spec || {});
  if (!forceInferred)
    throw new Error(`Error in partial dimension spec: ${error || `(unknown)`} ` +
      `(input: ${JSON.stringify(spec)})`);
  return forceInferred;
}

export interface PartialViewBoxFlat {
  centered?: boolean;
  side?: number;
  centeredX?: boolean;
  minX?: number;
  maxX?: number;
  width?: number;
  centeredY?: boolean;
  minY?: number;
  maxY?: number;
  height?: number;
  margin?: PartialViewBoxMargin;
}
export interface PartialViewBoxSeparate {
  x?: IncompleteDimSpec;
  y?: IncompleteDimSpec;
  margin?: PartialViewBoxMargin;
}
export type PartialViewBox = PartialViewBoxFlat | PartialViewBoxSeparate;

export function viewBoxFromPartial(viewBox?: PartialViewBox): ViewBox {
  const {x, y, margin} = partialViewBoxToSeparate(viewBox);
  const {min: minX, len: width} = dimSpecFromIncomplete(x);
  const {min: minY, len: height} = dimSpecFromIncomplete(y);
  return extendViewBox({minX, minY, width, height}, margin);
}

export function partialViewBoxToXY(viewBox: PartialViewBox) {
  const {x, y, margin} = partialViewBoxToSeparate(viewBox);
  const {left, right, top, bottom} = viewBoxMarginFromPartial(margin);
  function expandByMargin(
    dimSpec: IncompleteDimSpec | undefined, lowerMargin: number, upperMargin: number): DimSpec {
    const {min, len} = dimSpecFromIncomplete(dimSpec);
    return {
      min: min - lowerMargin,
      len: len + lowerMargin + upperMargin,
    };
  }
  return {
    x: expandByMargin(x, left, right),
    y: expandByMargin(y, top, bottom),
  };
}

function partialViewBoxToSeparate(viewBox: PartialViewBox = {}): PartialViewBoxSeparate {
  const {
    centered,
    centeredX = centered,
    centeredY = centered,
    side,
    minX, maxX,
    width = side,
    minY, maxY,
    height = side,
    x = {pos: centeredX ? "center" : undefined, min: minX, max: maxX, len: width},
    y = {pos: centeredY ? "center" : undefined, min: minY, max: maxY, len: height},
    margin,
  }: Partial<PartialViewBoxFlat & PartialViewBoxSeparate> = viewBox;
  return {x, y, margin};
}

/**
 * Margin around a ViewBox. Positive values point outside of the rectangle, enlarging it,
 * negative values point inside, shrinking it.
 */
export interface ViewBoxMargin {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}
export interface PartialViewBoxMarginInterface {
  value?: number;
  x?: number;
  y?: number;
  left?: number;
  right?: number;
  top?: number;
  bottom?: number;
}
export type PartialViewBoxMargin = PartialViewBoxMarginInterface | number;
export function viewBoxMarginFromPartial(partial: PartialViewBoxMargin = {}, defaultValue = 0):
  ViewBoxMargin {
  return (({
    value = defaultValue,
    x = value,
    y = value,
    left = x,
    right = x,
    top = y,
    bottom = y,
  }) => ({left, right, top, bottom}))(
    typeof partial === "number" ? {value: partial} : partial);
}

/** Returns the ViewBox created from `element.getBBox()`. */
export function viewBoxFromBBox(element: SVGGraphicsElement): ViewBox {
  const {x: minX, y: minY, width, height} = element.getBBox();
  return {minX, minY, width, height};
}

/**
 * Multiplies the specified margin by the specified multiplier. The multiplier can specify
 * different values for different sides, and defaults to 1 for the unspecified values.
 */
export function multiplyMargin(
  {left, right, top, bottom}: ViewBoxMargin,
  multiplier: PartialViewBoxMargin): ViewBoxMargin {
  const {left: leftMult, right: rightMult, top: topMult, bottom: bottomMult} =
    viewBoxMarginFromPartial(multiplier, 1);
  return {
    left: left * leftMult,
    right: right * rightMult,
    top: top * topMult,
    bottom: bottom * bottomMult,
  };
}

/** Extends the ViewBox by the specified margin, or shrinks in case of negative margin. */
export function extendViewBox(
  {minX, minY, width, height}: ViewBox,
  margin?: PartialViewBoxMargin): ViewBox {
  const {left, right, top, bottom} = viewBoxMarginFromPartial(margin);
  return {
    minX: minX - left,
    width: width + left + right,
    minY: minY - top,
    height: height + top + bottom,
  };
}

/** Returns the actual margin between the bounding box and the view box. */
export function getMargin({boundingBox, viewBox}: {
  boundingBox: ViewBox,
  viewBox: ViewBox,
}): ViewBoxMargin {
  return {
    left: boundingBox.minX - viewBox.minX,
    right: (viewBox.minX + viewBox.width) - (boundingBox.minX + boundingBox.width),
    top: boundingBox.minY - viewBox.minY,
    bottom: (viewBox.minY + viewBox.height) - (boundingBox.minY + boundingBox.height),
  };
}

interface FitsInViewBoxArgs {
  boundingBox: ViewBox;
  viewBox: ViewBox;
  minMargin?: PartialViewBoxMargin;
}

const MARGIN_EPSILON_TO_SIZE_RATIO = 1e-9;

const MARGIN_SIDES: (keyof ViewBoxMargin)[] = ["left", "right", "top", "bottom"];

function getSidesFit({boundingBox, viewBox, minMargin = 0}: FitsInViewBoxArgs) {
  const epsilon = Math.max(viewBox.width, viewBox.height) * MARGIN_EPSILON_TO_SIZE_RATIO;
  const fullMinMargin = viewBoxMarginFromPartial(minMargin);
  const actualMargin = getMargin({boundingBox, viewBox});
  return MARGIN_SIDES.map(side => {
    const min = fullMinMargin[side];
    const actual = actualMargin[side];
    return {
      side,
      min,
      actual,
      fits: actual >= min - epsilon,
    };
  });
}

/**
 * Calculates whether the specified bounding box fits in the specified view box with at least
 * the specified minimum margin.
 */
export function fitsInViewBox(args: FitsInViewBoxArgs) {
  return getSidesFit(args).every(({fits}) => fits);
}

export function assertFitsInViewBox(args: FitsInViewBoxArgs) {
  const sidesFit = getSidesFit(args);
  if (sidesFit.every(({fits}) => fits))
    return;
  throw new Error(`The bounding box does not fit in the view box` +
    `(bounding box: ${viewBoxToString(args.boundingBox)}, ` +
    `view box: ${viewBoxToString(args.viewBox)}, ` +
    `sides: ${JSON.stringify(sidesFit)})`);
}

export function viewBoxToString({minX, minY, width, height}: ViewBox) {
  return [minX, minY, width, height].join(" ");
}
