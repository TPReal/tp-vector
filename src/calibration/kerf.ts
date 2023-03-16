import {Sheet, TabsPattern, Turtle, createText, figures, gather, kerfUtil, layouts, turtleInterlock} from '../index.ts';

const p = {
  kerfMin: 0,
  kerfStep: 0.03,
  kerfCount: 12,
  tabLen: 8,
  holesMargin: 4,
  outerCornersRadius: 2,
  frameCornerStraight: 10,
  frameInnerSide: 60,
};

const FONT = "monospace";

function interlock(params: Params) {
  return turtleInterlock({
    kerf: kerfUtil.ZERO,
    thickness: params.thicknessMillimeters,
    outerCornersRadius: 0.5,
    slotWidthKerf: false,
  });
}

function text(t: string) {
  return createText(t, {font: FONT, size: 3.5}).center().setLayer("print");
}

function frame(params: Params) {
  const {tabs, slots} = interlock(params);
  const pat = TabsPattern.create()
    .base(p.holesMargin / 2).tab(p.tabLen).base(p.holesMargin / 2);
  let t = Turtle.create();
  const labels = [];
  for (let i = 0; i < 4; i++) {
    for (let kerfI = 0; kerfI < p.kerfCount / 2; kerfI++) {
      const kerfVal = p.kerfMin + kerfI * p.kerfStep + (i >> 1) * p.kerfCount / 2 * p.kerfStep;
      const kerf = {oneSideInUnits: kerfVal};
      const kerfText = text(kerfVal.toFixed(2)).scale(0.8);
      labels.push(kerfText
        .normalise({y: {min: params.thicknessMillimeters}})
        .rotate(t.angleDeg - 90)
        .translate(...t.forward((p.holesMargin + p.tabLen) / 2).pos));
      t = t.branch(
        t => t
          .withPenUp(t => t
            .strafeRight(params.thicknessMillimeters + kerfText.getBoundingBox().height))
          .then(slots, {
            pattern: pat.matchingSlots(),
            dir: "right",
            options: {
              kerf,
              thickness: params.thicknessMillimeters,
            },
          },
          ))
        .then(tabs, {
          pattern: pat.matchingTabs(),
          dir: "left",
          startOnTab: true,
          endOnTab: true,
          options: {kerf},
        });
    }
    t = t.forward(p.frameCornerStraight)
      .arcRight(90, p.outerCornersRadius)
      .forward(p.frameCornerStraight);
  }
  return gather(
    gather(
      t,
      ...labels,
      text("kerf").rotateRight(45).translate(
        (p.outerCornersRadius + p.frameCornerStraight) / 2,
        (p.outerCornersRadius + p.frameCornerStraight) / 2,
      ),
    ).center(),
    figures.rectangle({
      centered: true,
      side: p.frameInnerSide,
      cornerRadius: p.outerCornersRadius,
    }),
    ["X", "Y"].map((al, ai) =>
      text(al).normalise({y: {max: 0}})
        .moveUp(p.frameInnerSide / 2)
        .rotateRight(90 * ai)
        .then(pc => gather(pc, pc.scale(-1)))),
  );
}

function prober(params: Params) {
  const {tabs} = interlock(params);
  let t = Turtle.create();
  for (let i = 0; i < 4; i++)
    t = t.then(tabs, {
      pattern: TabsPattern.create()
        .base(p.holesMargin).tab(p.tabLen).base(p.holesMargin),
      dir: "left",
    }).arcRight(90, p.outerCornersRadius);
  return gather(
    t.center(),
    text("kerf").rotateRight(45),
    ["X", "Y"].map((al, ai) =>
      text(al).normalise({y: {max: 0}})
        .moveDown(p.tabLen / 2 + p.holesMargin + p.outerCornersRadius +
          params.thicknessMillimeters)
        .rotateRight(90 * ai)
        .then(pc => gather(pc, pc.scale(-1)))),
  );
}

export interface Params {
  thicknessMillimeters: number;
}

// TODO: All logic in the function.
export function getSheet(params: Params) {
  return Sheet.create({
    options: {name: "kerf_calibrator", millimetersPerUnit: 1},
    pieces: [
      frame(params),
      layouts.gridRepeat({columns: 2, rows: 2, piece: prober(params)}).center(),
    ],
  });
}

export const SHEET_3MILLIMETERS = getSheet({thicknessMillimeters: 3});

// TODO: Clean up.
