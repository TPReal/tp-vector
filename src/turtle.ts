import {Path} from './path.ts';
import {DefaultPiece, LazyPieceFunc, PieceFunc, PieceFuncArg} from './pieces.ts';
import {Point} from './point.ts';
import {Tf} from './transform.ts';
import {assert} from './util.ts';

interface State {
  readonly pos: Point;
  readonly angleDeg: number;
  readonly down: boolean;
}

function sinCos(angleDeg: number) {
  const angleRad = angleDeg / 180 * Math.PI;
  return [Math.sin(angleRad), Math.cos(angleRad)];
}

/**
 * Quadratic Bézier curve parameters - There are none to configure for the quadratic curve.
 * @see {@link Turtle.curveTo}
 */
export type QuadraticCurveArgs = "quad";

/**
 * Speed, used to determine the control points of a cubic Bézier curve.
 * @see {@link Turtle.curveTo}
*/
export type ControlPointSpeed = number | "auto";

/**
 * Parameters of a cubic Bézier curve.
 * @see {@link Turtle.curveTo}
 */
export interface PartialCubicCurveArgs {
  /** The default for start and target speed, defaults to `"auto"`. */
  speed?: ControlPointSpeed;
  startSpeed?: ControlPointSpeed;
  targetSpeed?: ControlPointSpeed;
}
/** Parameters of a quadratic or cubic Bézier curve. */
export type PartialCurveArgs = QuadraticCurveArgs | PartialCubicCurveArgs;

type Stack = readonly Partial<State>[];
type StackKey = string | number | undefined;
type Stacks = ReadonlyMap<StackKey, Stack>;

const DEFAULT_STACK_KEY: StackKey = undefined;

function isStackKey(value: StackKey | {}): value is StackKey {
  return value === DEFAULT_STACK_KEY || typeof value === "string" || typeof value === "number";
}

export interface TurtleFunc<Args extends unknown[] = []>
  extends PieceFunc<Turtle, Turtle, Args> {}

export interface LazyTurtleFunc<Args extends unknown[] = []>
  extends LazyPieceFunc<Turtle, Turtle, Args> {}

export type TurtleFuncArg<Args extends unknown[] = []> =
  PieceFuncArg<Turtle, Turtle, Args>;

/**
 * A tool for creating [turtle graphics](https://en.wikipedia.org/wiki/Turtle_graphics).
 * A single Turtle creates a single `<path>` element.
 *
 * Note that the Turtle class is immutable, so all the drawing methods and setters return
 * a new instance of Turtle - a copy of the original Turtle with the desired changes.
 *
 * See _docs/immutability.md_
 */
export class Turtle extends DefaultPiece {

  protected constructor(
    private readonly path: Path,
    private readonly state: State,
    private readonly stacks: Stacks,
  ) {
    super(path);
  }

  static create(start?: Point): Turtle;
  static create(...args: unknown[]): never;
  static create(start: Point = [0, 0]) {
    return new Turtle(Path.create(start), {pos: start, angleDeg: 0, down: true}, new Map());
  }

  get pos() {return this.state.pos;}
  /** The angle in degrees, measured clockwise from the up direction. */
  get angleDeg() {return this.state.angleDeg;}
  get isPenDown() {return this.state.down;}

  asPath() {
    return this.path;
  }

  /** A transform representing the Turtle's position and angle. */
  asTransform() {
    return Tf.rotateRight(this.angleDeg).translate(...this.pos);
  }

  private append({
    path = this.path,
    dAngleDeg = 0,
    angleDeg = this.angleDeg + dAngleDeg,
    down = this.isPenDown,
    stackKey,
    stack,
    stacks = stack ? new Map(this.stacks).set(stackKey, stack) : this.stacks,
  }: {
    path?: Path,
    dAngleDeg?: number,
    angleDeg?: number,
    down?: boolean,
    stackKey?: StackKey,
    stack?: Stack,
    stacks?: Stacks,
  }) {
    return new Turtle(path, {...this.state, angleDeg, down}, stacks);
  }

  private appendJump({
    dPos,
    pos = dPos ? [this.pos[0] + dPos[0], this.pos[1] + dPos[1]] : undefined,
    dAngleDeg = 0,
    angleDeg = this.angleDeg + dAngleDeg,
  }: {
    dPos?: Point,
    pos?: Point,
    dAngleDeg?: number,
    angleDeg?: number,
  }) {
    return new Turtle(
      pos ? this.path.moveTo(pos) : this.path,
      {...this.state, ...pos ? {pos} : {}, angleDeg},
      this.stacks);
  }

  private appendDraw({
    pathIfDown,
    dPos = [0, 0],
    pos = [this.pos[0] + dPos[0], this.pos[1] + dPos[1]],
    dAngleDeg = 0,
    angleDeg = this.angleDeg + dAngleDeg,
  }: {
    pathIfDown: Path,
    dPos?: Point,
    pos?: Point,
    dAngleDeg?: number,
    angleDeg?: number,
  }) {
    if (!this.isPenDown)
      return this.appendJump({pos, angleDeg});
    return new Turtle(pathIfDown, {...this.state, pos, angleDeg}, this.stacks);
  }

  private appendState({pos, angleDeg, down}: Partial<State>) {
    let result: Turtle = this;
    if (pos)
      result = result.appendJump({pos});
    return result.append({angleDeg, down});
  }

  private pushInternal(stackKey: StackKey, state: Partial<State>) {
    return this.append({stackKey, stack: [...this.stacks.get(stackKey) || [], state]});
  }

  /** Adds the current state (position, angle and pen being up or down) to the specified stack. */
  push(stackKey = DEFAULT_STACK_KEY) {
    return this.pushInternal(stackKey, this.state);
  }

  /** Pushes the current position (but not angle) to the specified stack. */
  pushPos(stackKey = DEFAULT_STACK_KEY) {
    return this.pushInternal(stackKey, {pos: this.pos});
  }

  /** Pushes the current angle to the specified stack. */
  pushAngle(stackKey = DEFAULT_STACK_KEY) {
    return this.pushInternal(stackKey, {angleDeg: this.angleDeg});
  }

  /** Pushes the current position and angle to the specified stack. */
  pushPosAndAngle(stackKey = DEFAULT_STACK_KEY) {
    return this.pushInternal(stackKey, {pos: this.pos, angleDeg: this.angleDeg});
  }

  /** Pushes the current pen state to the specified stack. */
  pushPen(stackKey = DEFAULT_STACK_KEY) {
    return this.pushInternal(stackKey, {down: this.isPenDown});
  }

  getStackSize(stackKey = DEFAULT_STACK_KEY) {
    const stack = this.stacks.get(stackKey);
    return stack ? stack.length : 0;
  }

  getStackKeys() {
    return [...this.stacks.keys()];
  }

  isStackEmpty(stackKey = DEFAULT_STACK_KEY) {
    return this.getStackSize(stackKey) === 0;
  }

  /**
   * Loads the state saved in the specified stack, without popping it.
   * This does not modify the drawn path.
   */
  peek(stackKey = DEFAULT_STACK_KEY) {
    const stack = this.stacks.get(stackKey);
    if (!stack || !stack.length)
      throw new Error(`Stack ${JSON.stringify(stackKey ?? "default")} is empty.`);
    return this.appendState(assert(stack.at(-1)));
  }

  /**
   * Pops the state saved in the specified stack and loads it.
   * This does not modify the drawn path.
   */
  pop(stackKey = DEFAULT_STACK_KEY) {
    return this.peek(stackKey).append({
      stackKey,
      stack: assert(this.stacks.get(stackKey)).slice(0, -1),
    });
  }

  /**
   * Executes the TurtleFunc and then restores the state from before the execution.
   * This is similar to:
   *
   *     .push().andThen(func, ...args).pop()
   */
  branch<Args extends unknown[]>(func: TurtleFuncArg<Args>, ...args: Args) {
    return this.andThen(func, ...args).appendState(this.state);
  }

  /** Executes the function in a loop, each time in a separate branch. */
  branches<Args extends unknown[]>(
    count: number,
    func: TurtleFuncArg<[...args: Args, index: number, count: number]>,
    ...args: Args
  ): Turtle;
  /** Executes the function in a loop, each time in a separate branch. */
  branches<Args extends unknown[], E>(
    elements: E[],
    func: TurtleFuncArg<[...args: Args, element: E, index: number, elements: E[]]>,
    ...args: Args
  ): Turtle;
  branches<Args extends unknown[], E, Iter extends Iterable<E>>(
    // deno-lint-ignore no-explicit-any
    ...[countOrIterable, func, ...args]: any) {
    return this.repeat(
      // deno-lint-ignore no-explicit-any
      countOrIterable as any,
      // deno-lint-ignore no-explicit-any
      (t, ...fullArgs) => t.branch(func as any, ...fullArgs),
      ...args,
    );
  }

  /** Executes the function in a loop, each time passing the result of the previous call. */
  repeat<Args extends unknown[]>(
    count: number,
    func: TurtleFuncArg<[...args: Args, index: number, count: number]>,
    ...args: Args
  ): Turtle;
  /** Executes the function in a loop, each time passing the result of the previous call. */
  repeat<Args extends unknown[], E>(
    elements: E[],
    func: TurtleFuncArg<[...args: Args, element: E, index: number, elements: E[]]>,
    ...args: Args
  ): Turtle;
  repeat<Args extends unknown[], E, Iter extends Iterable<E>>(...params: [
    number,
    TurtleFuncArg<[...args: Args, index: number, count: number]>,
    ...Args,
  ] | [
    E[],
    TurtleFuncArg<[...args: Args, element: E, index: number, array: E[]]>,
    ...Args,
  ]) {
    function isCountParams(params: [
      number,
      TurtleFuncArg<[...args: Args, index: number, count: number]>,
      ...Args,
    ] | [
      E[],
      TurtleFuncArg<[...args: Args, element: E, index: number, array: E[]]>,
      ...Args,
    ]): params is [
      number,
      TurtleFuncArg<[...args: Args, index: number, count: number]>,
      ...Args,
    ] {
      return typeof params[0] === "number";
    }
    let t: Turtle = this;
    if (isCountParams(params)) {
      const [count, func, ...args] = params;
      for (let i = 0; i < count; i++)
        t = t.andThen(func, ...args, i, count);
    } else {
      const [iterable, func, ...args] = params;
      let index = 0;
      for (const element of iterable)
        t = t.andThen(func, ...args, element, index++, iterable);
    }
    return t;
  }

  /** Copies the state (position, angle and pen state) from the specified Turtle. */
  copy(t: Turtle) {return this.appendState(t.state);}
  /** Copies the position from the specified Turtle. Does not copy the angle. */
  copyPos(t: Turtle) {return this.appendState({pos: t.pos});}
  /** Copies the angle from the specified Turtle. */
  copyAngle(t: Turtle) {return this.appendState({angleDeg: t.angleDeg});}
  /** Copies the position and angle from the specified Turtle. */
  copyPosAndAngle(t: Turtle) {return this.appendState({pos: t.pos, angleDeg: t.angleDeg});}
  /** Copies the pen state from the specified Turtle. */
  copyPen(t: Turtle) {return this.appendState({down: t.isPenDown});}

  /** Clears the path drawn by the Turtle, without changing its state. */
  dropPath() {
    return this.append({path: Path.create(this.pos)});
  }

  /**
   * Sets the pen down or up. Subsequent move commands only draw the path if the pen is down.
   */
  penDown(down = true) {
    return this.append({down});
  }

  penUp(up = true) {
    return this.penDown(!up);
  }

  withPenDown<Args extends unknown[]>(
    down: boolean, func: TurtleFuncArg<Args>, ...args: Args): Turtle;
  withPenDown<Args extends unknown[]>(
    func: TurtleFuncArg<Args>, ...args: Args): Turtle;
  withPenDown<Args extends unknown[]>(...params:
    | [boolean, TurtleFuncArg<Args>, ...Args]
    | [TurtleFuncArg<Args>, ...Args]) {
    const [down = true, func, ...args] = typeof params[0] === "boolean" ?
      params : [undefined, ...params];
    const prev = this.isPenDown;
    return this.penDown(down).andThen(func, ...args).penDown(prev);
  }

  withPenUp<Args extends unknown[]>(
    up: boolean, func: TurtleFuncArg<Args>, ...args: Args): Turtle;
  withPenUp<Args extends unknown[]>(
    func: TurtleFuncArg<Args>, ...args: Args): Turtle;
  withPenUp<Args extends unknown[]>(...params:
    | [boolean, TurtleFuncArg<Args>, ...Args]
    | [TurtleFuncArg<Args>, ...Args]) {
    const [up = true, func, ...args] = typeof params[0] === "boolean" ?
      params : [undefined, ...params];
    return this.withPenDown(!up, func, ...args);
  }

  forward(length: number) {
    return this.goToRelative(length, 0);
  }

  back(length: number) {
    return this.forward(-length);
  }

  /**
   * Moves the Turtle directly to its right, without changing its angle. Same as:
   *
   *     .right().forward(length).left()
   */
  strafeRight(length: number) {
    return this.goToRelative(0, length);
  }

  /**
   * Moves the Turtle directly to its left, without changing its angle. Same as:
   *
   *     .left().forward(length).right()
   */
  strafeLeft(length: number) {
    return this.strafeRight(-length);
  }

  private goToRelative(forward: number, strafeRight: number) {
    const relTarget = this.relPos(forward, strafeRight);
    return this.appendDraw({
      pathIfDown: this.path.relativeLineTo(relTarget),
      dPos: relTarget,
    });
  }

  goTo(target: Point) {
    return this.appendDraw({
      pathIfDown: this.path.lineTo(target),
      pos: target,
    });
  }

  /** Moves to the specified position, without drawing a line. */
  jumpTo(target: Point) {
    return this.appendJump({
      pos: target,
    });
  }

  setAngle(angleDeg: number) {
    return this.append({angleDeg});
  }

  /** Sets the angle to look directly up. */
  lookUp() {return this.setAngle(0);}
  /** Sets the angle to look directly down. */
  lookDown() {return this.setAngle(180);}
  /** Sets the angle to look directly right. */
  lookRight() {return this.setAngle(90);}
  /** Sets the angle to look directly left. */
  lookLeft() {return this.setAngle(270);}

  /** Sets the angle to direct towards at the specified target. */
  lookAt(target: Point) {
    return this.setAngle(
      Math.atan2(target[0] - this.pos[0], this.pos[1] - target[1]) / Math.PI * 180);
  }

  /** Rotates the Turtle by the specified angle (90 by default). */
  right(angleDeg = 90) {
    return this.append({dAngleDeg: angleDeg});
  }

  /** Rotates the Turtle by the specified angle (90 by default). */
  left(angleDeg = 90) {
    return this.right(-angleDeg);
  }

  /** Rotates the angle by 180 degrees. */
  turnBack() {
    return this.right(180);
  }

  /**
   * Draws a Bézier curve from the current position to the target turtle.
   * If the parameter is `"quad"` (the default), a quadratic curve is drawn, with the control
   * point in the auto position (see below).
   * Otherwise, a cubic curve is drawn, with the following two control points:
   *
   *     this.forward(curveArgs.startSpeed).pos, target.back(curveArgs.targetSpeed).pos
   *
   * When the speed value is `"auto"`, the corresponding control point is at the auto position.
   *
   * The auto position is the intersection of the start and target Turtle vector directions.
   * Note that this point might correspond to negative start and/or target speed.
   * @see {@link Turtle.curve}
   */
  curveTo(target: Turtle, curveArgs: PartialCurveArgs = "quad") {
    const posAndAngle = {pos: target.pos, angleDeg: target.angleDeg};
    if (!this.isPenDown)
      return this.appendJump(posAndAngle);
    const start = this;
    const {startSpeed, targetSpeed} = curveArgs === "quad" ?
      {
        startSpeed: "auto" as const,
        targetSpeed: undefined,
      } : {
        startSpeed: curveArgs.startSpeed ?? curveArgs.speed ?? "auto",
        targetSpeed: curveArgs.targetSpeed ?? curveArgs.speed ?? "auto",
      };
    let autoPoint: [Point | undefined] | undefined;
    function toHomogeneous(turtle: Turtle) {
      const [sin, cos] = sinCos(turtle.angleDeg);
      return [cos, sin, -cos * turtle.pos[0] - sin * turtle.pos[1]];
    }
    function getAutoPoint() {
      if (!autoPoint) {
        const [a1, b1, c1] = toHomogeneous(start);
        const [a2, b2, c2] = toHomogeneous(target);
        const [a, b, c] = [b1 * c2 - b2 * c1, a2 * c1 - a1 * c2, a1 * b2 - a2 * b1];
        autoPoint = [Math.abs(c) < 1e-9 ? undefined : [a / c, b / c]];
      }
      return autoPoint[0];
    }
    function getPoint(turtle: Turtle, speed: ControlPointSpeed, dir = 1): Point {
      return speed === "auto" ? getAutoPoint() || turtle.pos :
        turtle.forward(speed * dir).pos;
    }
    const point1 = getPoint(this, startSpeed);
    const pathIfDown = targetSpeed === undefined ?
      this.path.quadratic({point1, target: target.pos}) :
      this.path.cubic({
        point1,
        point2: getPoint(target, targetSpeed, -1),
        target: target.pos,
      });
    return this.appendDraw({pathIfDown, ...posAndAngle});
  }

  /**
   * Draws a curve from the current position to the result of the TurtleFunc. Any drawing done
   * by the function is discarded, only the final position is taken into account.
   * @see {@link Turtle.curveTo}
   */
  curve(func: TurtleFuncArg, curveArgs?: PartialCurveArgs) {
    return this.curveTo(this.andThen(func), curveArgs);
  }

  /** Pops from the stack and then draws a curve to the current position. */
  curveFromPop(stackKey: StackKey, curveArgs?: PartialCurveArgs): Turtle;
  /** Pops from the stack and then draws a curve to the current position. */
  curveFromPop(curveArgs?: PartialCurveArgs): Turtle;
  curveFromPop(...params: [StackKey, PartialCurveArgs?] | [PartialCurveArgs?]) {
    const [stackKey = DEFAULT_STACK_KEY, curveArgs] = isStackKey(params[0]) ?
      (params as [StackKey, PartialCurveArgs?]) :
      [undefined, ...params as [PartialCurveArgs?]];
    return this.pop(stackKey).curveTo(this, curveArgs);
  }

  /** Peeks the stack and then draws a curve to the current position. */
  curveFromPeek(stackKey: StackKey, curveArgs?: PartialCurveArgs): Turtle;
  /** Peeks the stack and then draws a curve to the current position. */
  curveFromPeek(curveArgs?: PartialCurveArgs): Turtle;
  curveFromPeek(...params: [StackKey, PartialCurveArgs?] | [PartialCurveArgs?]) {
    const [stackKey = DEFAULT_STACK_KEY, curveArgs] = isStackKey(params[0]) ?
      (params as [StackKey, PartialCurveArgs?]) :
      [undefined, ...params as [PartialCurveArgs?]];
    return this.peek(stackKey).curveTo(this, curveArgs);
  }

  /**
   * Draws a curve to the result of:
   *
   *     .forward(circleR).right(angleDeg).forward(circleR)
   */
  smoothRight(angleDeg: number, circleR: number, curveArgs?: PartialCurveArgs) {
    return this.curve(t => t.forward(circleR).right(angleDeg).forward(circleR), curveArgs);
  }

  /**
   * Draws a curve to the result of:
   *
   *     .forward(circleR).left(angleDeg).forward(circleR)
   */
  smoothLeft(angleDeg: number, circleR: number) {
    return this.smoothRight(-angleDeg, circleR);
  }

  /** Makes a turn over the specified angle, with the specified radius. */
  arcRight(angleDeg: number, radius: number): Turtle {
    const [sin, cos] = sinCos(angleDeg);
    const relTarget = this.relPos(radius * sin, radius * (1 - cos));
    if (Math.abs(angleDeg) < 360)
      return this.appendDraw({
        pathIfDown: this.path.relativeArc({
          radiusX: radius,
          target: relTarget,
          largeArc: (sin < 0) === (angleDeg > 0),
          clockwise: angleDeg > 0,
        }),
        dPos: relTarget,
        dAngleDeg: angleDeg,
      });
    const atTarget = this.appendJump({
      dPos: relTarget,
      dAngleDeg: angleDeg,
    });
    if (this.isPenDown)
      return atTarget.push().arcRight(180, radius).arcRight(180, radius).pop();
    return atTarget;
  }

  /**
   * Draws an ellipse arc corresponding to the path:
   *
   *     .forward(forward).right().forward(right)
   */
  roundCornerRight(forward: number, right = forward) {
    const relPos = this.relPos(forward, right);
    return this.appendDraw({
      pathIfDown: this.path.relativeArc({
        target: relPos,
        radiusX: right,
        radiusY: forward,
        xAxisRotationDeg: this.angleDeg,
        clockwise: forward * right >= 0,
      }),
      dPos: relPos,
      dAngleDeg: 90,
    });
  }

  /**
   * Draws an ellipse arc corresponding to the path:
   *
   *     .forward(forward).left().forward(left)
   */
  roundCornerLeft(forward: number, left: number) {
    return this.roundCornerRight(forward, -left).turnBack();
  }

  /**
   * Draws half of an ellipse, corresponding to the path:
   *
   *     .forward(length).right().forward(right).right().forward(length)
   */
  halfEllipseRight(forward: number, right: number) {
    const relPos = this.relPos(0, right);
    return this.appendDraw({
      pathIfDown: this.path.relativeArc({
        target: relPos,
        radiusX: right / 2,
        radiusY: forward,
        xAxisRotationDeg: this.angleDeg,
        clockwise: forward * right >= 0,
      }),
      dPos: relPos,
      dAngleDeg: 180,
    });
  }

  /**
   * Draws half of an ellipse, corresponding to the path:
   *
   *     .forward(length).left().forward(left).left().forward(length)
   */
  halfEllipseLeft(forward: number, left: number) {
    return this.halfEllipseRight(forward, -left);
  }

  /** Makes a turn over the specified angle, with the specified radius. */
  arcLeft(angleDeg: number, radius: number) {
    return this.arcRight(-angleDeg, -radius);
  }

  private relPos(forward: number, strafeRight: number): Point {
    const [sin, cos] = sinCos(this.angleDeg);
    return [forward * sin + strafeRight * cos, -forward * cos + strafeRight * sin];
  }

  /** Draws a circle centered at the current position. */
  circle(radius: number) {
    return this.ellipse(radius);
  }

  /** Draws an ellipse centered at the current position. */
  ellipse(radiusForward: number, radiusSides = radiusForward) {
    if (!this.state.down)
      return this;
    return this.branch(t => t
      .appendJump({dPos: t.relPos(radiusForward, 0), dAngleDeg: 90})
      .halfEllipseRight(radiusSides, 2 * radiusForward)
      .halfEllipseRight(radiusSides, 2 * radiusForward)
    );
  }

  /** Closes the Turtle's path and returns the Path. */
  closePath() {
    return this.asPath().closePath();
  }

  toString() {
    return `Turtle[${JSON.stringify(this.state)}, stack=${JSON.stringify(this.stacks)}, ` +
      `path=${this.path}]`;
  }

}
