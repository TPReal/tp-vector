import {saveBlobDownload, saveDownload} from './saver.ts';
import {PartialPNGConversionParams, getPNGDataURI, getSVGBlob} from './svg_converter.ts';

/** Triggers saving of the SVG as a file with the specified name. */
export function saveSVG({name, svg}: {
  name: string,
  svg: SVGSVGElement,
}) {
  saveBlobDownload({name, blob: getSVGBlob(svg)});
}

/** Triggers saving of the SVG as a PNG file with the specified name. */
export async function saveSVGAsPNG({
  name,
  svg,
  conversionParams,
}: {
  name: string,
  svg: SVGSVGElement,
  conversionParams: PartialPNGConversionParams,
}) {
  saveDownload({name, url: await getPNGDataURI(svg, conversionParams)});
}
