import {createLinearGradient} from '../def_tools.ts';
import * as figures from '../figures.ts';
import * as layouts from '../layouts.ts';
import {createNumParams} from '../params.ts';
import {gather} from '../pieces.ts';
import {Sheet} from '../sheet.ts';
import {Turtle} from '../turtle.ts';

export const name = "Gradient calibrator";

/** Returns a calibrator Sheet for testing gradients. */
export function getSheets() {

  const p = createNumParams(p => ({
    size: {
      width: 50,
      height: 5,
    },
    divs: 4,
    margins: 0.5,
    marginRatio: p.margins / (p.divs + 2 * p.margins),
    innerRatio: p.divs / (p.divs + 2 * p.margins),
  }));
  const dasharray = [2, 4, 2, 6];

  const gradient = gather(
    figures.rectangle({...p.size, cornerRadius: 0.5}),
    figures.rectangle(p.size)
      .useDefTool(createLinearGradient({
        stops: [{color: "white"}, {color: "black"}],
        from: [p.marginRatio, undefined],
        to: [1 - p.marginRatio, undefined],
      }), ["fill", "stroke"])
      .setAttributes({strokeWidth: 0.3})
      .setLayer("print"),
    Turtle.create()
      .repeat(dasharray, (t, d, i) =>
        t.penDown(i % 2 === 0).forward(d)
      )
      .normalise({y: {min: 0, max: p.size.height}})
      .andThen(li => layouts.layout({
        count: p.divs + 1,
        pieceFunc: i => li
          .moveRight((p.marginRatio + i / p.divs * p.innerRatio) * p.size.width),
      })),
  );

  return Sheet.create({
    options: {name, millimetersPerUnit: 1},
    pieces: gradient,
  });

}
