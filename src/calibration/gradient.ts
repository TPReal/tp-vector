import {Sheet, Turtle, figures, createLinearGradient, gather, layouts, createParams} from '../index.ts';

/** Returns a calibrator Sheet for testing gradients. */
export function getSheet() {

  const p = createParams({
    size: {
      width: 50,
      height: 5,
    },
    divs: 4,
    margins: 0.5,
    dasharray: [2, 4, 2, 6],
  })(p => ({
    marginRatio: p.margins / (p.divs + 2 * p.margins),
    innerRatio: p.divs / (p.divs + 2 * p.margins),
  }));

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
      .repeat(p.dasharray, (t, d, i) =>
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
    options: {
      name: "Gradient calibrator",
      millimetersPerUnit: 1,
    },
    pieces: gradient,
  });

}
