import {TabsPattern} from '../interlock_patterns.ts';
import * as kerfUtil from '../kerf_util.ts';
import * as layouts from '../layouts.ts';
import {gather} from '../pieces.ts';
import {Sheet} from '../sheet.ts';
import {StartAngleDeg, TabbedFace, tabWidthForAcuteAngle, turtleInterlock} from '../tabbed_face.ts';

export const name = "House box";

export function getSheets() {

  const mpu = {millimetersPerUnit: 1};

  // Kerf calibrated experimentally.
  const kerf = kerfUtil.millimeters(0.18, mpu);

  const {TFace} = turtleInterlock({
    materialThickness: 3,
    kerf,
    tabsDir: "left",
    outerCornersRadius: 0.3,
  });

  interface SideParams {
    readonly tabsPattern: TabsPattern;
    readonly angleBefore?: number;
    readonly angleAfter?: number;
  }

  const verticalTabs = TabsPattern.distributed({
    // Height of the box.
    length: 15,
    numTabs: 2,
  });

  /** Builder of a prism-shaped box, with open or closed top. */
  class Box {

    protected constructor(
      readonly base: TabbedFace,
      protected readonly sideParams: readonly SideParams[],
    ) {}

    static create({startDir}: {startDir?: StartAngleDeg} = {}) {
      return new BoxForwardNext(
        TFace.create({
          startDir,
          mode: {boxMode: {verticalEdgesTabWidth: "same"}},
        }),
        [],
      );
    }

  }

  class BoxForwardNext extends Box {

    forward(length: number) {
      const tabsPattern = TabsPattern.distributed({
        length,
        minNumTabs: 1,
        tabEveryLen: 15,
      });
      return new BoxTurnNext(
        this.base.tabs(tabsPattern.matchingTabs()),
        [
          ...this.sideParams,
          {tabsPattern, angleBefore: this.sideParams.at(-1)?.angleAfter},
        ],
      );
    }

    close({allowOpen, posTolerance = 0.1}: {
      allowOpen?: boolean,
      posTolerance?: number,
    } = {}) {
      const openTopSides = [];
      const closedTopSides = [];
      for (const {
        tabsPattern,
        angleBefore = this.sideParams.at(-1)!.angleAfter,
        angleAfter,
      } of this.sideParams) {
        const [openTopSide, closedTopSide] = TFace.create({startDir: "down"})
          .with({
            options: {
              tabWidth: tabWidthForAcuteAngle({
                angleDeg: angleAfter!,
                tabWidth: TFace.options.tabWidth,
              }),
            }
          }, fc => fc.tabs(verticalTabs)).right()
          .tabsDef("bottom", tabsPattern).right()
          .with({
            options: {
              tabWidth: tabWidthForAcuteAngle({
                angleDeg: angleBefore!,
                tabWidth: TFace.options.tabWidth,
              }),
            }
          }, fc => fc.tabs(verticalTabs.matchingTabs().reverse())).right()
          .andThen(fc => [
            fc.noTabs("bottom"),
            fc.tabs("bottom", {reverse: true}),
          ].map(fc => fc
            .right()
            .closeFace()));
        openTopSides.push(openTopSide);
        closedTopSides.push(closedTopSide);
      }
      return {
        base: this.base.closeFace({allowOpen, posTolerance}),
        openTopSides,
        closedTopSides,
      };
    }

  }

  class BoxTurnNext extends Box {

    right(angleDeg = 90) {
      return new BoxForwardNext(
        this.base.right(angleDeg),
        [
          ...this.sideParams.slice(0, -1),
          {...this.sideParams.at(-1)!, angleAfter: angleDeg},
        ]);
    }

    left(angleDeg = 90) {
      return this.right(-angleDeg);
    }

  }

  const houseOuter = Box.create({startDir: "right"})
    .forward(45)
    .left().forward(15).right().forward(10).right().forward(15).left()
    .forward(20).right(50).forward(30).right(130).forward(10).left().forward(50).right()
    .forward(85).right()
    .forward(50).left().forward(10)
    // Calibrated to close the shape.
    // TODO: Create a mechanism to do this easier.
    .right(108.5).forward(24.4).right(71.5)
    .close();
  const window = Box.create()
    // Go in the opposite direction.
    .forward(20).left().forward(15).left()
    .forward(20).left().forward(15).left()
    .close();
  const house = gather(
    houseOuter.base,
    window.base.translate(40, 55),
  );
  const houseBases = layouts.row({
    pieces: [
      // Three copies of the house, to create one open and one closed box.
      house.center(),
      house.flipY().center(),
      house.center(),
    ],
    gap: -12,
  });
  const openTopSides = [...houseOuter.openTopSides, ...window.openTopSides];
  const closedTopSides = [...houseOuter.closedTopSides, ...window.closedTopSides];

  return Sheet.create({
    options: {name, ...mpu},
    pieces: layouts.column({
      pieces: [
        houseBases,
        ...[openTopSides, closedTopSides].map(sides =>
          // Place the sides automatically under the houses.
          layouts.fitInBoxes({
            pieces: sides,
            boxes: {
              width: houseBases.getBoundingBox().width,
              height: 1e6,
            },
          }).boxedPieces[0]!)
      ],
      gap: 5,
    }),
  });

  // See a photo: wiki/demos_box.jpg

}
