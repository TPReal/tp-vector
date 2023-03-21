import {ColorsDistributor, CyclicColorsDistributor} from './colors_distributor.ts';

/** Method of handling transparency when converting SVG to PNG. */
export type PNGAllowTransparency =
  // Allow, leave alone.
  | true
  // Make all pixels non-transparent (white background).
  | false
  // Allow white pixels to be transparent, make other pixels non-transparent (white background)
  | "ifWhite"
  // Like `"ifWhite"`, but also make white pixels transparent.
  | "iffWhite";

/**
 * The type of corners marker to use.
 * Corners marker is a set of objects placed in the corners, that are not sent to the laser,
 * but are included to prevent the laser software from ignoring the margins of a vector file.
 */
export type CornersMarkerType =
  // Circles of radius 0.
  | "circles"
  // Lines along the edges, of epsilon length.
  | "lines";

/** The logic of calculating the width and height of `<image>` elements created from a URL. */
export interface ImageAutoSizeLogic {
  /**
   * If set, the image will first be measured without the size set, and then its width and
   * height attributes will be set to the measured values.
   * If cleared, the concrete numeric values are never set in the attributes.
   */
  readonly measure: boolean;
  /**
   * The value to use as width and height attribute that denotes the intrinsic size of the image.
   * According to the sections about [image attributes](
   * https://developer.mozilla.org/en-US/docs/Web/SVG/Element/image#specific_attributes)
   * and [the width attribute](
   * https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/width#image),
   * the width attribute is required and the value `"auto"` measures the intrinsic size of the
   * image. However in Chrome I see that the `"auto"` value is rejected, and missing value
   * is used for intrinsic image size instead.
   */
  readonly widthAndHeight: "auto" | "_not_set_";
}

export type RunHandlesPosition = "above" | "below";

export interface LaserRunsOptions {
  readonly colorCodes?: () => ColorsDistributor;
  readonly handles?: RunHandlesPosition;
}

/** Relative translation of a layer, caused by hardware inaccuracy. */
export type PosCorrectionMillimeters = readonly [number, number];

/** Any quirky behaviour related to a software or hardware being used. */
export type Quirk =
  // LightBurn 1.3 ignores transform attributes directly on a `<line>` element.
  | "lineTransform"
  // VisiCut ignores the href attribute and only honors xlink:href.
  | "requireXlinkHref";

/**
 * The global options, setting the desired behaviour, which can be affected by the laser cutter
 * hardware, software, browser, or user preferences.
 */
export interface GlobalOptions {
  readonly pngAllowTransparency: PNGAllowTransparency;
  readonly cornersMarkerType?: CornersMarkerType;
  readonly imageAutoSizeLogic: ImageAutoSizeLogic;
  readonly laserRunsOptions?: LaserRunsOptions;
  /**
   * The translation of print layers relative to the cut layers, caused by hardware inaccuracy,
   * measured for a particular laser cutter, in millimeters.
   * See the calibrator in _calibration/print_pos_correction.ts_.
   */
  readonly printPosCorrectionMillimeters?: PosCorrectionMillimeters;
  readonly quirks?: Set<Quirk>;
}

export const VISICUT_EPILOG: GlobalOptions = {
  pngAllowTransparency: true,
  cornersMarkerType: "circles",
  imageAutoSizeLogic: {
    measure: false,
    widthAndHeight: "auto",
  },
  printPosCorrectionMillimeters: [0.1, 0],
  quirks: new Set(["requireXlinkHref"]),
};

export const LIGHTBURN_OLM3: GlobalOptions = {
  pngAllowTransparency: "iffWhite",
  cornersMarkerType: "lines",
  imageAutoSizeLogic: {
    measure: true,
    widthAndHeight: "_not_set_",
  },
  laserRunsOptions: {
    // colorCodes: () => getLightburnLayerColorCodes(),
    handles: "above",
  },
  printPosCorrectionMillimeters: [0.1, 0.2],
  quirks: new Set(["lineTransform"]),
};

export const LIGHTBURN_LAYERS_COLORS = [
  "#000000",
  "#0000ff",
  "#ff0000",
  "#00e000",
  "#d0d000",
  "#ff8000",
  "#00e0e0",
  "#ff00ff",
  "#b4b4b4",
  "#0000a0",
  "#a00000",
  "#00a000",
  "#a0a000",
  "#c08000",
  "#00a0ff",
  "#a000a0",
  "#808080",
  "#7d87b9",
  "#bb7784",
  "#4a6fe3",
  "#d33f6a",
  "#8cd78c",
  "#f0b98d",
  "#f6c4e1",
  "#fa9ed4",
  "#500a78",
  "#b45a00",
  "#004754",
  "#86fa88",
  "#ffdb66",
];
export const LIGHTBURN_LAYER_COLOR_CODES =
  CyclicColorsDistributor.create({pool: LIGHTBURN_LAYERS_COLORS});
export const DEFAULT_LIGHTBURN_LAYER_COLOR_CODES = CyclicColorsDistributor.create({
  pool: LIGHTBURN_LAYERS_COLORS,
  initial: [
    [undefined, 0],
    ["cut", 0],
    ["print", 1],
    ["reversing_frame", 10],
    ["corners_marker", 29],
  ],
});

export function globalOptions() {
  return LIGHTBURN_OLM3;
}

// TODO: Allow setting global options, make modular.
