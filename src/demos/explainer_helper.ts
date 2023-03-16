import {Sheet, Turtle, figures, gather} from '../index.ts';

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

export function getDemoObject(size: {width: number, height: number}) {
  return gather(
    figures.rectangle({...size, cornerRadius: 0.5}),
    Turtle.create().forward(1).right()
      .forward(0.15).arcRight(180, 0.2).branch(t => t.forward(0.15))
      .turnBack().forward(0.05).arcRight(180, 0.3).forward(0.2)
      .scale(0.5, [0, -0.5]).moveRight(0.5 - 0.125).moveDown(1),
  )
}

export interface ImageSpec {
  label: string;
  runIds: string[];
}

export async function getDemoSection(
  sheet: Sheet,
  images: ImageSpec[] = sheet.getRunIds().map(runId => ({label: runId, runIds: [runId]})),
) {
  const div = document.createElement("div");
  div.style.display = "flex";
  div.style.flexWrap = "wrap";
  div.style.gap = "1px";
  for (const {label, runIds} of images) {
    const container = document.createElement("div");
    container.style.flex = "1 0 160px";
    container.style.maxWidth = "200px";
    const descDiv = document.createElement("div");
    descDiv.style.font = "0.8em monospace";
    descDiv.textContent = label;
    container.appendChild(descDiv);
    container.appendChild((await sheet.getPreviewSVG({runsSelector: runIds})));
    div.appendChild(container);
  }
  return div;
}
