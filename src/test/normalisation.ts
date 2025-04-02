import {createClipPath} from '../def_tools.ts';
import * as figures from '../figures.ts';
import * as layouts from '../layouts.ts';
import {gather, Piece} from '../pieces.ts';
import {Sheet} from '../sheet.ts';
import {createText} from '../text.ts';
import {PartialViewBox, viewBoxFromPartial} from '../view_box.ts';

export function getSheet() {

  const sizePairs: [number, number][] = [
    [2, 3], [3, 2],
    [0, 3], [3, 0],
    [0, 0],
  ];

  function fig(vb: PartialViewBox, cornerRadius = 0) {
    const {minX, minY, width, height} = viewBoxFromPartial(vb);
    return gather(
      figures.rectangle({
        ...vb,
        cornerRadius,
      }),
      figures.line(
        [minX, minY],
        [minX + width, minY + height],
      ),
    );
  }

  function figView(pc: Piece) {
    const {minX, minY, width, height} = viewBoxFromPartial(pc.getBoundingBox());
    if (width) {
      if (height)
        return pc;
      return figures.line([width, 0]).translate(minX, minY);
    }
    if (height)
      return figures.line([0, height]).translate(minX, minY);
    return figures.circle({
      center: [minX, minY],
      radius: 0.1,
    });
  }

  const pieces = layouts.pack({
    pieces: sizePairs.map(([x1, x2]) =>
      sizePairs.map(([y1, y2]) => {
        const target: PartialViewBox = {width: x2, height: y2};
        return gather(
          gather(
            figures.rectangle({side: 3})
              .setAttributes({stroke: "#ccc"}),
            fig(target)
              .andThen(figView)
              .setAttributes({stroke: "green"}),
            fig({minX: 2, minY: 2, width: x1, height: y1}, 10)
              .normalise({
                target,
                // align: "center",
                // align: {x: "right", y: "bottom"},
                // fitting: "fill",
                // fitting: "stretch",
              })
              .andThen(figView)
              .setAttributes({stroke: "red"}),
          )
            .setAttributes({strokeWidth: 3}),
          createText(`${x1}×${y1}→${x2}×${y2}`, {
            font: "monospace",
            fontAttributes: {bold: true},
            size: 2,
          })
            .normalise({target: {width: 3}})
            .setAttributes({
              stroke: "none",
              fill: "blue",
            }),
        )
          .useDefTool(createClipPath(figures.rectangle({side: 3, margin: 0.2})))
          .setBoundingBox({side: 3});
      })
    ),
    gap: 0.3,
  });

  return Sheet.create({
    options: {name: "normalisation_test", millimetersPerUnit: 1},
    pieces,
  });

}
