import * as figures from '../figures.ts';
import {TabsPattern} from '../interlock_patterns.ts';
import * as kerfUtil from '../kerf_util.ts';
import * as layouts from '../layouts.ts';
import {createNumParams} from '../params.ts';
import {gather, Piece} from '../pieces.ts';
import {Sheet} from '../sheet.ts';
import {turtleInterlock} from '../tabbed_face.ts';
import {createText} from '../text.ts';
import {Turtle} from '../turtle.ts';

export const name = "Kerf calibrator";

export interface KerfParams {
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  /** Material thickness (important especially for slots). */
  readonly thickness: number;
}

/**
 * Returns a calibrator Sheet for determining the right value for the kerf when cutting tabs
 * and slots. See _src/interlock.ts_.
 */
export function getSheets(params: KerfParams) {

  const p = createNumParams(p => ({
    min: 0,
    step: 0.03,
    max: 0.3,
    ...params,
    tabLen: 6,
    tabsSpace: 4,
    textHeight: 3,
    proberCornersRadius: 2,
    count: Math.floor((p.max - p.min) / p.step + 1e-9) + 1,
    frameCornersRadius: p.thickness + p.textHeight + p.thickness - p.tabsSpace / 2,
  }));

  const mpu = {millimetersPerUnit: 1};
  const fontOptions = {font: "monospace", size: p.textHeight};
  const {tabs, slots} = turtleInterlock({
    kerf: kerfUtil.ZERO,
    materialThickness: p.thickness,
    tabsDir: "left",
    outerCornersRadius: 0.5,
  });

  const prober = (() => {
    let t = Turtle.create();
    const pattern = TabsPattern.base(p.tabsSpace).tab(p.tabLen).base(p.tabsSpace);
    function makeTab(t: Turtle) {
      // Zero kerf is used here, double kerf is used on the frame instead.
      return t.andThen(tabs, pattern);
    }
    // Make the tabs for Y and X axes.
    for (let i = 0; i < 2; i++)
      t = t
        .andThen(makeTab)
        .arcRight(90, p.proberCornersRadius);
    // Make the tab at 45°.
    t = t
      .arcRight(45, p.proberCornersRadius)
      .forward(pattern.length() * (Math.sqrt(2) - 1) / 2)
      .andThen(makeTab)
      .forward(pattern.length() * (Math.sqrt(2) - 1) / 2)
      .arcRight(135, p.proberCornersRadius);
    return gather(
      t
        .center()
        .translate(-p.thickness / 2, -p.thickness / 2),
      ["X", "Y"].map((al, ai) =>
        createText(al, fontOptions)
          .normalise({x: "center", y: {max: -pattern.length() / 2}})
          .rotateLeft(90 * ai)
          .setLayer("print")
      ),
    )
      .normalise("default");
  })();

  const frameWithProbers = (() => {
    /** Pattern of a single tab, with half the space before and after. */
    const tabPattern = TabsPattern.base(p.tabsSpace / 2).tab(p.tabLen).base(p.tabsSpace / 2);
    let t = Turtle.create();
    const labels: Piece[] = [];
    function makeTabs(t: Turtle) {
      t = t.forward(p.tabsSpace / 2);
      for (let kerfI = 0; kerfI < p.count; kerfI++) {
        const kerfVal = p.min + kerfI * p.step;
        /**
         * Options for the tab/slot. Double kerf value is used because zero kerf is used
         * on the prober.
         */
        const options = {kerf: kerfUtil.millimeters(2 * kerfVal, mpu)};
        labels.push(createText(kerfVal.toFixed(2), fontOptions)
          .normalise({
            x: {pos: "center", len: p.tabLen},
            y: {min: p.thickness, len: p.textHeight, align: "center"},
          })
          .rotate(t.angleDeg - 90)
          .translate(...t.forward((p.tabsSpace + p.tabLen) / 2).pos));
        t = t.branch(
          t => t
            // Create the slot.
            .withPenUp(t => t
              .strafeRight(p.thickness + p.textHeight))
            .andThen(slots, {
              pattern: tabPattern.matchingSlots(),
              dir: "right",
              options,
            },
            ))
          // Create the tab.
          .andThen(tabs, {
            pattern: tabPattern.matchingTabs(),
            startOnTab: true,
            endOnTab: true,
            options,
          });
      }
      return t.forward(p.tabsSpace / 2);
    }
    // Make the tabs for Y and X axes.
    for (let i = 0; i < 2; i++)
      t = t.andThen(makeTabs).arcRight(90, p.frameCornersRadius);
    // Make the tabs at 45°.
    const totalTabsLength = p.count * p.tabLen + (p.count + 1) * p.tabsSpace;
    t = t
      .arcRight(45, p.frameCornersRadius)
      .forward(totalTabsLength * (Math.sqrt(2) - 1) / 2)
      .andThen(makeTabs)
      .forward(totalTabsLength * (Math.sqrt(2) - 1) / 2)
      .arcRight(135, p.frameCornersRadius);
    const innerCutToCenterDist = totalTabsLength / 2 - p.tabsSpace / 2 - 1.5 * p.textHeight;
    const innerCutCornerCoord =
      innerCutToCenterDist - Math.sqrt(2) * (totalTabsLength / 2 - innerCutToCenterDist);
    return gather(
      gather(
        t,
        gather(labels).setLayer("print"),
      ).center(),
      ["X", "Y"].map((al, ai) =>
        createText(al, fontOptions)
          .normalise({x: "center", y: {max: -innerCutToCenterDist}})
          .rotateLeft(90 * ai)
          .setLayer("print")
      ),
      // Inner cut.
      figures.polygon(
        [-innerCutToCenterDist, -innerCutToCenterDist],
        [innerCutCornerCoord, -innerCutToCenterDist],
        [-innerCutToCenterDist, innerCutCornerCoord],
      ),
      // Probers inside the cut-out inner triangle.
      layouts.pack([
        [prober, prober],
        prober,
      ])
        .translate(-innerCutToCenterDist + 1, -innerCutToCenterDist + 1),
    );
  })();

  return Sheet.create({
    options: {name, ...mpu},
    pieces: frameWithProbers,
  });

}
