import {ColorsDistributor, CyclicColorsDistributor, InitialColorsAssignment} from './colors_distributor.ts';
import {flatten, OrArrayRest} from './util.ts';

/** Method of handling transparency when converting SVG to PNG. */
export type PNGAllowTransparency =
  // Allow, leave alone. The default.
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

/**
 * The logic of calculating the width and height of an `<image>` elements created from a URL,
 * if the size is not set explicitly.
 */
export interface ImageAutoSizeLogic {
  /**
   * If set, the image will first be measured without the size set, and then its width and
   * height attributes will be set to the measured values.
   * If not set, the concrete numeric values are never set in the attributes.
   */
  readonly measure?: boolean;
  /**
   * The value to use as width and height attribute that denotes the intrinsic size of the image.
   * According to the sections about [image attributes](
   * https://developer.mozilla.org/en-US/docs/Web/SVG/Element/image#specific_attributes)
   * and [the width attribute](
   * https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/width#image),
   * the width attribute is required and the value `"auto"` measures the intrinsic size of the
   * image. However in Chrome the `"auto"` value is rejected, and missing value is used
   * for intrinsic image size instead.
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
  | "lineTransformBrokenLightBurn"
  // LightBurn 1.3 only supports equal rounded corners on X and Y axis.
  | "roundedCornersRectangleLimitedLightBurn"
  // VisiCut ignores the href attribute and only honors xlink:href.
  | "xlinkHref";

export type Quirks = Partial<Record<Quirk, boolean>>;

/**
 * The global options, setting the desired behaviour, which can be affected by the laser cutter
 * hardware, software, browser, or user preferences.
 */
export interface PartialGlobalOptions {
  pngAllowTransparency?: PNGAllowTransparency;
  cornersMarkerType?: CornersMarkerType;
  imageAutoSizeLogic?: ImageAutoSizeLogic;
  laserRunsOptions?: LaserRunsOptions;
  /**
   * The translation of print layers relative to the cut layers, caused by hardware inaccuracy,
   * measured for a particular laser cutter, in millimeters.
   * See the calibrator in _calibration/print_pos_correction.ts_.
   */
  printPosCorrectionMillimeters?: PosCorrectionMillimeters;
  quirks?: Quirks;
}

export interface GlobalOptions {
  readonly pngAllowTransparency: PNGAllowTransparency;
  readonly cornersMarkerType?: CornersMarkerType;
  readonly imageAutoSizeLogic: ImageAutoSizeLogic;
  readonly laserRunsOptions?: LaserRunsOptions;
  readonly printPosCorrectionMillimeters?: PosCorrectionMillimeters;
  readonly quirks?: Readonly<Quirks>;
}

export namespace presets {

  export const DEFAULT = {
    pngAllowTransparency: true,
    imageAutoSizeLogic: {
      measure: true,
      widthAndHeight: "_not_set_",
    },
  } satisfies GlobalOptions;

  /**
   * Returns a preset for the theoretically correct way of sizing images, with width and height
   * set to `"auto"`. Note that it might not work in practice.
   * @see {@link ImageAutoSizeLogic}
   */
  export function imageAutoSizeLogic() {
    return {
      imageAutoSizeLogic: {
        measure: false,
        widthAndHeight: "auto",
      },
    } satisfies PartialGlobalOptions;
  }

  /**
   * Returns preset for the VisiCut software.
   * @see https://visicut.org/
   */
  export function visicut() {
    return {
      cornersMarkerType: "circles",
      quirks: {xlinkHref: true},
    } satisfies PartialGlobalOptions;
  }

  /**
   * Returns preset for the LightBurn software.
   * @see https://lightburnsoftware.com/
   */
  export function lightburn({
    layersHandles = "above",
    colorCodedLayersPreset,
    colorCodedLayers = !!colorCodedLayersPreset,
  }: {
    layersHandles?: RunHandlesPosition,
    colorCodedLayers?: boolean,
    colorCodedLayersPreset?: true | InitialColorsAssignment,
  } = {}) {
    return {
      // Non-transparent white covers other layers.
      pngAllowTransparency: "iffWhite",
      // Circles with zero radius are optimised away by LightBurn.
      cornersMarkerType: "lines",
      laserRunsOptions: {
        ...colorCodedLayers ? {
          colorCodes: () => CyclicColorsDistributor.create({
            pool: LIGHTBURN_LAYERS_COLORS,
            initial: colorCodedLayersPreset === true ?
              DEFAULT_LIGHTBURN_COLOR_CODED_LAYERS :
              colorCodedLayersPreset,
          }),
        } : undefined,
        // There is no way of selecting a layer by id, so include the handles.
        handles: layersHandles,
      },
      quirks: {
        lineTransformBrokenLightBurn: true,
        roundedCornersRectangleLimitedLightBurn: true,
      },
    } satisfies PartialGlobalOptions;
  }

  export const DEFAULT_LIGHTBURN_COLOR_CODED_LAYERS = [
    ["print_back", 5],
    ["reversing_frame", 10],
    ["print", 15],
    ["cut", 20],
    ["corners_marker", 29],
  ] satisfies InitialColorsAssignment;

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

}

/** The global options. Warning: this is global mutable state. */
let currentGlobalOptions: GlobalOptions = presets.DEFAULT;

export function get() {
  return currentGlobalOptions;
}

export function getGlobalOptions() {
  return get();
}

export function set(options: GlobalOptions, ...modifiers: OrArrayRest<PartialGlobalOptions>) {
  currentGlobalOptions = options;
  modify(...modifiers);
}

export function reset(...modifiers: OrArrayRest<PartialGlobalOptions>) {
  set(presets.DEFAULT, ...modifiers);
}

export function modify(...modifiers: OrArrayRest<PartialGlobalOptions>) {
  for (const modifier of flatten(modifiers)) {
    currentGlobalOptions = applyModifier(currentGlobalOptions, modifier);
  }
}

function applyModifier(opts: GlobalOptions, mod: PartialGlobalOptions): GlobalOptions {
  return {
    ...opts,
    ...mod,
    laserRunsOptions: {
      ...opts.laserRunsOptions,
      ...mod.laserRunsOptions,
    },
    quirks: {
      ...opts.quirks,
      ...mod.quirks,
    },
  };
}
