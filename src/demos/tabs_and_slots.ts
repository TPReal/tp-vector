import {kerfUtil, layouts, Sheet, TabsPattern, Turtle} from '../index.ts';
import {turtleInterlock} from '../interlock.ts';

export function getSheet() {

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
    drawerGap: 0.5,
    drawerHandleWidth: 20,
    drawerHandleHeight: 14,
  };

  const {tabs, slots} = turtleInterlock({
    kerf,
    thickness: p.thickness,
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
    const frontToSidePat = TabsPattern.distributed({
      length: innerHeight,
      tabEveryLen: 15,
    });
    const frontToBottomPat = TabsPattern.distributed({
      length: innerWidth,
      tabEveryLen: 20,
    });
    const sideToBottomPat = TabsPattern.distributed({
      length: innerDepth,
      tabEveryLen: 20,
    });
    const [front, back] = Turtle.create()
      .andThen(tabs, frontToSidePat)
      .right()
      .andThen(t => [
        t
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
          .forward((innerWidth - p.drawerHandleWidth) / 2),
        t
          .forward(innerWidth),
      ]).map(t => t
        .right()
        .andThen(tabs, frontToSidePat)
        .right()
        .andThen(tabs, frontToBottomPat)
        .center()
      );
    const side = Turtle.create()
      .andThen(tabs, frontToSidePat.matchingTabs())
      .right()
      .forward(innerDepth)
      .right()
      .andThen(tabs, frontToSidePat.matchingTabs())
      .right()
      .andThen(tabs, sideToBottomPat)
      .center();
    const bottom = Turtle.create()
      .repeat(2, t => t
        .andThen(tabs, {
          pattern: sideToBottomPat.matchingTabs(),
          onTabLevel: true,
        })
        .forward(p.thickness).right().forward(p.thickness)
        .andThen(tabs, {
          pattern: frontToBottomPat.matchingTabs(),
          onTabLevel: true,
        })
        .forward(p.thickness).right().forward(p.thickness)
      )
      .center();
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
    const sideToTopPat = TabsPattern.distributed({
      length: lParams.outerDepth,
      tabEveryLen: 20,
    });
    const sideToBackPat = TabsPattern.distributed({
      length:
        p.drawerGap + lParams.outerHeight + p.drawerGap + p.thickness +
        p.drawerGap + sParams.outerHeight + p.drawerGap,
      tabEveryLen: 20,
    });
    const topToBackPat = TabsPattern.distributed({
      length: p.drawerGap + lParams.outerWidth + p.drawerGap,
      tabEveryLen: 20,
    });
    const shelfToSidePat = sideToTopPat;
    const shelfToBackPat = topToBackPat;
    const dividerToTopPat = sideToTopPat;
    const dividerToBackPat = TabsPattern.distributed({
      length: p.drawerGap + sParams.outerHeight + p.drawerGap,
      tabEveryLen: 20,
    });
    const divider = Turtle.create()
      .andThen(tabs, dividerToBackPat)
      .right()
      .andThen(tabs, dividerToTopPat)
      .right()
      .forward(dividerToBackPat.length())
      .right()
      .andThen(tabs, dividerToTopPat)
      .center();
    const shelf = Turtle.create()
      .andThen(tabs, shelfToSidePat)
      .right()
      .andThen(tabs, shelfToBackPat)
      .right()
      .andThen(tabs, shelfToSidePat)
      .right()
      .forward(shelfToBackPat.length())
      .withPenUp(t => t.back(shelfToBackPat.length() / 2))
      .right()
      .andThen(slots, dividerToTopPat.matchingSlots())
      .center();
    const [bottom, top] = Turtle.create()
      .andThen(tabs, sideToTopPat.matchingTabs())
      .right()
      .andThen(tabs, topToBackPat)
      .right()
      .andThen(tabs, sideToTopPat.matchingTabs())
      .right()
      .forward(shelfToBackPat.length())
      .andThen(t => [
        t.center(),
        t
          .withPenUp(t => t.back(shelfToBackPat.length() / 2))
          .right()
          .andThen(slots, dividerToTopPat.matchingSlots())
          .center(),
      ]);
    const leftSide = Turtle.create()
      .andThen(tabs, sideToBackPat)
      .right()
      .andThen(tabs, sideToTopPat)
      .right()
      .forward(sideToBackPat.length())
      .branch(t => t
        .withPenUp(t => t.back(p.drawerGap + lParams.outerHeight + p.drawerGap))
        .right()
        .andThen(slots, {
          pattern: shelfToSidePat.matchingSlots(),
          dir: "right",
        })
      )
      .right()
      .andThen(tabs, sideToTopPat)
      .center();
    const back = Turtle.create()
      .branch(t => t
        .withPenUp(t => t
          .forward(p.drawerGap + lParams.outerHeight + p.drawerGap)
          .strafeRight(p.thickness)
        )
        .right()
        .branch(t => t
          .andThen(slots, {
            pattern: shelfToBackPat.matchingSlots(),
            dir: "left",
          })
        )
        .withPenUp(t => t
          .forward(shelfToBackPat.length() / 2)
          .left()
          .forward(p.thickness)
        )
        .andThen(slots, dividerToBackPat.matchingSlots())
      )
      .repeat(2, t => t
        .andThen(tabs, {
          pattern: sideToBackPat.matchingTabs(),
          onTabLevel: true,
        })
        .forward(p.thickness).right().forward(p.thickness)
        .andThen(tabs, {
          pattern: topToBackPat.matchingTabs(),
          onTabLevel: true,
        })
        .forward(p.thickness).right().forward(p.thickness)
      ).center();
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
    options: {name: "Tabs and slots", ...mpu},
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
