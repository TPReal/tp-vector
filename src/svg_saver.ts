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
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function saveSVG({name, svg}: {
  name: string,
  svg: SVGSVGElement,
}) {
  const {url, cleanUpFunc} = getSVGObjectURL(svg);
  download({name, url, onClickFunc: cleanUpFunc});
}

export function saveSVGAsPNG({
  name,
  svg,
  conversionParams,
}: {
  name: string,
  svg: SVGSVGElement,
  conversionParams: PartialPNGConversionParams,
}) {
  getPNGDataURI(svg, conversionParams).then(dataURI => {
    download({name, url: dataURI});
  });
}
