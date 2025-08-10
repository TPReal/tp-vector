import {PartialInterlockOptions, PartialTabsOptions, TabsOptions, TurtleTabsFunc, turtleInterlock as origTurtleInterlock, tabsOptionsFromPartial, turtleTabs} from './interlock.ts';
import {TabsPattern} from './interlock_patterns.ts';
import {SimpleLazyPiece} from './lazy_piece.ts';
import {DefaultPiece, Piece, PieceFunc} from './pieces.ts';
import {LazyTurtleFunc, PartialCurveArgs, Turtle, TurtleFunc, TurtleFuncArg} from './turtle.ts';
import {almostEqual, sinCos} from './util.ts';

type TabsFuncParams = Parameters<TurtleTabsFunc>[1];
type ExpandedTabsFuncParams = Readonly<Exclude<TabsFuncParams, TabsPattern>>;

function expandTabsFuncParams(params: TabsFuncParams): ExpandedTabsFuncParams {
  return params instanceof TabsPattern ? {pattern: params} : params;
}

enum Level {
  BASE = "B",
  TAB = "T",
}
function toLevel(onTab: boolean) {
  return onTab ? Level.TAB : Level.BASE;
}
function isOnTab(level: Level) {
  return level === Level.TAB;
}

interface LevelSegment {
  readonly kind: "dual";
  readonly getFunc: (level: Level) => TurtleFunc;
}

interface LevelPreference {
  readonly level: Level;
  readonly required?: boolean;
}

interface HopSegment {
  readonly kind: "hop";
  readonly start?: LevelPreference;
  readonly end?: LevelPreference;
  readonly getFunc: (start: Level, end: Level) => TurtleFunc;
}

type Segment = LevelSegment | HopSegment;

function isHopSegment(segment: Segment): segment is HopSegment {
  return segment.kind === "hop";
}

const IDENTITY_FUNC: TurtleFunc = t => t;

function levelString(level: Level) {
  return level === Level.BASE ? "base level" : "tab level";
}

function getPointLevel(
  prevPref: LevelPreference | undefined, nextPref: LevelPreference | undefined): Level {
  if (prevPref?.required) {
    if (nextPref?.required && nextPref.level !== prevPref.level)
      throw new Error(
        `Mismatching levels: previous segment ends on ${levelString(prevPref.level)}, ` +
        `next segment starts on ${levelString(nextPref.level)}`);
    return prevPref.level;
  }
  if (nextPref?.required)
    return nextPref.level;
  if (prevPref) {
    if (nextPref && nextPref.level !== prevPref.level)
      return Level.BASE;
    return prevPref.level;
  }
  if (nextPref)
    return nextPref.level;
  return Level.BASE;
}

const MAX_FORWARD_LEN_MULTIPLIER_ON_TURN = 1e3;

function lazyMappedObject<K extends string, V, U>(
  object: Readonly<Record<K, V>>, func: (val: V) => U): Readonly<Record<K, U>> {
  return new Proxy({}, {
    get: (_, key: K) => func(object[key]),
  }) as Readonly<Record<K, U>>;
}

interface TabsDict<P extends string = never> {
  tt: Readonly<Record<P, ExpandedTabsFuncParams>>;
  fit: Readonly<Record<P, ExpandedTabsFuncParams>>;
  pat: Readonly<Record<P, TabsPattern>>;
}

function bInv(b: boolean | "auto" | undefined) {
  return b === "auto" || b === undefined ? b : !b;
}

function matchingTabs({
  pattern,
  onTabLevel,
  startOnTab,
  endOnTab,
  options,
}: ExpandedTabsFuncParams): ExpandedTabsFuncParams {
  return {
    pattern: pattern.matchingTabs(),
    onTabLevel: bInv(onTabLevel),
    startOnTab: bInv(startOnTab),
    endOnTab: bInv(endOnTab),
    options,
  };
}

function reverseTabs({
  pattern,
  onTabLevel,
  startOnTab,
  endOnTab,
  options,
}: ExpandedTabsFuncParams): ExpandedTabsFuncParams {
  return {
    pattern: pattern.reverse(),
    onTabLevel,
    startOnTab: endOnTab,
    endOnTab: startOnTab,
    options,
  };
}

class LazySimpleTabsDict<P extends string = never> implements TabsDict<P> {

  static readonly EMPTY = new LazySimpleTabsDict({});

  readonly fit;
  readonly pat;

  protected constructor(
    readonly tt: Readonly<Record<P, ExpandedTabsFuncParams>>,
  ) {
    this.fit = lazyMappedObject(tt, args => reverseTabs(matchingTabs(args)));
    this.pat = lazyMappedObject(tt, ({pattern}) => pattern);
  }

  addTabs(name: P, tabs: ExpandedTabsFuncParams): never;
  addTabs<N extends string>(name: N, tabs: ExpandedTabsFuncParams): LazySimpleTabsDict<P | N>;
  addTabs(name: string, tabs: ExpandedTabsFuncParams) {
    return new LazySimpleTabsDict({...this.tt, [name]: tabs});
  }

}

const ROTATION_DEG = {
  up: 0,
  down: 180,
  right: 90,
  left: -90,
};

/** Rotation of a face, representing the starting direction of the Turtle that draws it. */
export type StartAngleDeg = number | keyof typeof ROTATION_DEG;

function startAngleDeg(startDir?: StartAngleDeg) {
  return startDir === undefined ? 0 :
    typeof startDir === "number" ? startDir : ROTATION_DEG[startDir];
}

export interface ReverseTabsParamsModifier {
  readonly reverse: boolean;
  readonly invert: boolean;
}

/**
 * Rest parameters defining a tab. It consists of full parameters specified directly or as a name
 * of stored tabs, plus modifiers.
 *
 * To reverse the base tabs, specify `{reverse: true}` as a modifier.
 * To invert the base tabs, specify `{invert: true}` as a modifier.
 */
export type RestTabsParams<P> = [
  params: TabsFuncParams | P,
  ...modifiers: readonly (Partial<ExpandedTabsFuncParams & ReverseTabsParamsModifier>)[],
];

export interface PartialTabbedFaceMode {
  /**
   * Whether the TabbedFace commands `*right` and `*left` operate as if on the base level,
   * or on the tab level.
   *
   * The value `"auto"` means that each turn operates on its "inner" side,
   * e.g. when `options.tabsDir` is `"left"`, then right turns operate on base level
   * and left turns operate on tab level.
   */
  turnsOnTabLevel?: boolean | "auto";
  /** The box mode parameters, or `false` if disabled. */
  boxMode?: BoxMode | false;
}

/**
 * Box mode configuration.
 * The box mode allows to easily create e.g. the base (bottom) face of a box
 * in the shape of a [right prism](https://en.wikipedia.org/wiki/Prism_(geometry)).
 * In this mode, on each turn the box correction is applied.
 *
 * Note: In box mode it might be difficult to track the current position of the turtle, as the
 * corrections are applied.
 * Behaviour can also be surprising at times, e.g. `.right(0)` moves the Turtle forward
 * (by the tab width).
 * That's why it is disabled by default.
 * @see {@link boxCorrection}
 */
export interface BoxMode {
  /** The tab width on the edges between the sides of the box perpendicular to the base. */
  readonly verticalEdgesTabWidth: number | "same";
}

export const DEFAULT_MODE = {
  turnsOnTabLevel: "auto",
  boxMode: false,
} satisfies TabbedFaceMode;

interface TabbedFaceMode extends Required<Readonly<PartialTabbedFaceMode>> {}

function modeFromPartial({
  turnsOnTabLevel = DEFAULT_MODE.turnsOnTabLevel,
  boxMode = DEFAULT_MODE.boxMode,
}: PartialTabbedFaceMode = {}): TabbedFaceMode {
  return {turnsOnTabLevel, boxMode};
}

interface CreateArgs {
  startDir?: StartAngleDeg;
  mode?: PartialTabbedFaceMode;
}

/**
 * A helper for creating figures that have tabs on its edges (see _src/interlock.ts_).
 * The class is flexible and allows any elements in addition to the tabs. The class helps
 * with keeping the right kind of corners between the tabbed edges.
 *
 * A TabbedFace is internally a Turtle (more precisely: it is a TurtleFunc), which can do
 * both standard drawing, with the use of `andThenTurtle` and `branchTurtle`, and tabs-related
 * drawing.
 *
 * A tabbed edge is created with the use of one of the `tabs*` methods.
 * Between the tabbed edges, the Turtle is either on the base level, or on the tab level,
 * which is determined automatically, based on the parameters of the previous and the next
 * tabbed edges. For example, if an edge ends with a tab, and the next one starts with a tab,
 * then the fragment between them will be drawn at the tab level. This can be overridden
 * using `startOnTab` and `endOnTab` (or `onTabLevel`) parameters to `tabs`, as well as using the
 * `toTabLevel` and `fromTabLevel` methods.
 *
 * All the methods of TabbedFace like `forward`, `right`, `arcRight`, `roundCornerRight` etc.
 * take into account this duality. They take parameters as if the Turtle was on the base level,
 * but if it is actually on the tab level, they take that into account and e.g. modify the turn
 * radius or add compensation segments.
 *
 * TabbedFace allows also storing named tabs patterns in itself by using the `tabsDef` method.
 * The name can then be used as a parameter to `tabs` to repeat the same edge, or the parameters
 * can be retrieved using `tt`, `fit` or `pat`.
 *
 * An example: two sides of an open box:
 *
 *     // Front of the box, starting with the right edge, going clockwise.
 *     const boxFrontFace = TabbedFace.create(options, {startDir: "down"})
 *       .tabsDef("rightSide", tabsPatternBetweenFrontAndRightSide).right()
 *       .tabsDef("bottom", tabsPatternBetweenFrontAndBottom).right()
 *       // The left side is the same as the right, just reversed.
 *       .tabsDef("leftSide", "rightSide", {reverse: true}).right()
 *       // The top, the same length as bottom but no tabs.
 *       .noTabs("bottom").right()
 *       .closeFace();
 *     // The left side of the box, starting with the front edge, going clockwise.
 *     const boxLeftFace = TabbedFace.create(options, {startDir: "down"})
 *       // Joins the front face. Use `boxFrontFace.fit` to obtain
 *       // the matching tabs, already correctly reversed.
 *       .tabsDef("front", boxFrontFace.fit.leftSide).right()
 *       // For the bottom, use the same pattern as the front uses.
 *       // The `boxFrontFace.tt` returns the unmodified pattern.
 *       .tabsDef("bottom", boxFrontFace.tt.bottom).right()
 *       .tabsDef("back", "front", {reverse: true}).right()
 *       .noTabs("bottom").right()
 *       .closeFace();
 */
export class TabbedFace<P extends string = never>
  extends SimpleLazyPiece implements LazyTurtleFunc, TabsDict<P> {

  private readonly toTabLevelStrafeLeft;

  /** A dictionary of named tabs parameters stored in this face. */
  readonly tt;
  /**
   * A dictionary of tabs parameters matching the named tabs parameters stored in this face.
   * For each `x`, `fit.x` is a reversed version of tabs that match `tt.x`.
   * This means that `fit.x` can be used directly when defining another face that joins with this
   * face on the given edge.
   */
  readonly fit;
  /** A dictionary of just the patterns, `pat.x` is short for `tt.x.pattern`. */
  readonly pat;

  protected constructor(
    readonly startAngle: number,
    readonly mode: TabbedFaceMode,
    readonly options: TabsOptions,
    private readonly segments: readonly Segment[],
    private readonly tabsDict: LazySimpleTabsDict<P>,
  ) {
    super(() => this.asTurtle());
    this.toTabLevelStrafeLeft = options.tabWidth * (options.tabsDir === "left" ? 1 : -1);
    this.tt = tabsDict.tt;
    this.fit = tabsDict.fit;
    this.pat = tabsDict.pat;
  }

  static create(options: PartialTabsOptions, args?: CreateArgs): TabbedFace;
  static create(...params: Parameters<typeof SimpleLazyPiece.create>): never;
  static create(...params: unknown[]) {
    const [options, {
      startDir,
      mode,
    } = {} satisfies CreateArgs] = params as [PartialTabsOptions, CreateArgs?];
    return new TabbedFace(
      startAngleDeg(startDir),
      modeFromPartial(mode),
      tabsOptionsFromPartial(options),
      [],
      LazySimpleTabsDict.EMPTY,
    );
  }

  set({options, mode}: {
    options?: Partial<PartialTabsOptions>,
    mode?: PartialTabbedFaceMode,
  }) {
    return new TabbedFace(
      this.startAngle,
      {...this.mode, ...mode},
      {...this.options, ...options},
      this.segments,
      this.tabsDict,
    );
  }

  with<P2 extends string, Args extends unknown[]>(optionsAndMode: {
    options?: Partial<PartialTabsOptions>,
    mode?: PartialTabbedFaceMode,
  },
    func: PieceFunc<TabbedFace<P>, TabbedFace<P2>, Args>,
    ...args: Args): TabbedFace<P2> {
    return this
      .set(optionsAndMode)
      .andThen(func, ...args)
      .set({
        options: this.options,
        mode: this.mode,
      });
  }

  tabs(...tabsParams: RestTabsParams<P>) {
    const {
      pattern,
      onTabLevel,
      startOnTab = onTabLevel,
      endOnTab = onTabLevel,
      options,
    } = this.expandTabsFuncParams(tabsParams);
    function levelPref(
      declaredOnTab: boolean | "auto" | undefined, tabAtEnd: boolean): LevelPreference {
      return {
        level: toLevel(declaredOnTab === "auto" || declaredOnTab === undefined ?
          tabAtEnd : declaredOnTab),
        required: declaredOnTab !== undefined,
      };
    }
    return this.appendSegment({
      kind: "hop",
      start: levelPref(startOnTab, pattern.startsWithTab()),
      end: levelPref(endOnTab, pattern.endsWithTab()),
      getFunc: (startLevel, endLevel) => t => turtleTabs(this.options)(t, {
        pattern,
        startOnTab: isOnTab(startLevel),
        endOnTab: isOnTab(endLevel),
        options: {
          ...this.options,
          ...options,
        },
      }),
    });
  }

  /** Cannot reuse an existing name. */
  tabsDef(name: P, ...tabsParams: RestTabsParams<P>): never;
  /** Stores the specified tabs definition as the specified name, and draws the tabs. */
  tabsDef<N extends string>(name: N, ...tabsParams: RestTabsParams<P>): TabbedFace<P | N>;
  tabsDef(name: string, ...tabsParams: RestTabsParams<P>) {
    return this.def(name, this.expandTabsFuncParams(tabsParams)).tabs(name);
  }

  /** Cannot reuse an existing name. */
  def(name: P, ...tabsParams: RestTabsParams<P>): never;
  /** Stores the specified tabs definition as the specified name, without drawing them. */
  def<N extends string>(name: N, ...tabsParams: RestTabsParams<P>): TabbedFace<P | N>;
  def(name: string, ...tabsParams: RestTabsParams<P>) {
    return this.appendNamedTabs(name, this.expandTabsFuncParams(tabsParams));
  }

  /**
   * Draws a segment without tabs, as long as the specified tabs, on the specified level
   * (base level by default).
   */
  noTabs(tabsParams: TabsFuncParams | P, {onTabLevel = false} = {}) {
    return this
      .toTabLevel(onTabLevel)
      .forward(this.expandTabsFuncParams([tabsParams]).pattern.length())
      .fromTabLevel(onTabLevel);
  }

  private expandTabsFuncParams(tabsParams: RestTabsParams<P>) {
    const [base, ...modifiers] = tabsParams;
    let params = expandTabsFuncParams(typeof base === "string" ? this.tt[base] : base);
    for (const {reverse, invert, ...modifier} of modifiers) {
      params = {...params, ...modifier};
      if (reverse)
        params = reverseTabs(params);
      if (invert)
        params = matchingTabs(params);
    }
    return params;
  }

  forward(length: number) {
    return this.appendDual(t => t.forward(length));
  }

  back(length: number) {
    return this.forward(-length);
  }

  strafeRight(length: number) {
    return this.appendDual(t => t.strafeRight(length));
  }

  strafeLeft(length: number) {
    return this.strafeRight(-length);
  }

  /**
   * Turns right on the level specified as `mode.turnsOnTabLevel`.
   * Applies the box correction if `mode.box` is set.
   */
  right(angleDeg = 90) {
    const forwardLenMultiplier = Math.tan(angleDeg / 2 / 180 * Math.PI);
    return this.appendDualK(isPositiveAngle(angleDeg), k => {
      const boxCorr = this.boxCorrection(angleDeg);
      if (k && Math.abs(forwardLenMultiplier) >= MAX_FORWARD_LEN_MULTIPLIER_ON_TURN)
        return t => t
          .forward(boxCorr)
          .andThen(this.turnRightOnLevelK(angleDeg, k))
          .forward(boxCorr);
      const fwd = boxCorr + k * this.toTabLevelStrafeLeft * forwardLenMultiplier;
      return t => t
        .forward(fwd)
        .right(angleDeg)
        .forward(fwd);
    });
  }

  left(angleDeg = 90) {
    return this.right(-angleDeg);
  }

  /**
   * Turns right with the specified arc on the level specified as `mode.turnsOnTabLevel`.
   * Applies the box correction if `mode.box` is set.
   */
  arcRight(angleDeg = 90, radius = 0) {
    const boxCorr = this.boxCorrection(angleDeg);
    return this.appendDualK(isPositiveAngle(angleDeg), k =>
      t => t
        .forward(boxCorr)
        .arcRight(angleDeg, radius + k * this.toTabLevelStrafeLeft)
        .forward(boxCorr));
  }

  arcLeft(angleDeg = 90, radius = 0) {
    return this.arcRight(-angleDeg, -radius);
  }

  /**
   * Turns right with a bevel (cut corner) on the level specified as `mode.turnsOnTabLevel`.
   * Applies the box correction if `mode.box` is set.
   */
  bevelRight(angleDeg = 90) {
    const boxCorr = this.boxCorrection(angleDeg);
    return this.appendDualK(isPositiveAngle(angleDeg), k =>
      t => t
        .forward(boxCorr)
        .andThen(t => {
          const res = t.andThen(this.turnRightOnLevelK(angleDeg, k));
          return t.goTo(res.pos).copyAngle(res);
        })
        .forward(boxCorr));
  }

  bevelLeft(angleDeg = 90) {
    return this.bevelRight(-angleDeg);
  }

  /**
   * Turns smooth right, using a Bézier curve, on the level specified as `mode.turnsOnTabLevel`.
   * Applies the box correction if `mode.box` is set.
   */
  smoothRight(
    angleDeg = 90,
    circleR = 0,
    curveArgs?: PartialCurveArgs,
    onTabCurveArgs = curveArgs,
  ) {
    const boxCorr = this.boxCorrection(angleDeg);
    return this.appendDualK(isPositiveAngle(angleDeg), k =>
      t => t
        .forward(boxCorr)
        .smoothRight(
          angleDeg,
          circleR + k * (this.toTabLevelStrafeLeft * Math.tan(angleDeg / 2 / 180 * Math.PI)),
          k ? onTabCurveArgs : curveArgs)
        .forward(boxCorr));
  }

  smoothLeft(
    angleDeg = 90,
    circleR = 0,
    curveArgs?: PartialCurveArgs,
    onTabCurveArgs = curveArgs,
  ) {
    return this.smoothRight(-angleDeg, circleR, curveArgs, onTabCurveArgs);
  }

  roundCornerRight(forward: number, right = forward) {
    return this.appendDualK(true, k =>
      t => t.roundCornerRight(
        forward + k * this.toTabLevelStrafeLeft,
        right + k * this.toTabLevelStrafeLeft));
  }

  roundCornerLeft(forward: number, left = forward) {
    return this.appendDualK(false, k =>
      t => t.roundCornerLeft(
        forward - k * this.toTabLevelStrafeLeft,
        left - k * this.toTabLevelStrafeLeft));
  }

  halfEllipseRight(forward: number, right: number) {
    return this.appendDualK(right > 0, k =>
      t => t.halfEllipseRight(
        forward + (right > 0 ? k : -k) * this.toTabLevelStrafeLeft,
        right + 2 * k * this.toTabLevelStrafeLeft));
  }

  halfEllipseLeft(forward: number, left: number) {
    return this.halfEllipseRight(forward, -left);
  }

  /**
   * Runs the specified TurtleFunc.
   * The function receives the level as an extra parameter.
   * Note that the function is expected to retain the level.
   */
  andThenTurtle<Args extends unknown[]>(
    func: TurtleFuncArg<[...Args, {onTabLevel: boolean}]>, ...args: Args) {
    return this.appendDual(
      t => t.andThen(func, ...args, {onTabLevel: false}),
      t => t.andThen(func, ...args, {onTabLevel: true}),
    );
  }

  /**
   * Executes the TurtleFunc as a branch of the Turtle, starting from the current level.
   * The function receives the level as an extra parameter.
   */
  branchTurtle<Args extends unknown[]>(
    func: TurtleFuncArg<[...Args, {onTabLevel: boolean}]>, ...args: Args): TabbedFace<P>;
  /**
   * Executes the TurtleFunc as a branch of the Turtle, starting from the specified level.
   */
  branchTurtle<Args extends unknown[]>(
    fromTabLevelParam: {fromTabLevel: boolean},
    func: TurtleFuncArg<[...Args, {onTabLevel: boolean}]>, ...args: Args): TabbedFace<P>;
  branchTurtle<Args extends unknown[]>(...params:
    | [TurtleFuncArg<[...Args, {onTabLevel: boolean}]>, ...Args]
    | [{fromTabLevel: boolean}, TurtleFuncArg<[...Args, {onTabLevel: boolean}]>, ...Args]) {
    function hasFromTabLevel(params:
      | [TurtleFuncArg<[...Args, {onTabLevel: boolean}]>, ...Args]
      | [{fromTabLevel: boolean}, TurtleFuncArg<[...Args, {onTabLevel: boolean}]>, ...Args]):
      params is
      [{fromTabLevel: boolean}, TurtleFuncArg<[...Args, {onTabLevel: boolean}]>, ...Args] {
      return typeof params[0] !== "function";
    }
    const [{fromTabLevel = undefined}, func, ...args] = hasFromTabLevel(params) ?
      params : [{}, ...params];
    return this.appendDual(
      t => t.branch(t =>
        (fromTabLevel === true ? t.withPenUp(this.strafeToTab()) : t)
          .andThen(func, ...args, {onTabLevel: fromTabLevel ?? false})
      ),
      t => t.branch(t =>
        (fromTabLevel === false ? t.withPenUp(this.strafeToTab(-1)) : t)
          .andThen(func, ...args, {onTabLevel: fromTabLevel ?? true})
      ),
    );
  }

  /** Forces the Turtle to move to the specified level. */
  toTabLevel(tabLevel = true) {
    const level = toLevel(tabLevel);
    return this.appendSegment({
      kind: "hop",
      start: {level},
      end: {level, required: true},
      getFunc: (start, _end) => level === start ?
        IDENTITY_FUNC : this.strafeToTab(tabLevel ? 1 : -1),
    });
  }

  toBaseLevel(baseLevel = true) {
    return this.toTabLevel(!baseLevel);
  }

  /** Forces the previous fragment to be on the specified level. */
  fromTabLevel(tabLevel = true) {
    const level = toLevel(tabLevel);
    return this.appendSegment({
      kind: "hop",
      start: {level, required: true},
      end: {level},
      getFunc: (_start, end) => level === end ? IDENTITY_FUNC : this.strafeToTab(tabLevel ? -1 : 1),
    });
  }

  fromBaseLevel(baseLevel = true) {
    return this.fromTabLevel(!baseLevel);
  }

  forceOnTabLevel(tabLevel = true) {
    const level = toLevel(tabLevel);
    return this.appendSegment({
      kind: "hop",
      start: {level},
      end: {level, required: true},
      getFunc: (_start, _end) => IDENTITY_FUNC,
    });
  }

  forceOnBaseLevel(baseLevel = true) {
    return this.forceOnTabLevel(!baseLevel);
  }

  private strafeToTab(toTabMult = 1): TurtleFunc {
    return t => t.strafeLeft(toTabMult * this.toTabLevelStrafeLeft);
  }

  private turnRightOnLevelK(angleDeg: number, levelK: number): TurtleFunc {
    return t => t
      .andThen(this.strafeToTab(-levelK))
      .right(angleDeg)
      .andThen(this.strafeToTab(levelK));
  }

  private boxCorrection(angleDeg: number) {
    if (!this.mode.boxMode)
      return 0;
    const vTabWidth = this.mode.boxMode.verticalEdgesTabWidth;
    return boxCorrection({
      angleDeg,
      tabWidth: vTabWidth === "same" ? this.options.tabWidth : vTabWidth,
    });
  }

  private appendDualK(rightTurn: boolean, getFunc: (k: number) => TurtleFunc) {
    const onTabLevel = this.mode.turnsOnTabLevel === "auto" ?
      rightTurn !== (this.options.tabsDir === "left") :
      this.mode.turnsOnTabLevel;
    if (onTabLevel)
      return this.appendDual(getFunc(-1), getFunc(0));
    return this.appendDual(getFunc(0), getFunc(1));
  }

  private appendDual(baseFunc: TurtleFunc, tabFunc = baseFunc) {
    return this.appendSegment({
      kind: "dual",
      getFunc: level => level === Level.TAB ? tabFunc : baseFunc,
    });
  }

  private appendSegment(segment: Segment) {
    if (segment.kind === "hop" && segment.start?.required) {
      const lastHopSegm = this.segments.findLast(isHopSegment);
      if (lastHopSegm)
        getPointLevel(lastHopSegm.end, segment.start);
    }
    return new TabbedFace(this.startAngle, this.mode, this.options,
      [...this.segments, segment], this.tabsDict);
  }

  private appendNamedTabs(name: string, tabsParams: ExpandedTabsFuncParams) {
    return new TabbedFace(this.startAngle, this.mode, this.options,
      this.segments, this.tabsDict.addTabs(name, tabsParams));
  }

  /**
   * Closes the face:
   * - Determines the correct level of the transition between the end of the face and its beginning.
   * - Verifies that the Turtle is back at the starting position with the given tolerance,
   *   and the starting angle (unless `allowOpen` is specified).
   * - If `closePath` is specified, uses `Turtle.closePath()`.
   * - Creates an object representing the complete face, and retaining all the stored tabs,
   *   for use when defining other faces.
   *   Note that calling any function, e.g. `center` on the result, will not retain the named tabs.
   *
   * It is recommended to always call `closeFace` when a face is fully defined.
   */
  closeFace({closePath = false, allowOpen = closePath, posTolerance = 1e-9}: {
    closePath?: boolean,
    allowOpen?: boolean,
    posTolerance?: number,
  } = {}) {
    let closed;
    const firstHopSegm = this.segments.find(isHopSegment);
    if (firstHopSegm) {
      const closeLevel = getPointLevel(
        this.segments.findLast(isHopSegment)?.end, firstHopSegm.start);
      const closeLevelPref = {level: closeLevel, required: true};
      const closingSegment: Segment = {
        kind: "hop",
        start: closeLevelPref,
        end: closeLevelPref,
        getFunc: () => IDENTITY_FUNC,
      };
      closed = new TabbedFace(
        this.startAngle,
        this.mode,
        this.options,
        [closingSegment, ...this.segments, closingSegment],
        this.tabsDict,
      );
    } else
      closed = this;
    const turtle = closed.asTurtle();
    if (!allowOpen)
      checkFaceClosed(this.startAngle, turtle, posTolerance);
    const path = closePath ? turtle.closePath() : turtle.asPath();
    return ClosedFace.create(turtle, path, this.tabsDict);
  }

  private joinFunctions() {
    let prevHopSegm: HopSegment | undefined;
    let nextHopSegm: HopSegment | undefined = this.segments.find(isHopSegment);
    const startLevel = getPointLevel(undefined, nextHopSegm?.start);
    let pointLevel = startLevel;
    const funcs: TurtleFunc[] = [];
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      if (segment.kind === "hop") {
        const startLevel = pointLevel;
        prevHopSegm = segment;
        nextHopSegm = this.segments.slice(i + 1).find(isHopSegment);
        pointLevel = getPointLevel(prevHopSegm.end, nextHopSegm?.start);
        funcs.push(segment.getFunc(startLevel, pointLevel));
      } else
        funcs.push(segment.getFunc(pointLevel));
    }
    const func: TurtleFunc = t => {
      for (const func of funcs)
        t = func(t);
      return t;
    };
    return {
      func,
      startLevel,
      endLevel: pointLevel,
    };
  }

  /**
   * TabbedFace can be used directly as a TurtleFunc.
   * Note that the start angle is ignored in that case.
   */
  getFunc(): TurtleFunc {
    return this.joinFunctions().func;
  }

  /**
   * Returns a Turtle that draws the tabbed face. The start direction of the turtle is
   * as specified. The point `[0, 0]` is on the base level at the beginning of the path.
   */
  asTurtle() {
    const {func, startLevel, endLevel} = this.joinFunctions();
    let t = Turtle.create().setAngle(this.startAngle ?? 0);
    if (startLevel === Level.TAB)
      t = t.withPenUp(this.strafeToTab());
    t = t.andThen(func);
    if (endLevel === Level.TAB)
      t = t.withPenUp(this.strafeToTab(-1));
    return t;
  }

  asPath() {
    return this.asTurtle().asPath();
  }

}

export class TabbedFaceCreator {

  protected constructor(readonly options: TabsOptions) {}

  static create(options: PartialTabsOptions) {
    return new TabbedFaceCreator(tabsOptionsFromPartial(options));
  }

  create(args?: CreateArgs) {
    return TabbedFace.create(this.options, args);
  }

}

function checkFaceClosed(
  startDir: number,
  {pos: [x, y], angleDeg}: Turtle,
  posTolerance: number,
) {
  const norm = (v: number, tolerance?: number) => almostEqual(v, 0, {tolerance}) ? 0 : v;
  const angleToRange = (a: number) => (a % 360 + 360 + 180) % 360 - 180;
  startDir = angleToRange(startDir);
  x = norm(x, posTolerance);
  y = norm(y, posTolerance);
  angleDeg = norm(angleToRange(angleDeg));
  if (x !== 0 || y !== 0 || norm(angleToRange(angleDeg - startDir)) !== 0)
    throw new Error(`The face shape is not closed properly: ` +
      `angleDeg=${angleDeg} (expected: ${startDir}), pos=[${x}, ${y}] (expected: [0, 0]` +
      `${posTolerance ? ` with tolerance ${posTolerance}` : ``})`);
}

export class ClosedFace<P extends string = never> extends DefaultPiece implements TabsDict<P> {

  readonly tt;
  readonly fit;
  readonly pat;

  protected constructor(
    private readonly turtle: Turtle,
    face: Piece,
    tabsDict: LazySimpleTabsDict<P>,
  ) {
    super(face);
    this.tt = tabsDict.tt;
    this.fit = tabsDict.fit;
    this.pat = tabsDict.pat;
  }

  static create<P extends string>(turtle: Turtle, face: Piece, tabsDict: LazySimpleTabsDict<P>): ClosedFace<P>;
  static create(...params: Parameters<typeof DefaultPiece.create>): never;
  static create<P extends string>(...params: unknown[]) {
    const [turtle, face, tabsDict] = params as [Turtle, Piece, LazySimpleTabsDict<P>];
    return new ClosedFace(turtle, face, tabsDict);
  }

  asTurtle() {
    return this.turtle;
  }

}

export function turtleInterlock(options: PartialInterlockOptions) {
  const res = origTurtleInterlock(options);
  return {
    ...res,
    TFace: TabbedFaceCreator.create(res.tabsOptions),
  };
}

/**
 * Returns the size correction for tabbed faces that meet at an obtuse angle.
 * The angle is specified as exterior angle.
 *
 * Imagine two faces, each of them a square 1×1, with tabs protruding from one of the edges
 * (the other faces being flat).
 * The tabs on the two faces match, so that the squares can be joined with them.
 * Imagine the two faces are vertical, joined by a vertical edge at an obtuse angle
 * (i.e. acute exterior angle). Consider the shape formed by the two faces when they are
 * looked on from above, and in particular, the shape of the inner side of the angle they form.
 * The length of each of the two legs of that shape is slightly longer than 1,
 * because it also includes part of the distance at which the tabs interlock.
 * If we denote the length of each leg as _1+c_, this function returns _c_.
 *
 * When the two faces lie on a surface (exterior angle of zero), the tabs interlock completely,
 * and their total length becomes `1 + tabWidth + 1`, thus `tabWidth / 2` is returned.
 * This value falls to zero as the angle approaches 90°.
 */
export function boxCorrection({angleDeg, tabWidth}: {
  angleDeg: number,
  tabWidth: number,
}) {
  const posCos = Math.max(sinCos(angleDeg)[1], 0);
  return tabWidth * posCos / (1 + posCos);
}

/**
 * Given the typically used tab width and an (exterior) angle between two faces,
 * returns the tab width that should be used to join them. When the faces meet at an obtuse
 * or right angle (exterior angle up to 90°), the original tab width is returned.
 * For acute angles, a larger value is returned to ensure that the tabs of the faces
 * overlap sufficiently.
 */
export function tabWidthForAcuteAngle({angleDeg, tabWidth}: {
  angleDeg: number,
  tabWidth: number,
}) {
  const [sin, cos] = sinCos(angleDeg);
  if (cos >= 0)
    return tabWidth;
  return tabWidth / Math.abs(sin);
}

/** Returns whether the angle is equivalent to an angle between 0° and 180°. */
export function isPositiveAngle(angleDeg: number) {
  return sinCos(angleDeg)[0] > 0;
}
