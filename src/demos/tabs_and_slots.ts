import {TabsPattern} from '../interlock_patterns.ts';
import * as kerfUtil from '../kerf_util.ts';
import * as layouts from '../layouts.ts';
import {Sheet} from '../sheet.ts';
import {turtleInterlock} from '../tabbed_face.ts';

export const name = "Tabs and slots";

export function getSheets() {

  // A tiny chest of drawers, with three drawers in the following configuration:
  //
  //         divider
  //         |
  //         v
  // -----------------
  // |   U   |   U   |
  // |       |       |
  // ----------------- <- shelf
  // |       U       |
  // |               |
  // |               |
  // -----------------
  //
  // See photos: wiki/demos_interlock_*.jpg

  const mpu = {millimetersPerUnit: 1};

  // Kerf calibrated experimentally.
  const kerf = kerfUtil.millimeters(0.18, mpu);

  const p = {
    thickness: 3,
    drawerGap: 0.3,
    drawerHandleWidth: 20,
    drawerHandleHeight: 14,
  };

  const {slots, TFace} = turtleInterlock({
    kerf,
    materialThickness: p.thickness,
    tabsDir: "left",
    outerCornersRadius: 0.3,
  });

  class DrawerParams {

    readonly outerWidth;
    readonly outerHeight;
    readonly outerDepth;

    protected constructor(
      readonly innerWidth: number,
      readonly innerHeight: number,
      readonly innerDepth: number,
    ) {
      this.outerWidth = innerWidth + 2 * p.thickness;
      this.outerHeight = innerHeight + p.thickness;
      this.outerDepth = innerDepth + 2 * p.thickness;
    }

    static create(params: {
      innerWidth: number,
      innerHeight: number,
      innerDepth: number,
    }) {
      return new DrawerParams(params.innerWidth, params.innerHeight, params.innerDepth);
    }

  }

  function makeDrawer({innerWidth, innerHeight, innerDepth}: DrawerParams) {
    const [front, back] = TFace.create({startDir: "down"})
      .tabsDef("side", TabsPattern.distributed({
        length: innerHeight,
        tabEveryLen: 15,
      }))
      .right()
      .tabsDef("bottom", TabsPattern.distributed({
        length: innerWidth,
        tabEveryLen: 20,
      }))
      .right()
      .tabs("side")
      .right()
      .andThen(fc => [
        fc
          .andThenTurtle(t => t
            .forward((innerWidth - p.drawerHandleWidth) / 2)
            .curve(t => t
              .forward(p.drawerHandleWidth / 2)
              .strafeRight(p.drawerHandleHeight),
              {startSpeed: 4, targetSpeed: 10},
            )
            .curve(t => t
              .forward(p.drawerHandleWidth / 2)
              .strafeLeft(p.drawerHandleHeight),
              {startSpeed: 10, targetSpeed: 4},
            )
            .forward((innerWidth - p.drawerHandleWidth) / 2)
          ),
        fc
          .noTabs("bottom"),
      ].map(fc => fc
        .right()
        .closeFace())
      );
    const side = TFace.create({startDir: "down"})
      .tabs(back.fit.side)
      .right()
      .tabsDef("bottom", TabsPattern.distributed({
        length: innerDepth,
        tabEveryLen: 20,
      }))
      .right()
      .tabs(front.fit.side)
      .right()
      .noTabs("bottom")
      .right()
      .closeFace();
    const bottom = TFace.create()
      .tabs(side.fit.bottom)
      .right()
      .tabs(back.fit.bottom)
      .right()
      .tabs(side.fit.bottom)
      .right()
      .tabs(front.fit.bottom)
      .right()
      .closeFace();
    // Return the drawer parts separately, so that a separate logic can arrange them.
    return {front, back, side, bottom};
  }

  const smallDrawerParams = DrawerParams.create({
    innerWidth: 30,
    innerHeight: 30,
    innerDepth: 50,
  });
  const largeDrawerParams = DrawerParams.create({
    innerWidth: -p.thickness + smallDrawerParams.outerWidth + p.drawerGap + p.thickness +
      p.drawerGap + smallDrawerParams.outerWidth - p.thickness,
    innerHeight: 40,
    innerDepth: smallDrawerParams.innerDepth,
  });

  const smallDrawer = (() => {
    const {front, back, side, bottom} = makeDrawer(smallDrawerParams);
    return layouts.pack([
      [front, back],
      side,
      side,
      bottom.rotateRight(),
    ]);
  })();
  const largeDrawer = (() => {
    const {front, back, side, bottom} = makeDrawer(largeDrawerParams);
    return layouts.pack([
      bottom,
      [front, side],
      [back, side],
    ]);
  })();

  function makeChest(sParams: DrawerParams, lParams: DrawerParams) {
    const leftSide = TFace.create()
      .tabsDef("back", TabsPattern.distributed({
        length:
          p.drawerGap + lParams.outerHeight + p.drawerGap + p.thickness +
          p.drawerGap + sParams.outerHeight + p.drawerGap,
        tabEveryLen: 20,
      }))
      .right()
      .tabsDef("top", TabsPattern.distributed({
        length: lParams.outerDepth,
        tabEveryLen: 20,
      }))
      .right()
      .noTabs("back")
      .andThen(fc => fc.branchTurtle(t => t
        .withPenUp(t => t.back(p.drawerGap + lParams.outerHeight + p.drawerGap))
        .right()
        .andThen(slots, {
          pattern: fc.pat.top.matchingSlots(),
          dir: "right",
        })
      ))
      .right()
      .tabsDef("bottom", "top")
      .right()
      .closeFace();
    const divider = TFace.create()
      .tabsDef("back", TabsPattern.distributed({
        length: p.drawerGap + sParams.outerHeight + p.drawerGap,
        tabEveryLen: 20,
      }))
      .right()
      .tabsDef("top", leftSide.tt.top)
      .right()
      .noTabs("back")
      .right()
      .tabsDef("bottom", "top")
      .right()
      .closeFace();
    const shelf = TFace.create()
      .tabsDef("side", leftSide.tt.top)
      .right()
      .tabsDef("back", TabsPattern.distributed({
        length: p.drawerGap + lParams.outerWidth + p.drawerGap,
        tabEveryLen: 20,
      }))
      .right()
      .tabs("side")
      .right()
      .noTabs("back")
      .andThen(fc => fc.branchTurtle(t => t
        .withPenUp(t => t.back(fc.pat.back.length() / 2))
        .right()
        .andThen(slots, divider.pat.bottom.matchingSlots())
      ))
      .right()
      .closeFace();
    const [bottom, top] = TFace.create()
      .tabsDef("side", leftSide.fit.top)
      .right()
      .tabsDef("back", TabsPattern.distributed({
        length: p.drawerGap + lParams.outerWidth + p.drawerGap,
        tabEveryLen: 20,
      }))
      .right()
      .tabs("side")
      .right()
      .noTabs("back")
      .andThen(fc => [
        fc,
        fc.branchTurtle(t => t
          .withPenUp(t => t.back(shelf.pat.back.length() / 2))
          .right()
          .andThen(slots, divider.pat.top.matchingSlots())
        ),
      ].map(fc => fc
        .right()
        .closeFace()
      ));
    const back = TFace.create()
      .branchTurtle(t => t
        .withPenUp(t => t
          .forward(p.drawerGap + lParams.outerHeight + p.drawerGap)
          .strafeRight(p.thickness)
        )
        .right()
        .branch(t => t
          .andThen(slots, {
            pattern: shelf.pat.back.matchingSlots(),
            dir: "left",
          })
        )
        .withPenUp(t => t
          .forward(shelf.pat.back.length() / 2)
          .left()
          .forward(p.thickness)
        )
        .andThen(slots, divider.pat.back.matchingSlots())
      )
      .tabs(leftSide.fit.back)
      .right()
      .tabs(top.fit.back)
      .right()
      .tabs(leftSide.fit.back)
      .right()
      .tabs(bottom.fit.back)
      .right()
      .closeFace();
    // Return the drawer parts separately, so that a separate logic can arrange them.
    return {divider, shelf, top, bottom, leftSide, back};
  }

  const chest = (() => {
    const {divider, shelf, top, bottom, leftSide, back} =
      makeChest(smallDrawerParams, largeDrawerParams);
    return layouts.pack([
      [shelf.rotateRight(), top.rotateRight(), bottom.rotateRight(), divider.rotateRight()],
      [leftSide, leftSide.flipX(), back],
    ]);
  })();

  return Sheet.create({
    options: {name, ...mpu},
    pieces: layouts.pack([
      chest,
      [
        layouts.row({
          pieces: [smallDrawer.center(), smallDrawer.rotate(180).center()],
          // Move them closer together.
          gap: -(2 * smallDrawerParams.outerWidth - smallDrawerParams.outerDepth),
        }),
        largeDrawer,
      ],
    ]),
  });

  // See photos: wiki/demos_interlock_*.jpg

}
