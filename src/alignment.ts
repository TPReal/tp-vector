import {Axis} from './axis.ts';

/**
 * Method of fitting an object into a rectangle.
 *  - `"fit"`: scale proportionally so that the whole object fits inside the rectangle.
 *  - `"fill"`: scale proportionally so that the whole rectangle is covered (but parts of
 *    the object might go outside of it).
 *  - `"stretch"`: fit the object exactly to the rectangle, scaling X and Y axes separately.
 */
export type Fitting = "fit" | "fill" | "stretch";

const ORIGIN_ALIGNMENT_VALUES = {
  [Axis.X]: {rightOfOrigin: -1, center: 0, leftOfOrigin: 1},
  [Axis.Y]: {belowOrigin: -1, center: 0, aboveOrigin: 1},
} satisfies Record<Axis, Record<string, AlignmentNumber>>;

export type AxisOriginAlignment = {
  [A in Axis]: keyof typeof ORIGIN_ALIGNMENT_VALUES[A]
};
export type OriginAlignment = {
  readonly [A in Axis as Lowercase<A>]?: AxisOriginAlignment[A]
};
export type OriginAlignmentString = NonNullable<OriginAlignment[keyof OriginAlignment]>;

/** Alignment of an object in relation to the origin. */
export type PartialOriginAlignment = OriginAlignment | OriginAlignmentString | "default";
export type RequiredOriginAlignment = Required<OriginAlignment>;

export function originAlignmentFromPartial(alignment: PartialOriginAlignment = "default"):
  OriginAlignment {
  if (alignment === "default")
    return DEFAULT_ORIGIN_ALIGNMENT;
  if (typeof alignment === "string") {
    return {
      x: Object.hasOwn(ORIGIN_ALIGNMENT_VALUES[Axis.X], alignment) ?
        alignment as AxisOriginAlignment[Axis.X] : "center",
      y: Object.hasOwn(ORIGIN_ALIGNMENT_VALUES[Axis.Y], alignment) ?
        alignment as AxisOriginAlignment[Axis.Y] : "center",
    };
  }
  return alignment;
}
export function requiredOriginAlignmentFromPartial(alignment: PartialOriginAlignment = "default"):
  RequiredOriginAlignment {
  return {...DEFAULT_ORIGIN_ALIGNMENT, ...originAlignmentFromPartial(alignment)};
}

const BOX_ALIGNMENT_VALUES = {
  [Axis.X]: {left: -1, center: 0, right: 1},
  [Axis.Y]: {top: -1, center: 0, bottom: 1},
} satisfies Record<Axis, Record<string, AlignmentNumber>>;

export type AxisBoxAlignment = {
  [A in Axis]: keyof typeof BOX_ALIGNMENT_VALUES[A]
};
export type BoxAlignment = {
  readonly [A in Axis as Lowercase<A>]?: AxisBoxAlignment[A]
};
export type BoxAlignmentString = NonNullable<BoxAlignment[keyof BoxAlignment]>;

/** Alignment of an object in relation to a ViewBox. */
export type PartialBoxAlignment = BoxAlignment | BoxAlignmentString | "default";
export type RequiredBoxAlignment = Required<BoxAlignment>;

export function boxAlignmentFromPartial(alignment: PartialBoxAlignment = "default"): BoxAlignment {
  if (alignment === "default")
    return DEFAULT_BOX_ALIGNMENT;
  if (typeof alignment === "string") {
    return {
      x: Object.hasOwn(BOX_ALIGNMENT_VALUES[Axis.X], alignment) ?
        alignment as AxisBoxAlignment[Axis.X] : "center",
      y: Object.hasOwn(BOX_ALIGNMENT_VALUES[Axis.Y], alignment) ?
        alignment as AxisBoxAlignment[Axis.Y] : "center",
    };
  }
  return alignment;
}
export function requiredBoxAlignmentFromPartial(alignment: PartialBoxAlignment = "default"):
  RequiredBoxAlignment {
  return {...DEFAULT_BOX_ALIGNMENT, ...boxAlignmentFromPartial(alignment)};
}

const DEFAULT_ORIGIN_ALIGNMENT: RequiredOriginAlignment = {x: "rightOfOrigin", y: "belowOrigin"};
const DEFAULT_BOX_ALIGNMENT: RequiredBoxAlignment = {x: "left", y: "top"};

type KeysWithValue<Obj extends {}, V> = {
  [k in keyof Obj]: Obj[k] extends V ? k : never
}[keyof Obj];

export type LowerAxisBoxVal = {
  [A in Axis]: KeysWithValue<typeof BOX_ALIGNMENT_VALUES[A], -1>
};
export type UpperAxisBoxVal = {
  [A in Axis]: KeysWithValue<typeof BOX_ALIGNMENT_VALUES[A], 1>
};

export type AlignmentNumber = -1 | 0 | 1;

export function alignmentToNumber(
  alignment: OriginAlignmentString | BoxAlignmentString): AlignmentNumber {
  switch (alignment) {
    case "rightOfOrigin":
    case "belowOrigin":
    case "left":
    case "top":
      return -1;
    case "center":
      return 0;
    case "leftOfOrigin":
    case "aboveOrigin":
    case "right":
    case "bottom":
      return 1;
    default:
      throw new Error(`Unexpected argument: ${alignment}`);
  }
}
