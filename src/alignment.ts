import {Axis} from './axis.ts';

/**
 * Method of fitting an object into a rectangle.
 *  - `"fit"`: scale proportionally so that the whole object fits inside the rectangle.
 *  - `"fill"`: scale proportionally so that the whole rectangle is covered (but parts of
 *    the object might go outside of it).
 *  - `"stretch"`: fit the object exactly to the rectangle, scaling X and Y axes separately.
 */
export type Fitting = "fit" | "fill" | "stretch";

interface AlignmentValues<Lower, Center, Upper> {
  lower: Lower;
  center: Center;
  upper: Upper;
}
type AlignmentValuesUnion<Values> =
  Values extends AlignmentValues<infer L, infer C, infer U> ? L | C | U : never;

interface AxisOriginAlignmentValuesMap {
  [Axis.X]: AlignmentValues<"rightOfOrigin", "center", "leftOfOrigin">;
  [Axis.Y]: AlignmentValues<"belowOrigin", "center", "aboveOrigin">;
}

export type AxisOriginAlignmentValues<A extends Axis> = AxisOriginAlignmentValuesMap[A];
export type AxisOriginAlignment<A extends Axis> =
  AlignmentValuesUnion<AxisOriginAlignmentValues<A>>;

export interface OriginAlignment {
  readonly x?: AxisOriginAlignment<Axis.X>;
  readonly y?: AxisOriginAlignment<Axis.Y>;
}
export type RequiredOriginAlignment = Required<OriginAlignment>;
/** Alignment of an object in relation to the origin. */
export type PartialOriginAlignment = OriginAlignment | "default" | "center";

export function originAlignmentFromPartial(alignment: PartialOriginAlignment = "default"):
  OriginAlignment {
  if (alignment === "default")
    return DEFAULT_ORIGIN_ALIGNMENT;
  if (alignment === "center")
    return CENTER_ALIGNMENT;
  return alignment;
}
export function requiredOriginAlignmentFromPartial(alignment: PartialOriginAlignment = "default"):
  RequiredOriginAlignment {
  return {...DEFAULT_ORIGIN_ALIGNMENT, ...originAlignmentFromPartial(alignment)};
}

interface AxisBoxAlignmentValuesMap {
  [Axis.X]: AlignmentValues<"left", "center", "right">;
  [Axis.Y]: AlignmentValues<"top", "center", "bottom">;
}

export type AxisBoxAlignmentValues<A extends Axis> = AxisBoxAlignmentValuesMap[A];
export type AxisBoxAlignment<A extends Axis> =
  AlignmentValuesUnion<AxisBoxAlignmentValues<A>>;

export interface BoxAlignment {
  readonly x?: AxisBoxAlignment<Axis.X>;
  readonly y?: AxisBoxAlignment<Axis.Y>;
}
export type RequiredBoxAlignment = Required<BoxAlignment>;
/** Alignment of an object in relation to a ViewBox. */
export type PartialBoxAlignment = BoxAlignment | "default" | "center";

export function boxAlignmentFromPartial(alignment: PartialBoxAlignment = "default"): BoxAlignment {
  if (alignment === "default")
    return DEFAULT_BOX_ALIGNMENT;
  if (alignment === "center")
    return CENTER_ALIGNMENT;
  return alignment;
}
export function requiredBoxAlignmentFromPartial(alignment: PartialBoxAlignment = "default"):
  RequiredBoxAlignment {
  return {...DEFAULT_BOX_ALIGNMENT, ...boxAlignmentFromPartial(alignment)};
}

const DEFAULT_ORIGIN_ALIGNMENT: RequiredOriginAlignment = {x: "rightOfOrigin", y: "belowOrigin"};
const DEFAULT_BOX_ALIGNMENT: RequiredBoxAlignment = {x: "left", y: "top"};
const CENTER_ALIGNMENT: RequiredOriginAlignment & RequiredBoxAlignment = {x: "center", y: "center"};

export type AlignmentNumber = 0 | 0.5 | 1;

export function alignmentToNumber(
  alignment: AxisOriginAlignment<Axis> | AxisBoxAlignment<Axis>): AlignmentNumber {
  switch (alignment) {
    case "rightOfOrigin":
    case "belowOrigin":
    case "left":
    case "top":
      return 0;
    case "center":
      return 0.5;
    case "leftOfOrigin":
    case "aboveOrigin":
    case "right":
    case "bottom":
      return 1;
    default:
      throw new Error(`Unexpected argument: ${alignment}`);
  }
}
