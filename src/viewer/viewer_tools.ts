import {assert, Sheet} from "../index.ts";

/**
 * Returns a `<div>` containing a preview of the Sheet, including checkboxes to control runs
 * visibility and buttons to save runs to files.
 */
export async function getSheetPreview(sheet: Sheet) {
  const div = document.createElement("div");
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.style.gap = "0.2em";
  const svgContainer = document.createElement("div");
  div.appendChild(svgContainer);
  const svg = await sheet.getPreviewSVG();
  svgContainer.appendChild(svg)
  div.appendChild(getSVGRunsControllerCheckboxes(svg));
  div.appendChild(sheet.getSaveLaserSVGButtons());
  return div;
}

/**
 * Returns a `<div>` with checkboxes controlling visibility of particular runs in the
 * `<svg>` element.
 */
export function getSVGRunsControllerCheckboxes(svg: SVGSVGElement) {
  const runsController = document.createElement("div");
  runsController.style.display = "flex";
  runsController.style.gap = ".5em";
  runsController.style.alignItems = "center";
  const blinkTimers: number[] = [];
  for (const g of svg.querySelectorAll(":scope > g[id]")) {
    const id = assert(g.getAttribute("id"));
    const span = document.createElement("span");
    runsController.appendChild(span);
    const checkbox = document.createElement("input");
    span.appendChild(checkbox);
    checkbox.setAttribute("type", "checkbox");
    checkbox.checked = true;
    const label = document.createElement("label");
    span.appendChild(label);
    label.appendChild(document.createTextNode(id));
    label.addEventListener("click", () => {
      checkbox.click();
    });
    checkbox.addEventListener("click", () => {
      (g as HTMLElement).style.display = checkbox.checked ? "" : "none";
    });
    for (const el of [label, checkbox])
      el.addEventListener("contextmenu", e => {
        e.preventDefault();
        for (const timer of blinkTimers)
          clearTimeout(timer);
        blinkTimers.length = 0;
        for (let i = 0; i < 5; i++)
          blinkTimers.push(setTimeout(() => {
            checkbox.click();
            setTimeout(() => {
              checkbox.click();
            }, 120);
          }, i * 240));
      });
  }
  return runsController;
}
