import {ALL_BLACK, ColorsDistributor, CyclicColorsDistributor} from './colors_distributor.ts';
import {Attributes} from './elements.ts';
import {CornersMarkerType, PosCorrectionMillimeters, RunHandlesPosition, globalOptions} from './global_options.ts';
import {OptionalLayerName} from './layers.ts';
import {Point} from './point.ts';

export type Medium = "preview" | "laser";
export const MEDIA: Medium[] = ["preview", "laser"];

export type PartialMediaStyleAttributes = Partial<Record<Medium, Attributes>>;
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

export type Side = "front" | "back";

export interface PartialCommonRunOptions {
  id?: string;
  layers?: OptionalLayerName[];
  styleAttributes?: PartialMediaStyleAttributes;
  side?: Side;
  includeCornersMarker?: boolean;
  posCorrectionMillimeters?: PosCorrectionMillimeters;
}
export interface CommonRunOptions {
  readonly id: string;
  readonly layers: readonly OptionalLayerName[];
  readonly styleAttributes: MediaStyleAttributes;
  readonly side: Side;
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
      strokeWidth: 0,
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
export function cutOptionsFromPartial(
  {
    type,
    id,
    layers = id === undefined ? [type, undefined] : [id],
    styleAttributes,
    side = "front",
    includeCornersMarker = false,
    posCorrectionMillimeters,
  }: PartialCutOptions,
  sheetOptions: SheetOptions,
): CutOptions {
  return {
    type,
    id: id ?? type,
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
export function printOptionsFromPartial(
  {
    type,
    id = type,
    layers = [id],
    styleAttributes,
    side = "front",
    includeCornersMarker = true,
    posCorrectionMillimeters = globalOptions().printPosCorrectionMillimeters,
  }: PartialPrintOptions,
  sheetOptions: SheetOptions,
): PrintOptions {
  return {
    type,
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
  options: PartialRunOptions, sheetOptions: SheetOptions): RunOptions {
  if (options.type === "cut")
    return cutOptionsFromPartial(options, sheetOptions);
  if (options.type === "print")
    return printOptionsFromPartial(options, sheetOptions);
  return options satisfies never;
}

const DEFUALT_FRAME_STYLE_ATTRIBUTES = styleAttributesFromPartial({
  styleAttributes: {
    preview: {stroke: "red"},
  },
  defaults: DEFAULT_CUT_STYLE_ATTRIBUTES,
});

export interface PartialCornersMarkerOptions {
  enable?: boolean;
  type?: CornersMarkerType;
  id?: string;
  styleAttributes?: PartialMediaStyleAttributes;
}
export interface CornersMarkerOptions extends Required<Readonly<PartialCornersMarkerOptions>> {
}
export function cornersMarkerOptionsFromPartial({
  enable = true,
  type = globalOptions().cornersMarkerType,
  id = "corners_marker",
  styleAttributes = {},
}: PartialCornersMarkerOptions = {}): CornersMarkerOptions {
  return {
    enable,
    type,
    id,
    styleAttributes: styleAttributesFromPartial({
      styleAttributes,
      defaults: getDefaultCutStyleAttributes({
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
export interface ReversingFrameOptions extends Required<Readonly<PartialReversingFrameOptions>> {
}
export function reversingFrameOptionsFromPartial({
  enable = true,
  id = "reversing_frame",
  styleAttributes = {},
}: PartialReversingFrameOptions = {}): ReversingFrameOptions {
  return {
    enable,
    id,
    styleAttributes: styleAttributesFromPartial({
      styleAttributes,
      defaults: DEFUALT_FRAME_STYLE_ATTRIBUTES,
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
    pixelsPerUnit = pixelsPerMillimeter * (millimetersPerUnit || 1),
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
export interface PreviewColors extends Required<Readonly<PartialPreviewColors>> {
}
export function previewColorsFromPartial({
  cut = defaultCutPreviewColors(),
  print = defaultPrintPreviewColors(),
}: PartialPreviewColors = {}): PreviewColors {
  return {cut, print};
}

export interface PartialLaserRunsOptions {
  colorCodes?: ColorsDistributor;
  handles?: RunHandlesPosition;
}
export interface LaserRunsOptions {
  colorCodes?: ColorsDistributor;
  handles?: RunHandlesPosition;
}
export function laserRunsOptionsFromPartial({
  colorCodes = globalOptions().laserRunsOptions?.colorCodes?.(),
  handles = globalOptions().laserRunsOptions?.handles,
}: PartialLaserRunsOptions = {}): LaserRunsOptions {
  return {
    colorCodes,
    handles,
  };
}

export interface PartialSheetOptions {
  name?: string;
  includeSizeInName?: boolean;
  millimetersPerUnit?: number;
  cornersMarker?: PartialCornersMarkerOptions;
  reversingFrame?: PartialReversingFrameOptions;
  resolution?: PartialSheetResolution;
  previewColors?: PartialPreviewColors;
  laserRunsOptions?: PartialLaserRunsOptions;
  printPosCorrection?: Point;
}
export interface SheetOptions {
  readonly name?: string;
  readonly includeSizeInName: boolean;
  readonly millimetersPerUnit?: number;
  readonly cornersMarker: CornersMarkerOptions;
  readonly reversingFrame: ReversingFrameOptions;
  readonly resolution: SheetResolution;
  readonly previewColors: PreviewColors;
  readonly laserRunsOptions: LaserRunsOptions;
  readonly printPosCorrection: Point;
}
export function sheetOptionsFromPartial({
  name,
  millimetersPerUnit,
  includeSizeInName = millimetersPerUnit !== undefined,
  cornersMarker,
  reversingFrame,
  resolution,
  previewColors,
  laserRunsOptions,
  printPosCorrection = [0, 0],
}: PartialSheetOptions): SheetOptions {
  return {
    name,
    includeSizeInName,
    millimetersPerUnit,
    cornersMarker: cornersMarkerOptionsFromPartial(cornersMarker),
    reversingFrame: reversingFrameOptionsFromPartial(reversingFrame),
    resolution: sheetResolutionFromPartial(resolution, millimetersPerUnit),
    previewColors: previewColorsFromPartial(previewColors),
    laserRunsOptions: laserRunsOptionsFromPartial(laserRunsOptions),
    printPosCorrection,
  };
}
