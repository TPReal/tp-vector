import {PartialInterlockOptions, PartialTabsOptions, TabsOptions, TurtleTabsFunc, turtleInterlock as origTurtleInterlock, tabsOptionsFromPartial, turtleTabs} from './interlock.ts';
import {TabsPattern} from './interlock_patterns.ts';
import {SimpleLazyPiece} from './lazy_piece.ts';
import {DefaultPiece, Piece, PieceFunc} from './pieces.ts';
import {LazyTurtleFunc, PartialCurveArgs, Turtle, TurtleFunc, TurtleFuncArg} from './turtle.ts';
import {almostEqual} from './util.ts';

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

function bInv(b: boolean | undefined) {
  return b === undefined ? undefined : !b;
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

class LazySimpleTabsDict<P extends string = never> implements TabsDict<P>{

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

const ROTATION = {
  up: 0,
  down: 180,
  right: 90,
  left: -90,
};

/** Rotation of a face, representing the starting direction of the Turtle that draws it. */
export type StartAngleDeg = number | keyof typeof ROTATION;

function startAngleDeg(startDir?: StartAngleDeg) {
  return startDir === undefined ? undefined :
    typeof startDir === "number" ? startDir :
      ROTATION[startDir];
}

export interface ReverseTabsParamsModifier {
  reverse: boolean;
}

/**
 * Rest parameters defining a tab. It consists of full parameters specified directly or as a name
 * of stored tabs, plus modifiers.
 *
 * To reverse the base tabs, specify `{reverse: true}` as a modifier.
 */
export type RestTabsParams<P> = [
  params: TabsFuncParams | P,
  ...modifiers: (Partial<ExpandedTabsFuncParams & ReverseTabsParamsModifier>)[],
];

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
 *     const boxFrontFace = TabbedFace.create(options, "down")
 *       .tabsDef("rightSide", tabsPatternBetweenFrontAndRightSide).right()
 *       .tabsDef("bottom", tabsPatternBetweenFrontAndBottom).right()
 *       // The left side is the same as the right, just reversed.
 *       .tabsDef("leftSide", "rightSide", {reverse: true}).right()
 *       // The top, the same length as bottom but no tabs.
 *       .noTabs("bottom").right()
 *       .closeFace();
 *     // The left side of the box, starting with the front edge, going clockwise.
 *     const boxLeftFace = TabbedFace.create(options, "down")
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
    readonly options: TabsOptions,
    private readonly segments: Segment[],
    private readonly tabsDict: LazySimpleTabsDict<P>,
    private readonly startDir: number | undefined,
  ) {
    super(() => this.asTurtle());
    this.toTabLevelStrafeLeft = options.tabWidth * (options.tabsDir === "left" ? 1 : -1);
    this.tt = tabsDict.tt;
    this.fit = tabsDict.fit;
    this.pat = tabsDict.pat;
  }

  static create(options: PartialTabsOptions, startDir?: StartAngleDeg): TabbedFace;
  static create(...params: unknown[]): never;
  static create(options: PartialTabsOptions, startDir?: StartAngleDeg) {
    return new TabbedFace(
      tabsOptionsFromPartial(options), [], LazySimpleTabsDict.EMPTY, startAngleDeg(startDir));
  }

  setOptions(options: Partial<PartialTabsOptions>) {
    return new TabbedFace(
      {...this.options, ...options}, this.segments, this.tabsDict, this.startDir);
  }

  withOptions<P2 extends string>(
    options: Partial<PartialTabsOptions>, func: PieceFunc<TabbedFace<P>, TabbedFace<P2>>):
    TabbedFace<P2> {
    return this.setOptions(options).andThen(func).setOptions(this.options);
  }

  tabs(...tabsParams: RestTabsParams<P>) {
    const {
      pattern,
      onTabLevel,
      startOnTab = onTabLevel,
      endOnTab = onTabLevel,
      options,
    } = this.expandTabsFuncParams(tabsParams);
    function levelPref(declaredOnTab: boolean | undefined, tabAtEnd: boolean): LevelPreference {
      return {
        level: toLevel(declaredOnTab ?? tabAtEnd),
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
    const expanded = this.expandTabsFuncParams(tabsParams);
    return this.tabs(expanded).appendNamedTabs(name, expanded);
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
    for (const {reverse, ...modifier} of modifiers) {
      params = {...params, ...modifier};
      if (reverse)
        params = reverseTabs(params);
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

  /** Turns right. If on tab level, adds the correct forward segments before and after the turn. */
  right(angleDeg = 90) {
    const forwardLenMultiplier = Math.tan(angleDeg / 2 / 180 * Math.PI);
    const forwardLen = this.toTabLevelStrafeLeft * forwardLenMultiplier;
    return this.appendDual(
      t => t.right(angleDeg),
      Math.abs(forwardLenMultiplier) < MAX_FORWARD_LEN_MULTIPLIER_ON_TURN ?
        t => t.forward(forwardLen).right(angleDeg).forward(forwardLen) :
        t => t.withPenUp(this.turnRightOnTabLevel(angleDeg)),
    );
  }

  left(angleDeg = 90) {
    return this.right(-angleDeg);
  }

  /**
   * Turns right with an arc. Adjusts the radius when on tab level.
   * Note that `arcRight()` can be called without parameters, which is the same as `right()`
   * on base level, and draws a quarter of a circle on the tab level.
   */
  arcRight(angleDeg = 90, radius = 0) {
    return this.appendDual(
      t => t.arcRight(angleDeg, radius),
      t => t.arcRight(angleDeg, radius + this.toTabLevelStrafeLeft),
    );
  }

  arcLeft(angleDeg = 90, radius = 0) {
    return this.arcRight(-angleDeg, -radius);
  }

  /**
   * Turns right with a bevel, i.e. when on tab level, it draws a straight line to the target
   * position.
   */
  bevelRight(angleDeg = 90) {
    return this.appendDual(
      t => t.right(angleDeg),
      t => {
        const res = t.andThen(this.turnRightOnTabLevel(angleDeg));
        return t.goTo(res.pos).copyAngle(res);
      },
    );
  }

  bevelLeft(angleDeg = 90) {
    return this.bevelRight(-angleDeg);
  }

  /**
   * Turns smooth right, using a Bézier curve.
   *
   * Curve args can be specified, with an option to specify them separately for the tab level.
   *
   * Note that `smoothRight()` can be called without parameters, which is the same as `right()`
   * on base level, and draws a curve on the tab level.
   */
  smoothRight(
    angleDeg = 90,
    circleR = 0,
    curveArgs?: PartialCurveArgs,
    onTabCurveArgs = curveArgs,
  ) {
    return this.appendDual(
      t => t.smoothRight(angleDeg, circleR, curveArgs),
      t => t.smoothRight(
        angleDeg,
        circleR + this.toTabLevelStrafeLeft * Math.tan(angleDeg / 2 / 180 * Math.PI),
        onTabCurveArgs,
      ),
    );
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
    return this.appendDual(
      t => t.roundCornerRight(forward, right),
      t => t.roundCornerRight(
        forward + this.toTabLevelStrafeLeft, right + this.toTabLevelStrafeLeft),
    );
  }

  roundCornerLeft(forward: number, left = forward) {
    return this.appendDual(
      t => t.roundCornerLeft(forward, left),
      t => t.roundCornerLeft(
        forward - this.toTabLevelStrafeLeft, left - this.toTabLevelStrafeLeft),
    );
  }

  halfEllipseRight(forward: number, right: number) {
    return this.appendDual(
      t => t.halfEllipseRight(forward, right),
      t => t.halfEllipseRight(
        forward + this.toTabLevelStrafeLeft, right + 2 * this.toTabLevelStrafeLeft),
    );
  }

  halfEllipseLeft(forward: number, left: number) {
    return this.appendDual(
      t => t.halfEllipseLeft(forward, left),
      t => t.halfEllipseLeft(
        forward - this.toTabLevelStrafeLeft, left - 2 * this.toTabLevelStrafeLeft),
    );
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
   * Executes the TurtleFunc as a branch of the Turtle.
   * The function receives the level as an extra parameter.
   */
  branchTurtle<Args extends unknown[]>(
    func: TurtleFuncArg<[...Args, {onTabLevel: boolean}]>, ...args: Args): TabbedFace<P>;
  /**
   * Executes the TurtleFunc as a branch of the Turtle, starting at the specified level.
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
        (fromTabLevel === false ? t.withPenUp(this.strafeToTab(false)) : t)
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
      getFunc: (start, _end) => level === start ? IDENTITY_FUNC : this.strafeToTab(tabLevel),
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
      getFunc: (_start, end) => level === end ? IDENTITY_FUNC : this.strafeToTab(!tabLevel),
    });
  }

  fromBaseLevel(baseLevel = true) {
    return this.fromTabLevel(!baseLevel);
  }

  private strafeToTab(toTab = true): TurtleFunc {
    return t => t.strafeLeft((toTab ? 1 : -1) * this.toTabLevelStrafeLeft);
  }

  private turnRightOnTabLevel(angleDeg: number): TurtleFunc {
    return t => t
      .andThen(this.strafeToTab(false))
      .right(angleDeg)
      .andThen(this.strafeToTab());
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
    return new TabbedFace(
      this.options, [...this.segments, segment], this.tabsDict, this.startDir);
  }

  private appendNamedTabs(name: string, tabsParams: ExpandedTabsFuncParams) {
    return new TabbedFace(
      this.options, this.segments, this.tabsDict.addTabs(name, tabsParams), this.startDir);
  }

  /**
   * Closes the face:
   * - Determines the correct level of the transition between the end of the face and its beginning.
   * - Verifies that the Turtle is back at the starting position (unless `allowOpen` is specified).
   * - If `closePath` is specified, uses `Turtle.closePath()`.
   * - Creates an object representing the complete face, and retaining all the stored tabs,
   *   for use when defining other faces.
   *   Note that calling any function, e.g. `center` on the result, will not retain the named tabs.
   *
   * It is recommended to always call `closeFace` when a face is fully defined.
   */
  closeFace({closePath = false, allowOpen = closePath}: {
    closePath?: boolean,
    allowOpen?: boolean,
  } = {}) {
    let closed;
    const firstHopSegm = this.segments.find((segm): segm is HopSegment => segm.kind === "hop");
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
        this.options,
        [closingSegment, ...this.segments, closingSegment],
        this.tabsDict,
        this.startDir);
    } else
      closed = this;
    const turtle = closed.asTurtle();
    if (!allowOpen)
      checkFaceClosed(this.startDir ?? 0, turtle);
    const path = closePath ? turtle.closePath() : turtle.asPath();
    return ClosedFace.create(path, this.tabsDict);
  }

  /**
   * TabbedFace can be used directly as a TurtleFunc.
   * Note that the rotation is ignored in that case.
   */
  getFunc(): TurtleFunc {
    return t => {
      let prevHopSegm: HopSegment | undefined;
      let nextHopSegm: HopSegment | undefined = this.segments.find(isHopSegment);
      let pointLevel = getPointLevel(prevHopSegm?.end, nextHopSegm?.start);
      if (pointLevel === Level.TAB)
        t = t.withPenUp(this.strafeToTab());
      for (let i = 0; i < this.segments.length; i++) {
        const segment = this.segments[i];
        if (segment.kind === "hop") {
          const startLevel = pointLevel;
          prevHopSegm = segment;
          nextHopSegm = this.segments.slice(i + 1).find(isHopSegment);
          pointLevel = getPointLevel(prevHopSegm.end, nextHopSegm?.start);
          t = t.andThen(segment.getFunc(startLevel, pointLevel));
        } else
          t = t.andThen(segment.getFunc(pointLevel));
      }
      if (pointLevel === Level.TAB)
        t = t.withPenUp(this.strafeToTab(false));
      return t;
    };
  }

  asTurtle() {
    return Turtle.create().setAngle(this.startDir ?? 0).andThen(this);
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

  create(startDir?: StartAngleDeg) {
    return TabbedFace.create(this.options, startDir);
  }

}

function checkFaceClosed(startDir: number, {pos: [x, y], angleDeg}: Turtle) {
  const norm = (v: number) => almostEqual(v, 0) ? 0 : v;
  const angleToRange = (a: number) => (a % 360 + 360 + 180) % 360 - 180;
  startDir = angleToRange(startDir);
  x = norm(x);
  y = norm(y);
  angleDeg = norm(angleToRange(angleDeg));
  if (x !== 0 || y !== 0 || norm(angleToRange(angleDeg - startDir)) !== 0)
    throw new Error(`The face shape is not closed properly: ` +
      `angleDeg=${angleDeg} (expected: ${startDir}), pos=[${x}, ${y}] (expected: [0, 0])`);
}

export class ClosedFace<P extends string = never> extends DefaultPiece implements TabsDict<P>{

  readonly tt;
  readonly fit;
  readonly pat;

  protected constructor(face: Piece, tabsDict: LazySimpleTabsDict<P>) {
    super(face);
    this.tt = tabsDict.tt;
    this.fit = tabsDict.fit;
    this.pat = tabsDict.pat;
  }

  static create<P extends string>(face: Piece, tabsDict: LazySimpleTabsDict<P>): ClosedFace<P>;
  static create(...params: unknown[]): never;
  static create<P extends string>(face: Piece, tabsDict: LazySimpleTabsDict<P>) {
    return new ClosedFace(face, tabsDict);
  }

}

export function turtleInterlock(options: PartialInterlockOptions) {
  const res = origTurtleInterlock(options);
  return {
    ...res,
    TFace: TabbedFaceCreator.create(res.tabsOptions),
  };
}
