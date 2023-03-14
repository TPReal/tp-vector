import {BasicPiece, OrArray, Piece, Sheet, createInlineParams, createText, figures, gather, layouts} from '../index.ts';

const p = createInlineParams({
  max: 0.5,
  step: 0.1,
  divs: 2,
  scoresDist: 2,
  scoreLength: 6,
  divScoreLength: 4,
});
p.unitDist(p.scoresDist * p.divs / p.step);

const FONT = "monospace";

function scale({
  stretch = 1,
  getLabel,
}: {
  stretch?: number,
  getLabel?: (i: number) => Piece | undefined,
}) {
  const stepsPerSide = Math.round(p.max / p.step) * p.divs;
  return layouts.layout({
    count: {from: -stepsPerSide, to: stepsPerSide},
    pieceFunc: i => (i % p.divs ? figures.line([0, p.divScoreLength]) : gather(
      figures.line([0, p.scoreLength]),
      gather(getLabel && getLabel(i * p.step / p.divs)).translateY(p.scoreLength),
    )).moveRight(i * stretch * p.scoresDist),
  });
}

const CUT_COLOR = "#C00";
const PRINT_COLOR = "#00C";

function valToString(v: number) {
  return v.toFixed(v ? 1 : 0).replace("-", "−");
}

function vernierScale(zeroPrefix = "") {
  return gather(
    scale({stretch: (p.max + p.unitDist) / p.unitDist}).flipY().moveDown(p.max).setLayer("cut"),
    scale({
      getLabel: i => createText(
        i ? valToString(i) : zeroPrefix + valToString(i), {
        font: FONT,
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

function createSheet({suffix, pieces}: {
  suffix?: string,
  pieces: OrArray<BasicPiece | undefined>,
}) {
  return Sheet.create({
    options: {
      name: ["print_pos_correction_calibrator", suffix].filter(Boolean).join("_"),
      millimetersPerUnit: 1,
    },
    pieces: pieces,
    runs: [
      {
        type: "cut",
        styleAttributes: {
          preview: {stroke: CUT_COLOR},
        },
      },
      {
        type: "print",
        styleAttributes: {
          preview: {stroke: PRINT_COLOR, fill: PRINT_COLOR},
          laser: {stroke: "black", strokeWidth: 0.2},
        },
      },
    ],
  });
}

export const SHEET_X_AXIS = createSheet({
  suffix: "x",
  pieces: vernierScaleX,
});

export const SHEET_Y_AXIS = createSheet({
  suffix: "y",
  pieces: vernierScaleY,
});

export const SHEET = createSheet({
  pieces: gather(
    vernierScaleX.moveUp(p.max * p.unitDist - p.scoreLength + p.max),
    vernierScaleY.moveLeft(p.max * p.unitDist + p.scoreLength + 2),
  ),
});

// To calibrate print position, set in global options:
//   printPosCorrectionMillimeters: [dx, dy]
