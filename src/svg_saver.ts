import {saveDownload} from './saver.ts';
import {PartialPNGConversionParams, getPNGDataURI, getSVGObjectURL} from './svg_converter.ts';

/** Triggers saving of the SVG as a file with the specified name. */
export function saveSVG({name, svg}: {
  name: string,
  svg: SVGSVGElement,
}) {
  const {url, cleanUpFunc} = getSVGObjectURL(svg);
  saveDownload({name, url, cleanup: cleanUpFunc});
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
