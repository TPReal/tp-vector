import {InterlockPattern, SlotsPattern, TabsPattern} from './interlock_patterns.ts';
import * as kerfUtil from './kerf_util.ts';
import {Kerf} from './kerf_util.ts';
import {Turtle, TurtleFunc} from './turtle.ts';
import {hasOwnProperty} from './util.ts';

export interface PartialTabsOptions {
  kerf: Kerf;
  thickness: number;
  innerCornersRadius?: number;
  outerCornersRadius?: number;
}
export interface TabsOptions extends Readonly<Required<PartialTabsOptions>> {
}
export function tabsOptionsFromPartial({
  kerf,
  thickness,
  innerCornersRadius = 0,
  outerCornersRadius = 0,
}: PartialTabsOptions): TabsOptions {
  return {
    kerf,
    thickness,
    innerCornersRadius,
    outerCornersRadius,
  };
}

export interface PartialSlotsOptions {
  kerf: Kerf;
  thickness: number;
  slotWidthKerf?: boolean | Kerf;
  innerCornersRadius?: number;
}
export interface SlotsOptions extends Readonly<Required<PartialSlotsOptions>> {
  readonly kerf: Kerf;
  readonly thickness: number;
  readonly slotWidthKerf: Kerf;
  readonly innerCornersRadius: number;
}
export function slotsOptionsFromPartial({
  kerf,
  thickness,
  slotWidthKerf: swkInput = true,
  innerCornersRadius = 0,
}: PartialSlotsOptions): SlotsOptions {
  const slotWidthKerf = swkInput === true ? kerf : swkInput || kerfUtil.ZERO;
  return {
    kerf,
    thickness,
    slotWidthKerf,
    innerCornersRadius,
  };
}

export interface PartialInterlockOptions
  extends PartialTabsOptions, PartialSlotsOptions {
}

interface TabsArgs {
  pattern: TabsPattern;
  dir: "right" | "left";
  onTabLevel?: boolean;
  startOnTab?: boolean;
  endOnTab?: boolean;
  options: PartialTabsOptions;
}

interface SlotsArgs {
  pattern: SlotsPattern;
  dir?: "right" | "left" | "center";
  options: PartialSlotsOptions;
}

type ArgsWithOptionsSupplement<Args extends TabsArgs | SlotsArgs> =
  Omit<Args, "options"> & {options?: Partial<Args["options"]>};

interface ExportedFunc<Args extends TabsArgs | SlotsArgs> extends TurtleFunc<[Args]> {
  (args: Args): TurtleFunc;
  (options: Args["options"]): TurtleFunc<[ArgsWithOptionsSupplement<Args>]>;
}

function makeExportedFunc<Args extends TabsArgs | SlotsArgs>(base: TurtleFunc<[Args]>):
  ExportedFunc<Args> {
  function funcFromArgs(args: Args): TurtleFunc {
    return t => base(t, args);
  }
  function funcFromOpts(options: Args["options"]):
    TurtleFunc<[ArgsWithOptionsSupplement<Args>]> {
    return (t, argsSupplement) => {
      return base(t, {
        ...argsSupplement,
        options: {
          ...options,
          ...argsSupplement.options,
        } satisfies Args["options"],
      } as Args);
    };
  }
  function isTurtleArgs(args: Parameters<typeof base | typeof funcFromArgs | typeof funcFromOpts>):
    args is Parameters<typeof base> {
    return args[0] instanceof Turtle;
  }
  function isArgsParams(args: Parameters<typeof funcFromArgs | typeof funcFromOpts>):
    args is Parameters<typeof funcFromArgs> {
    const [arg] = args;
    return hasOwnProperty(arg, "pattern") && hasOwnProperty(arg, "dir") &&
      hasOwnProperty(arg, "options");
  }
  function func(...args: Parameters<typeof base>): ReturnType<typeof base>;
  function func(...args: Parameters<typeof funcFromArgs>): ReturnType<typeof funcFromArgs>;
  function func(...args: Parameters<typeof funcFromOpts>): ReturnType<typeof funcFromOpts>;
  function func(...args: Parameters<typeof base | typeof funcFromArgs | typeof funcFromOpts>) {
    if (isTurtleArgs(args))
      return base(...args);
    if (isArgsParams(args))
      return funcFromArgs(...args);
    return funcFromOpts(...args);
  }
  return func;
}

interface ProgressionBoundaryItem {
  kind: "boundary";
  boundary: "start" | "end";
  active: boolean;
}
interface ProgressionForwardItem {
  kind: "forward";
  active: boolean;
  length: number;
}
interface ProgressionActiveEdgeItem {
  kind: "activeEdge";
  newActive: boolean;
  useKerf: boolean;
}
type ProgressionItem =
  ProgressionForwardItem | ProgressionActiveEdgeItem | ProgressionBoundaryItem;

function patternProgression({pattern, startActive, endActive}: {
  pattern: InterlockPattern,
  startActive: boolean,
  endActive: boolean,
}) {
  let active = startActive;
  const items: ProgressionItem[] = [{
    kind: "boundary",
    boundary: "start",
    active,
  }];
  for (const item of pattern.items) {
    if (item.active !== active) {
      active = item.active;
      items.push({
        kind: "activeEdge",
        newActive: active,
        useKerf: items.length > 1,
      });
    }
    items.push({
      kind: "forward",
      active,
      length: item.length,
    });
  }
  if (endActive !== active) {
    active = endActive;
    items.push({
      kind: "activeEdge",
      newActive: active,
      useKerf: false,
    });
  }
  items.push({
    kind: "boundary",
    boundary: "end",
    active,
  });
  return items;
}

function signAbs(v: number) {
  if (v > 0)
    return [1, v];
  if (v < 0)
    return [-1, -v];
  return [0, 0];
}

function arcTurn(t: Turtle, rSign: number, rVal: number, d: number) {
  if (rVal === 0)
    return t.right(90 * d)
  else if (rSign > 0)
    return t.arcRight(90 * d, rVal * d)
  else
    return t.left(90 * d).arcRight(270 * d, rVal * d).left(90 * d);
}

const TURTLE_TABS_BASE_FUNC: TurtleFunc<[TabsArgs]> = (t, {
  pattern,
  dir,
  onTabLevel = false,
  startOnTab: startActive = onTabLevel,
  endOnTab: endActive = onTabLevel,
  options,
}) => {
  const {kerf, thickness, innerCornersRadius, outerCornersRadius} =
    tabsOptionsFromPartial(options);
  const progression = patternProgression({
    pattern: pattern.pattern,
    startActive,
    endActive,
  });
  for (let i = 0; i + 2 < progression.length; i++) {
    const [prev, curr, next] = progression.slice(i, i + 3);
    if (curr.kind === "forward") {
      if (prev.kind === "boundary")
        t = t.forward(curr.length / 2);
      if (next.kind === "boundary")
        t = t.forward(curr.length / 2);
    } else if (curr.kind === "activeEdge") {
      const kerfCorrection = curr.useKerf ?
        kerf.oneSideInUnits * (curr.newActive ? -1 : 1) : 0;
      const preLen = (prev.kind === "forward" ? prev.length / 2 : 0) + kerfCorrection;
      const postLen = (next.kind === "forward" ? next.length / 2 : 0) - kerfCorrection;
      if (preLen < 0 || postLen < 0)
        throw new Error(`Kerf too big, negative edge`);
      const radii = [-innerCornersRadius, outerCornersRadius];
      if (!curr.newActive)
        radii.reverse();
      const neighs = [prev, next];
      const [[r1Sign, r1Val], [r2Sign, r2Val]] = radii.map((r, ri) =>
        signAbs(neighs[ri].kind === "boundary" ? 0 : r));
      const d = (dir === "right" ? 1 : -1) * (curr.newActive ? 1 : -1);
      t = t.forward(preLen - r1Val)
        .then(arcTurn, r1Sign, r1Val, d)
        .forward(thickness - r1Val - r2Val)
        .then(arcTurn, r2Sign, r2Val, -d)
        .forward(postLen - r2Val);
    }
  }
  return t;
}

const SLOT_DIR_VALUES = {
  "center": 0,
  "right": 1,
  "left": -1,
};

const TURTLE_SLOTS_BASE_FUNC: TurtleFunc<[SlotsArgs]> = (t, {
  pattern,
  dir = "center",
  options,
}) => {
  const {kerf, thickness, slotWidthKerf, innerCornersRadius} =
    slotsOptionsFromPartial(options);
  const progression = patternProgression({
    pattern: pattern.pattern,
    startActive: pattern.startsWithSlot(),
    endActive: pattern.endsWithSlot(),
  });
  return t.branch(t => {
    t = t.withPenUp(t => t.strafeRight(thickness / 2 * SLOT_DIR_VALUES[dir]));
    const halfWid = Math.max(0, thickness / 2 - slotWidthKerf.oneSideInUnits);
    for (const d of [1, -1])
      t = t.branch(t => {
        if (pattern.startsWithSlot())
          t = t.withPenUp(t => t.strafeRight(halfWid * d));
        function fwd(t: Turtle, penDown: boolean, length: number) {
          return t.withPenDown(penDown, t => t.forward(length));
        }
        for (let i = 0; i + 2 < progression.length; i++) {
          const [prev, curr, next] = progression.slice(i, i + 3);
          if (curr.kind === "forward") {
            if (prev.kind === "boundary")
              t = t.then(fwd, curr.active, curr.length / 2);
            if (next.kind === "boundary")
              t = t.then(fwd, curr.active, curr.length / 2);
          } else if (curr.kind === "activeEdge") {
            const kerfCorrection = curr.useKerf ?
              kerf.oneSideInUnits * (curr.newActive ? 1 : -1) : 0;
            const preLen = (prev.kind === "forward" ? prev.length / 2 : 0) + kerfCorrection;
            const postLen = (next.kind === "forward" ? next.length / 2 : 0) - kerfCorrection;
            if (preLen < 0 || postLen < 0)
              throw new Error(`Kerf too big, negative edge`);
            const [rSign, rVal] = signAbs(-innerCornersRadius);
            if (curr.newActive)
              t = t.then(fwd, false, preLen)
                .right(90 * d)
                .forward(halfWid - rVal)
                .then(arcTurn, rSign, rVal, -d)
                .forward(postLen - rVal);
            else
              t = t.forward(preLen - rVal)
                .then(arcTurn, rSign, rVal, -d)
                .forward(halfWid - rVal)
                .right(90 * d)
                .then(fwd, false, postLen);
          }
        }
        return t;
      });
    return t;
  }).withPenUp(t =>
    t.forward(progression.reduce((s, i) => i.kind === "forward" ? s + i.length : s, 0)),
  );
}

export const turtleTabs: ExportedFunc<TabsArgs> = makeExportedFunc(TURTLE_TABS_BASE_FUNC);
export const turtleSlots: ExportedFunc<SlotsArgs> = makeExportedFunc(TURTLE_SLOTS_BASE_FUNC);

export function turtleInterlock(options: PartialInterlockOptions) {
  return {
    tabs: turtleTabs(options),
    slots: turtleSlots(options),
  };
}

export function tabsPiece(args: TabsArgs) {
  return Turtle.create().then(TURTLE_TABS_BASE_FUNC, args).asPath();
}

export function slotsPiece(args: SlotsArgs) {
  return Turtle.create().then(TURTLE_SLOTS_BASE_FUNC, args).asPath();
}
