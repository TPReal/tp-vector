import * as figures from '../figures.ts';
import * as layouts from '../layouts.ts';
import {gather} from '../pieces.ts';
import {Sheet} from '../sheet.ts';
import {Turtle} from '../turtle.ts';

export const name = "TPVector icon";

export function getSheets() {

  const COLOR = "#009dff";

  const numRays = 11;
  const icon = gather(
    figures.circle({radius: 1})
      .setAttributes({fill: COLOR}),
    layouts.layout({
      count: numRays,
      pieceFunc: i => i ?
        figures.line([0, -8]).moveUp(5).rotate(i * 360 / numRays) :
        undefined,
    }),
    figures.line([0, -14]),
    Turtle.create([-10, -18])
      .setAngle(90 + 70).forward(4).left(70).forward(22)
      .withPenUp(t => t.right(40).back(4))
      .forward(4).right(100).forward(4),
  ).setAttributes({
    fill: "none",
    stroke: COLOR,
    strokeWidth: 1.2,
  })
    .centerAndFitTo1By1({margin: 0.5})
    .setBoundingBox(figures.rectangle({centered: true}))
    .setLayer("print");

  return Sheet.create({
    options: {
      name,
      resolution: {pixelsPerUnit: 256},
    },
    pieces: icon,
    margin: 0,
  });

}
