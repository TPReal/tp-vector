import {AxisOriginAlignment, Fitting, PartialOriginAlignment, RequiredOriginAlignment, alignmentToNumber, requiredOriginAlignmentFromPartial} from './alignment.ts';
import {Axis} from './axis.ts';
import * as dataURIConv from './data_uri_conv.ts';
import {cloneElement, createElement, getElementsBoundingBox, getLoadedPromise, setAttributes} from './elements.ts';
import {globalOptions} from './global_options.ts';
import {DefaultPiece} from './pieces.ts';

export type ImageType = "png" | "jpeg" | "gif";

export const DEFAULT_IMAGE_TYPE: ImageType = "png";

interface PartialImageScalingInterface {
  width?: number;
  height?: number;
  align?: PartialOriginAlignment;
  fitting?: Fitting;
}
export type PartialImageScaling = PartialImageScalingInterface | "auto";

interface ImageScalingInterface {
  readonly width: number;
  readonly height: number;
  readonly align: RequiredOriginAlignment;
  readonly fitting: Fitting;
}
type ImageScaling = ImageScalingInterface | "auto";
function imageScalingFromPartial(partialScaling: PartialImageScaling = "auto"): ImageScaling {
  if (partialScaling === "auto")
    return "auto";
  const {
    width = 1,
    height = 1,
    align,
    fitting = "fit",
  } = partialScaling;
  return {width, height, align: requiredOriginAlignmentFromPartial(align), fitting};
}

function mimeType(type: ImageType) {
  return `image/${type}`;
}

export class RasterImage extends DefaultPiece {

  protected constructor(
    private readonly image: SVGImageElement,
    readonly scaling: ImageScaling,
  ) {
    super(image);
  }

  static async fromBinary({type = DEFAULT_IMAGE_TYPE, binData, scaling}: {
    type?: ImageType,
    binData: string,
    scaling?: PartialImageScaling,
  }) {
    return await RasterImage.fromURL({
      url: dataURIConv.fromBinary({mimeType: mimeType(type), binData}),
      scaling,
    });
  }

  static async fromBase64({type = DEFAULT_IMAGE_TYPE, base64Data, scaling}: {
    type?: ImageType,
    base64Data: string,
    scaling?: PartialImageScaling,
  }) {
    return await RasterImage.fromURL({
      url: dataURIConv.fromBase64({mimeType: mimeType(type), base64Data}),
      scaling,
    });
  }

  // TODO: Use assets instead.
  static async fromEncoded({type, base64Data}: {
    type: ImageType,
    base64Data: string,
  }, scaling?: PartialImageScaling) {
    return await RasterImage.fromBase64({type, base64Data, scaling});
  }

  static async fromURL({url, scaling}: {
    url: string,
    scaling?: PartialImageScaling,
  }) {
    const image = createElement({tagName: "image"});
    const loaded = getLoadedPromise(image);
    setAttributes(image, {href: url});
    await loaded;
    return RasterImage.fromImage({
      image,
      canModifyImage: true,
      scaling,
    });
  }

  static fromImage({image, canModifyImage = false, scaling}: {
    image: SVGImageElement,
    canModifyImage?: boolean,
    scaling?: PartialImageScaling,
  }) {
    const imageClone = canModifyImage ? image : cloneElement(image);
    const fullScaling = imageScalingFromPartial(scaling);
    applyImageScalingAttributes(imageClone, fullScaling);
    return new RasterImage(imageClone, fullScaling);
  }

  setScaling(scaling: PartialImageScaling) {
    return RasterImage.fromImage({image: this.image, scaling});
  }

}

function applyImageScalingAttributes(image: SVGImageElement, scaling: ImageScaling) {
  if (scaling === "auto") {
    const {imageAutoSizeLogic} = globalOptions();
    if (imageAutoSizeLogic.widthAndHeight === "auto")
      setAttributes(image, {width: "auto", height: "auto"});
    if (imageAutoSizeLogic.measure) {
      const box = getElementsBoundingBox([image]);
      setAttributes(image, {width: box.width, height: box.height});
    }
  } else {
    const {
      width,
      height,
      align: {x, y},
      fitting,
    } = scaling;
    setAttributes(image, {
      width,
      height,
      x: -width * alignmentToNumber(x),
      y: -height * alignmentToNumber(y),
      preserveAspectRatio: fitting === "stretch" ? "none" :
        `x${getMinMidMax(x)}Y${getMinMidMax(y)} ${fitting === "fit" ? "meet" : "slice"}`,
    });
  }
}

function getMinMidMax(alignment: AxisOriginAlignment<Axis>) {
  const num = alignmentToNumber(alignment);
  if (num === 0)
    return "Min";
  if (num === 0.5)
    return "Mid";
  if (num === 1)
    return "Max";
  return num satisfies never;
}
