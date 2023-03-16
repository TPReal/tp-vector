import {AlignmentNumber, AxisBoxAlignment, AxisBoxAlignmentValues, AxisOriginAlignment, Fitting, PartialBoxAlignment, alignmentToNumber, boxAlignmentFromPartial, originAlignmentFromPartial} from './alignment.ts';
import {Axis} from './axis.ts';
import {Tf, Transform} from './transform.ts';
import {DefiniteDimSpec, DimSpec, IncompleteDimSpec, PartialViewBox, ViewBox, inferDimSpec, partialViewBoxToXY} from './view_box.ts';

type StringArgs = "default" | "center";

/** Parameters for normalising an object in the target, with the given fitting and alignment. */
interface BoxArgs {
  target: PartialViewBox;
  fitting?: Fitting;
  align?: PartialBoxAlignment;
}

type DefiniteAxisBoxSpec<A extends Axis> = DefiniteDimSpec & {
  align?: AxisBoxAlignment<A>,
};
type LowerAxisBoxSpec<A extends Axis> = Pick<Required<IncompleteDimSpec>, "min"> & {
  align?: AxisBoxAlignmentValues<A>["lower"],
};
type UpperAxisBoxSpec<A extends Axis> = Pick<Required<IncompleteDimSpec>, "max"> & {
  align?: AxisBoxAlignmentValues<A>["upper"],
};
type AxisBoxSpec<A extends Axis> =
  DefiniteAxisBoxSpec<A> | LowerAxisBoxSpec<A> | UpperAxisBoxSpec<A>;

interface AxisScaleHoldSpec<A extends Axis> {
  hold: AxisBoxAlignment<A>;
  scale: number;
}
interface AxisLenHoldSpec<A extends Axis> {
  hold: AxisBoxAlignment<A>;
  len?: number;
}
type AxisHoldSpec<A extends Axis> = AxisScaleHoldSpec<A> | AxisLenHoldSpec<A>;

type AxisAlignmentSpec<A extends Axis> =
  AxisOriginAlignment<A> | AxisBoxSpec<A> | AxisHoldSpec<A> | "unchanged";

/** Parameters for normalising an object to constraints defined separately for the axes. */
interface XYArgs {
  x?: AxisAlignmentSpec<Axis.X>;
  y?: AxisAlignmentSpec<Axis.Y>;
  fitting?: Fitting;
}

export type NormaliseArgs = StringArgs | BoxArgs | XYArgs;

function isAxisHoldSpec(spec: AxisBoxSpec<Axis> | AxisHoldSpec<Axis>):
  spec is AxisHoldSpec<Axis> {
  return Object.hasOwn(spec, "hold");
}
function isAxisScaleHoldSpec(spec: AxisHoldSpec<Axis>): spec is AxisScaleHoldSpec<Axis> {
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
  let xAlign: AxisAlignmentSpec<Axis.X>;
  let yAlign: AxisAlignmentSpec<Axis.Y>;
  let fitting: Fitting;
  if (typeof args === "string") {
    const align = originAlignmentFromPartial(args);
    xAlign = align.x || "unchanged";
    yAlign = align.y || "unchanged";
    fitting = "fit";
  } else if (isBoxArgs(args)) {
    const {x, y} = partialViewBoxToXY(args.target);
    const align = boxAlignmentFromPartial(args.align);
    xAlign = x && {...x, align: align.x};
    yAlign = y && {...y, align: align.y};
    fitting = args.fitting || "fit";
  } else {
    if ((args as BoxArgs).align)
      throw new Error(`Unexpected align parameter for {x, y} parameters type`);
    xAlign = args.x || "unchanged";
    yAlign = args.y || "unchanged";
    fitting = args.fitting || "fit";
  }
  const anchors = [
    getAnchor(Axis.X, {min: boundingBox.minX, len: boundingBox.width}, xAlign),
    getAnchor(Axis.Y, {min: boundingBox.minY, len: boundingBox.height}, yAlign),
  ];
  if (fitting !== "stretch") {
    const scales = anchors.map(({scale}) => scale)
      .filter((s): s is number => s !== undefined);
    if (scales.length) {
      const negotiatedScale = fitting === "fit" ? Math.min(...scales) : Math.max(...scales);
      for (const anchor of anchors)
        if (anchor.negotiateScale)
          anchor.scale = negotiatedScale;
    }
  }
  const [
    {from: fromX, to: toX, scale: scaleX = 1},
    {from: fromY, to: toY, scale: scaleY = 1},
  ] = anchors;
  let tf = Tf;
  if (fromX || fromY)
    tf = tf.translate(-fromX, -fromY);
  if (scaleX !== 1 || scaleY !== 1)
    tf = tf.scale(scaleX, scaleY);
  if (toX || toY)
    tf = tf.translate(toX, toY);
  return tf;
}

interface Anchor {
  from: number;
  to: number;
  scale?: number;
  negotiateScale: boolean;
}

function getAnchor<A extends Axis>(
  axis: A, bBoxDim: DimSpec, align: AxisAlignmentSpec<A>): Anchor {
  if (align === "unchanged")
    return {from: 0, to: 0, scale: 1, negotiateScale: false};
  if (typeof align === "string")
    return {
      from: bBoxDim.min + alignmentToNumber(align) * bBoxDim.len,
      to: 0,
      negotiateScale: true,
    };
  if (isAxisHoldSpec(align)) {
    const holdPos = bBoxDim.min + alignmentToNumber(align.hold) * bBoxDim.len;
    const scale = isAxisScaleHoldSpec(align) ? align.scale :
      align.len !== undefined ? align.len / bBoxDim.len : undefined;
    return {
      from: holdPos,
      to: holdPos,
      ...scale !== undefined && {scale},
      negotiateScale: true,
    };
  }
  const {min, max, len} = inferDimSpec(align);
  const boxAlign = align.align || ((align as IncompleteDimSpec).pos === "center" && "center");
  let boxAlignNum: AlignmentNumber;
  if (boxAlign)
    boxAlignNum = alignmentToNumber(boxAlign);
  else if (min !== undefined)
    boxAlignNum = 0;
  else if (max !== undefined)
    boxAlignNum = 1;
  else
    throw new Error();
  const scaleParams = {
    ...len !== undefined && {scale: len / bBoxDim.len},
    negotiateScale: true,
  };
  if (boxAlignNum === 0) {
    if (min === undefined)
      throw new Error(`Error for the ${axis} axis: Expected known min for align ${boxAlign}`);
    return {from: bBoxDim.min, to: min, ...scaleParams};
  }
  if (boxAlignNum === 1) {
    if (max === undefined)
      throw new Error(`Error for the ${axis} axis: Expected known max for align ${boxAlign}`);
    return {from: bBoxDim.min + bBoxDim.len, to: max, ...scaleParams};
  }
  if (boxAlignNum === 0.5) {
    if (min === undefined || max === undefined)
      throw new Error(
        `Error for the ${axis} axis: Expected a definite range for align ${boxAlign}`);
    return {from: bBoxDim.min + bBoxDim.len / 2, to: (min + max) / 2, ...scaleParams};
  }
  return boxAlignNum satisfies never;
}
