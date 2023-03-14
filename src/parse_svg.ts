export function parseSVG(svgElements: string) {
  const container = document.createElement("div");
  container.innerHTML = `<svg>${svgElements}</svg>`;
  return [...(container.childNodes[0] as SVGSVGElement).children] as SVGElement[];
}
