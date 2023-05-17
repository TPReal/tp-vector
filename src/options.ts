import {ALL_BLACK, ColorsDistributor, CyclicColorsDistributor} from './colors_distributor.ts';
import {Attributes} from './elements.ts';
import {CornersMarkerType, PosCorrectionMillimeters, RunHandlesPosition, getGlobalOptions} from './global_options.ts';
import {NO_LAYER, OptionalLayerName} from './layers.ts';
import {toFileName} from './name.ts';

/** The context for which an SVG is generated. */
export type Medium = "preview" | "laser";
export const MEDIA: Medium[] = ["preview", "laser"];

export type PartialMediaStyleAttributes = Partial<Record<Medium, Attributes>>;
/** Global attributes applied to SVG created for the given medium. */
export type MediaStyleAttributes = Readonly<Record<Medium, Attributes>>;
export function styleAttributesFromPartial({
  styleAttributes = {},
  defaults,
}: {
  styleAttributes?: PartialMediaStyleAttributes,
  defaults: MediaStyleAttributes,
}): MediaStyleAttributes {
  const result: PartialMediaStyleAttributes = {};
  for (const medium of MEDIA)
    result[medium] = {...defaults[medium], ...styleAttributes[medium]};
  return result as MediaStyleAttributes;
}

/** The side of the material. */
export type Side = "front" | "back";

export interface PartialCommonRunOptions {
  id?: string;
  layers?: OptionalLayerName[];
  styleAttributes?: PartialMediaStyleAttributes;
  /**
   * Side of the material on which the run should be executed. Note that for `"back"`, the contents
   * of the layer needs to be mirrored in the X axis, as if viewed from the front side (which would
   * actually be possible if the material was transparent).
   */
  side?: Side;
  includeCornersMarker?: boolean;
  posCorrectionMillimeters?: PosCorrectionMillimeters;
}
/** Options of a laser run. Some laser cutter software call this "layer". */
export interface CommonRunOptions {
  readonly type: "cut" | "print";
  readonly id: string;
  /** The layers which belong to this run. A layer can belong to multiple runs. */
  readonly layers: readonly OptionalLayerName[];
  readonly styleAttributes: MediaStyleAttributes;
  /** Side of the material on which this run should be executed. */
  readonly side: Side;
  /**
   * Whether corners marker should be included in this run.
   * Corners marker is a set of objects placed in the corners, that are not sent to the laser,
   * but are included to prevent the laser software from ignoring the margins of a vector file.
   */
  readonly includeCornersMarker: boolean;
  readonly posCorrectionMillimeters?: PosCorrectionMillimeters;
}

export function getDefaultCutStyleAttributes({id, previewColors = ALL_BLACK}: {
  id?: string,
  previewColors?: ColorsDistributor,
} = {}): MediaStyleAttributes {
  return {
    preview: {
      stroke: previewColors.get(id),
      strokeWidth: 1,
      vectorEffect: "non-scaling-stroke",
      fill: "none",
    },
    laser: {
      stroke: "black",
      strokeWidth: getGlobalOptions().cutRunsStrokeWidth ?? 0,
      vectorEffect: "non-scaling-stroke",
      fill: "none",
    },
  };
}
export const DEFAULT_CUT_STYLE_ATTRIBUTES = getDefaultCutStyleAttributes();

export function getDefaultPrintStyleAttributes({id, previewColors = ALL_BLACK}: {
  id?: string,
  previewColors?: ColorsDistributor,
} = {}): MediaStyleAttributes {
  return {
    preview: {
      fill: previewColors.get(id),
      stroke: previewColors.get(id),
      strokeWidth: 0,
    },
    laser: {
      fill: "black",
      stroke: "black",
      strokeWidth: 0,
    },
  };
}
export const DEFAULT_PRINT_STYLE_ATTRIBUTES = getDefaultPrintStyleAttributes();

export interface PartialCutOptions extends PartialCommonRunOptions {
  type: "cut";
}
export interface CutOptions extends CommonRunOptions {
  readonly type: "cut";
}
/**
 * Creates CutOptions. If layers are not specified, layer equal to the id is used. If id is
 * not specified, it is set to `"cut"` and two layers are included: `"cut"` and `NO_LAYER`.
 */
export function cutOptionsFromPartial(
  sheetOptions: SheetOptions,
  {
    id = "cut",
    layers = id === "cut" ? ["cut", NO_LAYER] : [id],
    styleAttributes,
    side = "front",
    includeCornersMarker = false,
    posCorrectionMillimeters,
  }: PartialCutOptions,
): CutOptions {
  return {
    type: "cut",
    id,
    layers,
    styleAttributes: styleAttributesFromPartial({
      styleAttributes,
      defaults: getDefaultCutStyleAttributes({
        id,
        previewColors: sheetOptions.previewColors.cut,
      }),
    }),
    side,
    includeCornersMarker,
    posCorrectionMillimeters,
  };
}

export interface PartialPrintOptions extends PartialCommonRunOptions {
  type: "print";
}
export interface PrintOptions extends CommonRunOptions {
  readonly type: "print";
}
/**
 * Creates PrintOptions. If layers are not specified, layer equal to the id is used, or `"print"`
 * if id is not specified.
 */
export function printOptionsFromPartial(
  sheetOptions: SheetOptions,
  {
    id = "print",
    layers = [id],
    styleAttributes,
    side = "front",
    includeCornersMarker = true,
    posCorrectionMillimeters = sheetOptions.printPosCorrectionMillimeters,
  }: PartialPrintOptions,
): PrintOptions {
  return {
    type: "print",
    id,
    layers,
    styleAttributes: styleAttributesFromPartial({
      styleAttributes,
      defaults: getDefaultPrintStyleAttributes({
        id,
        previewColors: sheetOptions.previewColors.print,
      }),
    }),
    side,
    includeCornersMarker,
    posCorrectionMillimeters,
  };
}

export type PartialRunOptions = PartialCutOptions | PartialPrintOptions;
export type RunOptions = CutOptions | PrintOptions;

export function runOptionsFromPartial(
  sheetOptions: SheetOptions, options: PartialRunOptions): RunOptions {
  if (options.type === "cut")
    return cutOptionsFromPartial(sheetOptions, options);
  if (options.type === "print")
    return printOptionsFromPartial(sheetOptions, options);
  return options satisfies never;
}

const DEFAULT_FRAME_STYLE_ATTRIBUTES = styleAttributesFromPartial({
  styleAttributes: {
    preview: {stroke: "red"},
  },
  defaults: DEFAULT_CUT_STYLE_ATTRIBUTES,
});

export function getDefaultCornersMarkerStyleAttributes(args: {
  id?: string,
  previewColors?: ColorsDistributor,
} = {}): MediaStyleAttributes {
  return styleAttributesFromPartial({
    styleAttributes: {
      preview: {
        strokeWidth: 0,
      },
      laser: {
        strokeWidth: 0,
      },
    },
    defaults: getDefaultCutStyleAttributes(args),
  });
}

export interface PartialCornersMarkerOptions {
  enable?: boolean;
  type?: CornersMarkerType;
  id?: string;
  styleAttributes?: PartialMediaStyleAttributes;
}
export interface CornersMarkerOptions extends Required<Readonly<PartialCornersMarkerOptions>> {}
export function cornersMarkerOptionsFromPartial(
  cornersMarkerOptions: boolean | PartialCornersMarkerOptions = true): CornersMarkerOptions {
  const {
    type = getGlobalOptions().cornersMarkerType,
    enable = !!type,
    id = "corners_marker",
    styleAttributes = {},
  }: PartialCornersMarkerOptions =
    cornersMarkerOptions === true ? {} :
      cornersMarkerOptions === false ? {enable: false} :
        cornersMarkerOptions;
  return {
    enable,
    type: type || "circles",
    id,
    styleAttributes: styleAttributesFromPartial({
      styleAttributes,
      defaults: getDefaultCornersMarkerStyleAttributes({
        id,
        previewColors: ALL_BLACK,
      }),
    }),
  };
}

export interface PartialReversingFrameOptions {
  enable?: boolean;
  id?: string;
  styleAttributes?: PartialMediaStyleAttributes;
}
/**
 * Properties of the reversing frame. The reversing frame is a special cut layer consisting of
 * a single rectangle bounding the whole object. It allows cutting the whole work out of
 * the materia and reversing it in place.
 */
export interface ReversingFrameOptions extends Required<Readonly<PartialReversingFrameOptions>> {}
export function reversingFrameOptionsFromPartial(
  reversingFrameOptions: boolean | PartialReversingFrameOptions = true): ReversingFrameOptions {
  const {
    enable = true,
    id = "reversing_frame",
    styleAttributes = {},
  }: PartialReversingFrameOptions = reversingFrameOptions === true ? {} :
      reversingFrameOptions === false ? {enable: false} :
        reversingFrameOptions;
  return {
    enable,
    id,
    styleAttributes: styleAttributesFromPartial({
      styleAttributes,
      defaults: DEFAULT_FRAME_STYLE_ATTRIBUTES,
    }),
  };
}

export const DEFAULT_PIXELS_PER_INCH = 400;

export interface PartialSheetResolution {
  pixelsPerInch?: number;
  pixelsPerMillimeter?: number;
  pixelsPerUnit?: number;
}
export interface SheetResolution {
  readonly pixelsPerUnit: number;
}
export function sheetResolutionFromPartial(
  partial: PartialSheetResolution = {}, millimetersPerUnit?: number): SheetResolution {
  const {
    pixelsPerInch = DEFAULT_PIXELS_PER_INCH,
    pixelsPerMillimeter = pixelsPerInch / 25.4,
    pixelsPerUnit = pixelsPerMillimeter * (millimetersPerUnit ?? 1),
  } = partial;
  return {
    pixelsPerUnit,
  };
}

export const DEFAULT_CUT_PREVIEW_COLORS = ["#404", "#084", "#840"];

export function defaultCutPreviewColors() {
  return CyclicColorsDistributor.create({
    pool: DEFAULT_CUT_PREVIEW_COLORS,
    initial: [[undefined, 0], ["cut", 0], ["score", 1]],
  });
}

export const DEFAULT_PRINT_PREVIEW_COLORS = ["#a00", "#0a0", "#00a", "#aa0", "#a0a", "#0aa"];

export function defaultPrintPreviewColors() {
  return CyclicColorsDistributor.create({
    pool: DEFAULT_PRINT_PREVIEW_COLORS,
    initial: [[undefined, 0], ["print", 0]],
  });
}

export interface PartialPreviewColors {
  cut?: ColorsDistributor;
  print?: ColorsDistributor;
}
export interface PreviewColors extends Required<Readonly<PartialPreviewColors>> {}
export function previewColorsFromPartial({
  cut = defaultCutPreviewColors(),
  print = defaultPrintPreviewColors(),
}: PartialPreviewColors = {}): PreviewColors {
  return {cut, print};
}

export interface PartialLaserRunsOptions {
  /** ColorsDistributor assigning colors to runs for the laser medium. */
  colorCodes?: ColorsDistributor;
  handles?: RunHandlesPosition;
}
export interface LaserRunsOptions {
  colorCodes?: ColorsDistributor;
  handles?: RunHandlesPosition;
}
export function laserRunsOptionsFromPartial({
  colorCodes = getGlobalOptions().laserRunsOptions?.colorCodes?.(),
  handles = getGlobalOptions().laserRunsOptions?.handles,
}: PartialLaserRunsOptions = {}): LaserRunsOptions {
  return {
    colorCodes,
    handles,
  };
}

const NO_POS_CORRECTION: PosCorrectionMillimeters = [0, 0];

function printPosCorrectionMillimetersFromPartial(
  printPosCorrection: boolean | PosCorrectionMillimeters = true): PosCorrectionMillimeters {
  return printPosCorrection === true ?
    getGlobalOptions().printPosCorrectionMillimeters ?? NO_POS_CORRECTION :
    printPosCorrection === false ? NO_POS_CORRECTION :
      printPosCorrection;
}

export const DEFAULT_SHEET_FILE_NAME = "sheet";

export interface PartialSheetOptions {
  name?: string;
  fileName?: string;
  includeSizeInName?: boolean;
  millimetersPerUnit?: number;
  cornersMarker?: boolean | PartialCornersMarkerOptions;
  reversingFrame?: boolean | PartialReversingFrameOptions;
  resolution?: PartialSheetResolution;
  previewColors?: PartialPreviewColors;
  laserRunsOptions?: PartialLaserRunsOptions;
  printPosCorrectionMillimeters?: boolean | PosCorrectionMillimeters;
}
export interface SheetOptions {
  readonly name?: string;
  readonly fileName: string;
  readonly includeSizeInName: boolean;
  readonly millimetersPerUnit?: number;
  readonly cornersMarker: CornersMarkerOptions;
  readonly reversingFrame: ReversingFrameOptions;
  readonly resolution: SheetResolution;
  readonly previewColors: PreviewColors;
  readonly laserRunsOptions: LaserRunsOptions;
  readonly printPosCorrectionMillimeters: PosCorrectionMillimeters;
}
export function sheetOptionsFromPartial({
  name,
  fileName = name ? toFileName(name) : DEFAULT_SHEET_FILE_NAME,
  millimetersPerUnit,
  includeSizeInName = millimetersPerUnit !== undefined,
  cornersMarker,
  reversingFrame,
  resolution,
  previewColors,
  laserRunsOptions,
  printPosCorrectionMillimeters,
}: PartialSheetOptions): SheetOptions {
  return {
    name,
    fileName,
    includeSizeInName,
    millimetersPerUnit,
    cornersMarker: cornersMarkerOptionsFromPartial(cornersMarker),
    reversingFrame: reversingFrameOptionsFromPartial(reversingFrame),
    resolution: sheetResolutionFromPartial(resolution, millimetersPerUnit),
    previewColors: previewColorsFromPartial(previewColors),
    laserRunsOptions: laserRunsOptionsFromPartial(laserRunsOptions),
    printPosCorrectionMillimeters:
      printPosCorrectionMillimetersFromPartial(printPosCorrectionMillimeters),
  };
}
