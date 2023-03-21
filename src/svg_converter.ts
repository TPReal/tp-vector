import {PNGAllowTransparency, globalOptions} from './global_options.ts';
import {assert} from './util.ts';

export function getSVGObjectURL(svg: SVGSVGElement) {
  const url = URL.createObjectURL(new Blob(
    [new XMLSerializer().serializeToString(svg)],
    {type: "image/svg+xml;charset=utf-8"}));
  return {
    url,
    cleanUpFunc: () => {
      requestAnimationFrame(() => {
        URL.revokeObjectURL(url);
      });
    },
  };
}

export interface PartialPNGConversionParams {
  pixelsPerUnit: number;
  allowTransparency?: PNGAllowTransparency;
}
interface PNGConversionParams {
  readonly pixelsPerUnit: number;
  readonly allowTransparency: PNGAllowTransparency;
}
function pngConversionParamsFromPartial({
  pixelsPerUnit,
  allowTransparency = globalOptions().pngAllowTransparency,
}: PartialPNGConversionParams): PNGConversionParams {
  return {
    pixelsPerUnit,
    allowTransparency,
  };
}

/** Converts the SVG to PNG, returned as data URI, using the specified conversion params. */
export async function getPNGDataURI(
  svg: SVGSVGElement, conversionParams: PartialPNGConversionParams): Promise<string> {
  const {
    pixelsPerUnit,
    allowTransparency,
  } = pngConversionParamsFromPartial(conversionParams);
  const {url: svgURL, cleanUpFunc} = getSVGObjectURL(svg);
  const viewBox = svg.viewBox.baseVal;
  const w = viewBox.width * pixelsPerUnit;
  const h = viewBox.height * pixelsPerUnit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = assert(canvas.getContext("2d"));
  if (allowTransparency === false) {
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, w, h);
  }
  const img = new Image();
  const dataURI = new Promise<string>(resolve => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (allowTransparency === "ifWhite" || allowTransparency === "iffWhite") {
        const imageData = ctx.getImageData(0, 0, w, h);
        const d = imageData.data;
        for (let i = 0; i < d.length; i += 4) {
          const a = d[i + 3];
          if (a === 0x00) {
            if (allowTransparency === "iffWhite") {
              d[i] = 0xFF;
              d[i + 1] = 0xFF;
              d[i + 2] = 0xFF;
            }
          } else {
            const isWhite = (d[i] & d[i + 1] & d[i + 2]) === 0xFF;
            if (isWhite) {
              if (allowTransparency === "iffWhite")
                d[i + 3] = 0;
            } else if (a !== 0xFF) {
              for (let j = 0; j < 3; j++)
                d[i + j] = d[i + j] * a / 0xFF + 0xFF - a;
              d[i + 3] = 0xFF;
            }
          }
        }
        ctx.putImageData(imageData, 0, 0);
      }
      cleanUpFunc();
      resolve(canvas.toDataURL("image/png"));
    };
  });
  img.src = svgURL;
  return await dataURI;
}
