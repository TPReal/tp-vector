import {ColorsDistributor, CyclicColorsDistributor} from './colors_distributor.ts';

export type PNGAllowTransparency =
  true | false | "ifWhite" | "iffWhite";

export type CornersMarkerType = "circles" | "lines";

export interface ImageAutoSizeLogic {
  readonly measure: boolean;
  readonly widthAndHeight: `"auto"` | "empty";
}

export type RunHandlesPosition = "above" | "below";

export interface LaserRunsOptions {
  readonly colorCodes?: () => ColorsDistributor;
  readonly handles?: RunHandlesPosition;
}

export type PosCorrectionMillimeters = readonly [number, number];

export type SpecialCases =
  "lineTransformBug";

export interface GlobalOptions {
  readonly pngAllowTransparency: PNGAllowTransparency;
  readonly cornersMarkerType: CornersMarkerType;
  readonly includeXlinkHref?: boolean;
  readonly imageAutoSizeLogic: ImageAutoSizeLogic;
  readonly laserRunsOptions?: LaserRunsOptions;
  readonly printPosCorrectionMillimeters?: PosCorrectionMillimeters;
  readonly quirks?: Set<SpecialCases>;
}

export const VISICUT_EPILOG: GlobalOptions = {
  pngAllowTransparency: true,
  cornersMarkerType: "circles",
  includeXlinkHref: true,
  imageAutoSizeLogic: {
    measure: false,
    widthAndHeight: `"auto"`,
  },
  printPosCorrectionMillimeters: [0.1, 0],
};

export const LIGHTBURN_OLM3: GlobalOptions = {
  pngAllowTransparency: "iffWhite",
  cornersMarkerType: "lines",
  imageAutoSizeLogic: {
    measure: true,
    widthAndHeight: "empty",
  },
  laserRunsOptions: {
    // colorCodes: () => getLightburnLayerColorCodes(),
    handles: "above",
  },
  printPosCorrectionMillimeters: [0.1, 0.2],
  quirks: new Set(["lineTransformBug"]),
};

export const LIGHTBURN_COLOR_CODES = [
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

export function getLightburnLayerColorCodes() {
  return CyclicColorsDistributor.create({
    pool: LIGHTBURN_COLOR_CODES,
    initial: [
      [undefined, 0],
      ["cut", 0],
      ["print", 1],
      ["reversing_frame", 10],
      ["corners_marker", 19],
    ],
  });
}

export function globalOptions() {
  return LIGHTBURN_OLM3;
}
