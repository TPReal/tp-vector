import {PartialViewBox, Sheet, Turtle, figures, gather, viewBoxFromPartial} from 'tp-vector/index.ts';
import {viewBoxToString} from 'tp-vector/view_box.ts';

export function getAxis({min, max}: {min: number, max: number}) {
  let res = gather(
    figures.line([min + 0.2, 0], [max - 0.2, 0]),
    figures.line([max - 0.2, 0], [max - 0.5, 0.2]),
    figures.line([max - 0.2, 0], [max - 0.5, -0.2]),
  );
  for (let x = min + 1; x < max; x++)
    if (x)
      res = res.add(figures.line([x, -0.1], [x, 0.1]));
  return res;
}

export function getAxes(viewBox: PartialViewBox) {
  const {minX, width, minY, height} = viewBoxFromPartial(viewBox);
  if (minX > 0 || minX + width < 0 || minY > 0 || minY + height < 0)
    throw new Error(`Expected a ViewBox containing the origin ([0, 0]), ` +
      `got: ${viewBoxToString({minX, width, minY, height})}`);
  return gather(
    getAxis({min: minX, max: minX + width}),
    getAxis({min: minY, max: minY + height}).rotateRight(),
  );
}

export function getExplainerObject(box: PartialViewBox) {
  const fullBox = viewBoxFromPartial(box);
  return gather(
    figures.rectangle({...fullBox, cornerRadius: 0.5}),
    Turtle.create().forward(1).right()
      .forward(0.15).arcRight(180, 0.2).branch(t => t.forward(0.15))
      .turnBack().forward(0.05).arcRight(180, 0.3).forward(0.2)
      .scale(0.5, [0, -0.5]).moveRight(0.5 - 0.125).moveDown(1)
      .translate(fullBox.minX, fullBox.minY),
  )
}

export interface ImageSpec {
  label: string;
  runIds: string[];
}

export async function getExplainerSection(
  sheet: Sheet,
  images: ImageSpec[] = sheet.getRunIds().map(runId => ({label: runId, runIds: [runId]})),
) {
  const div = document.createElement("div");
  div.dataset.name = sheet.name || "";
  div.style.display = "flex";
  div.style.flexWrap = "wrap";
  div.style.gap = "1em 1px";
  for (const {label, runIds} of images) {
    const container = document.createElement("div");
    container.style.flex = "1 0 160px";
    container.style.maxWidth = "200px";
    container.appendChild(await sheet.getPreviewSVG({runsSelector: runIds}));
    const descDiv = document.createElement("div");
    descDiv.style.font = "0.8em monospace";
    descDiv.style.paddingRight = "1em";
    descDiv.textContent = label;
    container.appendChild(descDiv);
    div.appendChild(container);
  }
  return div;
}
