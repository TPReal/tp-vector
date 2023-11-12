import {Piece, Sheet, createParams, createText, figures, gather, layouts} from 'tp-vector/index.ts';

export const name = "printPosCorrection calibrator";

export interface CorrectionParams {
  max?: number;
  step?: number;
}

/**
 * Returns a calibrator Sheet for determining the right value for
 * `GlobalOptions.printPosCorrectionMillimeters`.
 * @see {@link GlobalOptions.printPosCorrectionMillimeters}
 */
export function getSheets(params: CorrectionParams = {}) {

  const p = createParams({
    max: 0.5,
    step: 0.1,
    ...params,
    subdivs: 2,
    scoresDist: 1.5,
    scoreLength: 6,
    subdivScoreLength: 4,
  })(p => ({
    unitDist: p.scoresDist * p.subdivs / p.step,
  }));

  /** Creates a ruler scale. */
  function scale({
    stretch = 1,
    getLabel,
  }: {
    stretch?: number,
    getLabel?: (i: number) => Piece | undefined,
  }) {
    const stepsPerSide = Math.round(p.max / p.step) * p.subdivs;
    return layouts.layout({
      count: {from: -stepsPerSide, to: stepsPerSide},
      pieceFunc: i => (i % p.subdivs ? figures.line([0, p.subdivScoreLength]) : gather(
        figures.line([0, p.scoreLength]),
        gather(getLabel?.(i * p.step / p.subdivs)).translateY(p.scoreLength),
      )).moveRight(i * stretch * p.scoresDist),
    });
  }

  function valToString(v: number) {
    return v.toFixed(v ? 1 : 0);
  }

  /**
   * Creates a [Vernier scale](https://en.wikipedia.org/wiki/Vernier_scale)
   * consisting of two scales.
   */
  function vernierScale(zeroPrefix = "") {
    return gather(
      scale({stretch: (p.max + p.unitDist) / p.unitDist})
        .flipY().moveDown(p.max).setLayer("cut"),
      scale({
        getLabel: i => createText(
          i ? valToString(i) : zeroPrefix + valToString(i), {
          font: "monospace",
          size: 2,
          attributes: {
            stroke: "none",
            textAnchor: "end",
            dominantBaseline: "middle",
          },
        }).rotateLeft().moveDown(1),
      }).setAttributes({
        strokeWidth: 1,
        vectorEffect: "non-scaling-stroke",
      }).setLayer("print"),
    );
  }

  const vernierScaleX = vernierScale("dx = ");
  const vernierScaleY = vernierScale("dy = ").rotateRight();

  return Sheet.create({
    options: {
      name,
      millimetersPerUnit: 1,
      printPosCorrectionMillimeters: false,
    },
    pieces: [
      vernierScaleX.moveUp(p.max * p.unitDist - p.scoreLength + p.max),
      vernierScaleY.moveLeft(p.max * p.unitDist + p.scoreLength + 2),
    ],
  });

}
