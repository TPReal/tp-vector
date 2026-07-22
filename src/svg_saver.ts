import {saveBlobDownload, saveDownload} from './saver.ts';
import {PartialPNGConversionParams, getPNGDataURI, getSVGBlob} from './svg_converter.ts';

function withExtension(name: string, extension: string) {
  return name.endsWith(extension) ? name : name + extension;
}

/** Triggers saving of the SVG as a file with the specified name (`.svg` appended if missing). */
export function saveSVG({name, svg}: {
  name: string,
  svg: SVGSVGElement,
}) {
  saveBlobDownload({name: withExtension(name, ".svg"), blob: getSVGBlob(svg)});
}

/** Triggers saving of the SVG as a PNG file with the specified name (`.png` appended if missing). */
export async function saveSVGAsPNG({
  name,
  svg,
  conversionParams,
}: {
  name: string,
  svg: SVGSVGElement,
  conversionParams: PartialPNGConversionParams,
}) {
  saveDownload({name: withExtension(name, ".png"), url: await getPNGDataURI(svg, conversionParams)});
}
