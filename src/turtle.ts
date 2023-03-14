import {lazyPiece} from './lazy_piece.ts';
import {Path} from './path.ts';
import {Piece, PieceFunc} from './pieces.ts';
import {Point, isPoint} from './point.ts';
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

export type TurtlePoint = Point | Turtle;

function pointFromTurtle(point: TurtlePoint): Point {
  return isPoint(point) ? point : point.pos;
}

export type Speed = number | "auto";

export interface PartialCurveArgs {
  speed?: Speed;
  startSpeed?: Speed;
  targetSpeed?: Speed;
}
interface CurveArgs {
  startSpeed: Speed;
  targetSpeed: Speed;
}
function curveArgsFromPartial({
  speed = "auto",
  startSpeed = speed,
  targetSpeed = speed,
}: PartialCurveArgs): CurveArgs {
  return {startSpeed, targetSpeed};
}

type Stack = readonly Partial<State>[];
type StackKey = string | number | undefined;
type Stacks = ReadonlyMap<StackKey, Stack>;

const DEFAULT_STACK_KEY: StackKey = undefined;

function isStackKey(value: StackKey | {}): value is StackKey {
  return value === DEFAULT_STACK_KEY || typeof value === "string" || typeof value === "number";
}

function stackKeyToString(stackKey: StackKey) {
  return stackKey === DEFAULT_STACK_KEY ? "default" : JSON.stringify(stackKey);
}

export interface TurtleFunc<Args extends unknown[] = []> {
  (turtle: Turtle, ...args: Args): Turtle;
}

interface TurtleToPieceFunc<Args extends unknown[] = []> {
  (turtle: Turtle, ...args: Args): Piece;
}

export class Turtle extends lazyPiece<Turtle, [Point?]>() {

  protected constructor(
    private readonly path: Path,
    private readonly state: State,
    private readonly stacks: Stacks,
  ) {
    super(path);
  }

  protected static createInternal(start: Point = [0, 0]) {
    return new Turtle(Path.create(start), {pos: start, angleDeg: 0, down: true}, new Map());
  }

  get pos() {return this.state.pos;}
  get angleDeg() {return this.state.angleDeg;}
  get isPenDown() {return this.state.down;}

  asPath() {
    return this.path;
  }

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

  then<Args extends unknown[]>(func: TurtleFunc<Args>, ...args: Args): Turtle;
  then<Args extends unknown[]>(func: PieceFunc<Args>, ...args: Args): Piece;
  then<Args extends unknown[]>(func: TurtleToPieceFunc<Args>, ...args: Args): Piece;
  then<Args extends unknown[]>(func: PieceFunc<Args> | TurtleFunc<Args>, ...args: Args) {
    return super.then<Args>(func as PieceFunc<Args>, ...args);
  }

  private pushInternal(stackKey: StackKey, state: Partial<State>) {
    return this.append({stackKey, stack: [...this.stacks.get(stackKey) || [], state]});
  }

  push(stackKey = DEFAULT_STACK_KEY) {
    return this.pushInternal(stackKey, this.state);
  }

  pushPos(stackKey = DEFAULT_STACK_KEY) {
    return this.pushInternal(stackKey, {pos: this.pos});
  }

  pushAngle(stackKey = DEFAULT_STACK_KEY) {
    return this.pushInternal(stackKey, {angleDeg: this.angleDeg});
  }

  pushPosAndAngle(stackKey = DEFAULT_STACK_KEY) {
    return this.pushInternal(stackKey, {pos: this.pos, angleDeg: this.angleDeg});
  }

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

  peek(stackKey = DEFAULT_STACK_KEY) {
    const stack = this.stacks.get(stackKey);
    if (!stack || !stack.length)
      throw new Error(`Stack ${stackKeyToString(stackKey)} is empty.`);
    return this.appendState(assert(stack.at(-1)));
  }

  pop(stackKey = DEFAULT_STACK_KEY) {
    return this.peek(stackKey).append({
      stackKey,
      stack: assert(this.stacks.get(stackKey)).slice(0, -1),
    });
  }

  branch<Args extends unknown[]>(func: TurtleFunc<Args>, ...args: Args) {
    const state = this.state;
    return this.then(func, ...args).appendState(state);
  }

  copy(t: Turtle) {return this.appendState(t.state);}
  copyPos(t: Turtle) {return this.appendState({pos: t.pos});}
  copyAngle(t: Turtle) {return this.appendState({angleDeg: t.angleDeg});}
  copyPosAndAngle(t: Turtle) {return this.appendState({pos: t.pos, angleDeg: t.angleDeg});}
  copyPen(t: Turtle) {return this.appendState({down: t.isPenDown});}

  dropPath() {
    return this.append({path: Path.create(this.pos)});
  }

  penDown(down = true) {
    return this.append({down});
  }

  penUp() {
    return this.penDown(false);
  }

  withPenDown<Args extends unknown[]>(
    down: boolean, func: TurtleFunc<Args>, ...args: Args): Turtle;
  withPenDown<Args extends unknown[]>(
    func: TurtleFunc<Args>, ...args: Args): Turtle;
  withPenDown<Args extends unknown[]>(
    downOrFunc: boolean | TurtleFunc<Args>,
    func?: TurtleFunc<Args>, ...args: Args) {
    let down = true;
    if (typeof downOrFunc === "boolean")
      down = downOrFunc;
    else {
      func = downOrFunc;
      args = [func, ...args] as Args;
    }
    const prev = this.isPenDown;
    return this.penDown(down).then(assert(func), ...args).penDown(prev);
  }

  withPenUp<Args extends unknown[]>(func: TurtleFunc<Args>, ...args: Args) {
    return this.withPenDown(false, func, ...args);
  }

  forward(length: number) {
    return this.goToRelative(length, 0);
  }

  back(length: number) {
    return this.forward(-length);
  }

  strafeRight(length: number) {
    return this.goToRelative(0, length);
  }

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

  goTo(target: TurtlePoint) {
    const point = pointFromTurtle(target);
    return this.appendDraw({
      pathIfDown: this.path.lineTo(point),
      pos: point,
    });
  }

  jumpTo(target: TurtlePoint) {
    return this.appendJump({
      pos: pointFromTurtle(target),
    });
  }

  setAngle(angleDeg: number) {
    return this.append({angleDeg});
  }

  lookUp() {return this.setAngle(0);}
  lookDown() {return this.setAngle(180);}
  lookRight() {return this.setAngle(90);}
  lookLeft() {return this.setAngle(270);}

  lookTowards(target: TurtlePoint) {
    const point = pointFromTurtle(target);
    return this.setAngle(
      Math.atan2(point[0] - this.pos[0], this.pos[1] - point[1]) / Math.PI * 180);
  }

  right(angleDeg = 90) {
    return this.append({dAngleDeg: angleDeg});
  }

  left(angleDeg = 90) {
    return this.right(-angleDeg);
  }

  turnBack() {
    return this.right(180);
  }

  curveTo(target: Turtle, curveArgs: PartialCurveArgs = {}) {
    const posAndAngle = {pos: target.pos, angleDeg: target.angleDeg};
    if (!this.isPenDown)
      return this.appendJump(posAndAngle);
    const start = this;
    const {startSpeed, targetSpeed} = curveArgsFromPartial(curveArgs);
    let autoPoint: Point | undefined;
    function toHomogeneous(turtle: Turtle) {
      const [sin, cos] = sinCos(turtle.angleDeg);
      const {pos} = turtle.state;
      return [cos, sin, -cos * pos[0] - sin * pos[1]];
    }
    function getAutoPoint() {
      if (!autoPoint) {
        const [a1, b1, c1] = toHomogeneous(start);
        const [a2, b2, c2] = toHomogeneous(target);
        const [a, b, c] = [b1 * c2 - b2 * c1, a2 * c1 - a1 * c2, a1 * b2 - a2 * b1];
        autoPoint = Math.abs(c) < 1e-9 ? start.pos : [a / c, b / c];
      }
      return autoPoint;
    }
    function getPoint(turtle: Turtle, speed: Speed, speedMult = 1): Point {
      if (speed === "auto")
        return getAutoPoint();
      const {pos, angleDeg} = turtle.state;
      const vel = speed * speedMult;
      const [sin, cos] = sinCos(angleDeg);
      return [pos[0] + vel * sin, pos[1] - vel * cos];
    }
    const point1 = getPoint(this, startSpeed);
    const point2 = getPoint(target, targetSpeed, -1);
    return this.appendDraw({
      pathIfDown: this.path.bezier({point1, point2, target: target.pos}),
      ...posAndAngle,
    });
  }

  curve(func: TurtleFunc, curveArgs?: PartialCurveArgs) {
    return this.curveTo(this.then(func), curveArgs);
  }

  curveFromPop(stackKey: StackKey, curveArgs?: PartialCurveArgs): Turtle;
  curveFromPop(curveArgs?: PartialCurveArgs): Turtle;
  curveFromPop(
    stackKeyOrCurveArgs?: StackKey | PartialCurveArgs, curveArgs?: PartialCurveArgs) {
    let stackKey = DEFAULT_STACK_KEY;
    if (isStackKey(stackKeyOrCurveArgs))
      stackKey = stackKeyOrCurveArgs;
    else
      curveArgs = stackKeyOrCurveArgs;
    return this.pop(stackKey).curveTo(this, curveArgs);
  }

  curveFromPeek(stackKey: StackKey, curveArgs?: PartialCurveArgs): Turtle;
  curveFromPeek(curveArgs?: PartialCurveArgs): Turtle;
  curveFromPeek(
    stackKeyOrCurveArgs?: StackKey | PartialCurveArgs, curveArgs?: PartialCurveArgs) {
    let stackKey = DEFAULT_STACK_KEY;
    if (isStackKey(stackKeyOrCurveArgs))
      stackKey = stackKeyOrCurveArgs;
    else
      curveArgs = stackKeyOrCurveArgs;
    return this.peek(stackKey).curveTo(this, curveArgs);
  }

  smoothRight(angleDeg: number, circleR: number, curveArgs?: PartialCurveArgs) {
    return this.curve(t => t.forward(circleR).right(angleDeg).forward(circleR), curveArgs);
  }

  smoothLeft(angleDeg: number, circleR: number) {
    return this.smoothRight(-angleDeg, circleR);
  }

  arcRight(angleDeg: number, radius: number): Turtle {
    const [sin, cos] = sinCos(angleDeg);
    const relTarget = this.relPos(radius * sin, radius * (1 - cos));
    if (Math.abs(angleDeg) < 360)
      return this.appendDraw({
        pathIfDown: this.path.relativeArc({
          radiusX: radius,
          target: relTarget,
          largeArc: (sin < 0) === (angleDeg > 0),
          clockwiseSweep: angleDeg > 0,
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

  arcLeft(angleDeg: number, radius: number) {
    return this.arcRight(-angleDeg, -radius);
  }

  private relPos(forward: number, strafeRight: number): Point {
    const [sin, cos] = sinCos(this.angleDeg);
    return [forward * sin + strafeRight * cos, -forward * cos + strafeRight * sin];
  }

  closePath() {
    return this.asPath().closePath();
  }

  toString() {
    return `Turtle[${JSON.stringify(this.state)}, stack=${JSON.stringify(this.stacks)}, path=${this.path}]`;
  }

}
