import {AlignmentNumber, AxisBoxAlignment, AxisOriginAlignment, Fitting, LowerAxisBoxVal, OriginAlignmentString, PartialBoxAlignment, UpperAxisBoxVal, alignmentToNumber, boxAlignmentFromPartial, originAlignmentFromString} from './alignment.ts';
import {Axis} from './axis.ts';
import {Tf, Transform} from './transform.ts';
import {DefiniteDimSpec, DimSpec, IncompleteDimSpec, PartialViewBox, ViewBox, inferDimSpec, partialViewBoxToXY} from './view_box.ts';

type StringArgs = OriginAlignmentString | "default";

/** Parameters for normalising an object in the target, with the given fitting and alignment. */
interface BoxArgs {
  readonly target: PartialViewBox;
  readonly fitting?: Fitting;
  readonly align?: PartialBoxAlignment;
}

type DefiniteAxisBoxSpec = {
  readonly [A in Axis]: DefiniteDimSpec & {readonly align?: AxisBoxAlignment[A]}
};
type LowerAxisBoxSpec = {
  readonly [A in Axis]: Pick<Required<IncompleteDimSpec>, "min"> & {readonly align?: LowerAxisBoxVal[A]}
};
type UpperAxisBoxSpec = {
  readonly [A in Axis]: Pick<Required<IncompleteDimSpec>, "max"> & {readonly align?: UpperAxisBoxVal[A]}
};
type AxisBoxSpec = DefiniteAxisBoxSpec | LowerAxisBoxSpec | UpperAxisBoxSpec;

type AxisScaleHoldSpec = {
  readonly [A in Axis]: {
    readonly hold: AxisBoxAlignment[A],
    readonly scale: number,
  }
};
type AxisLenHoldSpec = {
  readonly [A in Axis]: {
    readonly hold: AxisBoxAlignment[A],
    readonly len?: number,
  }
};
type AxisHoldAllSpec = {
  readonly [A in Axis]: "hold"
};
type AxisHoldSpec = AxisScaleHoldSpec | AxisLenHoldSpec | AxisHoldAllSpec;

type AxisIgnoreSpec = {
  readonly [A in Axis]?: undefined
};

type AxisAlignmentSpec =
  AxisOriginAlignment | AxisBoxSpec | AxisHoldSpec | AxisIgnoreSpec;

/**
 * Parameters for normalising an object to constraints defined separately for the axes.
 * Dimensions for which the parameters are not specified will not be transformed, which might
 * lead to proportions change, even if fitting is not specified.
 */
interface XYArgs {
  readonly x?: AxisAlignmentSpec[Axis.X];
  readonly y?: AxisAlignmentSpec[Axis.Y];
  readonly fitting?: Fitting;
}

export type NormaliseArgs = StringArgs | BoxArgs | XYArgs;

function isAxisHoldSpec<A extends Axis>(spec: AxisBoxSpec[A] | AxisHoldSpec[A]):
  spec is AxisHoldSpec[A] {
  return spec === "hold" || Object.hasOwn(spec, "hold");
}
function isAxisScaleHoldSpec<A extends Axis>(spec: (AxisScaleHoldSpec | AxisLenHoldSpec)[A]):
  spec is AxisScaleHoldSpec[A] {
  return Object.hasOwn(spec, "scale");
}

function isBoxArgs(args: BoxArgs | XYArgs): args is BoxArgs {
  return Object.hasOwn(args, "target");
}

/**
 * Returns a transform that normalises the object with the specified bounding box according to
 * the normalisation arguments.
 */
export function getNormaliseTransform(
  boundingBox: ViewBox,
  args: NormaliseArgs,
): Transform {
  let xAlign: AxisAlignmentSpec[Axis.X];
  let yAlign: AxisAlignmentSpec[Axis.Y];
  let fitting: Fitting | undefined;
  if (typeof args === "string") {
    const align = originAlignmentFromString(args);
    xAlign = align.x;
    yAlign = align.y;
    fitting = undefined;
  } else if (isBoxArgs(args)) {
    const {x, y} = partialViewBoxToXY(args.target);
    const align = boxAlignmentFromPartial(args.align);
    xAlign = {...x, align: align.x};
    yAlign = {...y, align: align.y};
    fitting = args.fitting || "fit";
  } else {
    if (Object.hasOwn(args, "align"))
      throw new Error(`Unexpected align parameter for {x, y} parameters type`);
    xAlign = args.x;
    yAlign = args.y;
    fitting = args.fitting || "fit";
  }
  const anchors = [
    getAnchor(Axis.X, {min: boundingBox.minX, len: boundingBox.width}, xAlign),
    getAnchor(Axis.Y, {min: boundingBox.minY, len: boundingBox.height}, yAlign),
  ];
  for (const anchor of anchors) {
    if (!Number.isFinite(anchor.scale)) {
      anchor.scale = 1;
      anchor.nInput = false;
      anchor.nOutput = true;
    }
  }
  if (fitting && fitting !== "stretch" && anchors.some(({nOutput}) => nOutput)) {
    let inputs = anchors.filter(({nInput, nOutput}) => nInput && !nOutput);
    if (!inputs.length)
      inputs = anchors.filter(({nInput}) => nInput);
    if (inputs.length) {
      const negotiatedScale = (
        fitting === "fit" ? Math.min :
          fitting === "fill" ? Math.max :
            fitting satisfies never
      )(...inputs.map(({scale}) => scale));
      for (const anchor of anchors)
        if (anchor.nOutput)
          anchor.scale = negotiatedScale;
    }
  }
  const [
    {origPt: origX, targetPt: targetX, scale: scaleX},
    {origPt: origY, targetPt: targetY, scale: scaleY},
  ] = anchors;
  let tf = Tf;
  if (origX || origY)
    tf = tf.translate(-origX, -origY);
  if (scaleX !== 1 || scaleY !== 1)
    tf = tf.scale(scaleX, scaleY);
  if (targetX || targetY)
    tf = tf.translate(targetX, targetY);
  return tf;
}

interface Anchor {
  origPt: number;
  targetPt: number;
  /**
   * The scale preferred by this anchor. Special cases:
   * - `Infinity` - The orig size is zero and the target size is non-zero.
   *   The final scale can be anything.
   * - `NaN` - Both the orig size and the target size are zero.
   *   The final scale can be anything.
   */
  scale: number;
  /**
   * Whether the specified scale should be taken into account in negotiations
   * between the dimensions. Only matters if a non-zero scale is specified.
   */
  nInput: boolean;
  /**
   * Whether the scale can be changed as a result of negotiations between the dimensions.
   * Only matters if a non-zero scale is specified.
   */
  nOutput: boolean;
}

function getAnchor<A extends Axis>(
  axis: A, bBoxDim: DimSpec, alignment: AxisAlignmentSpec[A]): Anchor {
  // Help for the compiler not understanding the types.
  const align: AxisAlignmentSpec[Axis] = alignment;
  if (!align)
    return {
      origPt: 0,
      targetPt: 0,
      scale: 1,
      nInput: false,
      nOutput: false,
    };
  if (align === "hold")
    return {
      origPt: 0,
      targetPt: 0,
      scale: 1,
      nInput: true,
      nOutput: false,
    };
  if (typeof align === "string")
    return {
      origPt: bBoxDim.min + bBoxDim.len * (alignmentToNumber(align) + 1) / 2,
      targetPt: 0,
      scale: 1,
      nInput: false,
      nOutput: true,
    };
  if (isAxisHoldSpec(align)) {
    const origPt = bBoxDim.min + bBoxDim.len * (alignmentToNumber(align.hold) + 1) / 2;
    const hold = {origPt, targetPt: origPt};
    if (isAxisScaleHoldSpec(align))
      return {
        ...hold,
        scale: align.scale,
        nInput: true,
        nOutput: false,
      };
    if (align.len !== undefined)
      return {
        ...hold,
        scale: align.len / bBoxDim.len,
        nInput: true,
        nOutput: true,
      };
    return {
      ...hold,
      scale: 1,
      nInput: false,
      nOutput: true,
    };
  }
  const {min, max, len} = inferDimSpec(align);
  const boxAlign = align.align || ((align as IncompleteDimSpec).pos === "center" && "center");
  let boxAlignNum: AlignmentNumber;
  if (boxAlign)
    boxAlignNum = alignmentToNumber(boxAlign);
  else if (min !== undefined)
    boxAlignNum = -1;
  else if (max !== undefined)
    boxAlignNum = 1;
  else
    throw new Error();
  const scaleParams = len === undefined ? {
    scale: 1,
    nInput: false,
    nOutput: true,
  } : {
    scale: len / bBoxDim.len,
    nInput: true,
    nOutput: true,
  };
  if (boxAlignNum === -1) {
    if (min === undefined)
      throw new Error(`Error for the ${axis} axis: Expected known min for align ${boxAlign}`);
    return {
      origPt: bBoxDim.min,
      targetPt: min,
      ...scaleParams,
    };
  }
  if (boxAlignNum === 1) {
    if (max === undefined)
      throw new Error(`Error for the ${axis} axis: Expected known max for align ${boxAlign}`);
    return {
      origPt: bBoxDim.min + bBoxDim.len,
      targetPt: max,
      ...scaleParams,
    };
  }
  if (boxAlignNum === 0) {
    if (min === undefined || max === undefined)
      throw new Error(
        `Error for the ${axis} axis: Expected a definite range for align ${boxAlign}`);
    return {
      origPt: bBoxDim.min + bBoxDim.len / 2,
      targetPt: (min + max) / 2,
      ...scaleParams,
    };
  }
  return boxAlignNum satisfies never;
}
