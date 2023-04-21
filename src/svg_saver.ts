import {PartialPNGConversionParams, getPNGDataURI, getSVGObjectURL} from './svg_converter.ts';

function download({name, url, onClickFunc}: {
  name: string,
  url: string,
  onClickFunc?: () => void,
}) {
  const link = document.createElement("a");
  link.style.display = "none";
  link.download = name;
  link.href = url;
  link.onclick = onClickFunc || null;
  document.body.append(link);
  link.click();
  link.remove();
}

/** Triggers saving of the SVG as a file with the specified name. */
export function saveSVG({name, svg}: {
  name: string,
  svg: SVGSVGElement,
}) {
  const {url, cleanUpFunc} = getSVGObjectURL(svg);
  download({name, url, onClickFunc: cleanUpFunc});
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
  download({name, url: await getPNGDataURI(svg, conversionParams)});
}
