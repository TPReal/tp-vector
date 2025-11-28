import {createElement} from './elements.ts';
import {SimpleLazyPiece} from './lazy_piece.ts';
import {Point, isZeroPoint, pointsToString} from './point.ts';
import {OrArrayRest, flatten, roundReasonably} from './util.ts';

/**
 * Parameters of a quadratic Bézier curve drawn directly after another quadratic curve.
 * If the control point is not specified, it is a reflection of the previous control point.
 */
export interface NextQuadraticArgs {
  readonly point1?: Point;
  readonly target: Point;
}
/** Parameters of a quadratic Bézier curve. */
export interface QuadraticArgs extends Required<NextQuadraticArgs> {}

/**
 * Parameters of a cubic Bézier curve drawn directly after another cubic curve.
 * If the first control point is not specified, it is a reflection of the previous control point.
 */
export interface NextCubicArgs extends NextQuadraticArgs {
  readonly point2: Point;
}
/** Parameters of a cubic Bézier curve. */
export interface CubicArgs extends Required<NextCubicArgs> {}

/**
 * Parameters of an arc.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#arcs
 */
export interface PartialArcArgs {
  radiusX: number;
  radiusY?: number;
  xAxisRotationDeg?: number;
  largeArc?: boolean;
  clockwise: boolean;
  target: Point;
}
interface ArcArgs extends Required<PartialArcArgs> {}
function arcArgsFromPartial({
  radiusX,
  radiusY = radiusX,
  xAxisRotationDeg = 0,
  largeArc = false,
  clockwise,
  target,
}: PartialArcArgs): ArcArgs {
  return {radiusX, radiusY, xAxisRotationDeg, largeArc, clockwise, target};
}

/** A builder for a `<path>` element. */
export class Path extends SimpleLazyPiece {

  protected constructor(
    private readonly commands: readonly string[],
    private readonly lastCommand: string | undefined,
  ) {
    super(() => this.getElement());
  }

  static create(point?: Point): Path;
  static create(...params: Parameters<typeof SimpleLazyPiece.create>): never;
  static create(...params: unknown[]) {
    const [start = [0, 0]] = params as [Point?];
    return new Path([], undefined).moveTo(start);
  }

  /**
   * Creates a Path from the value of a d attribute.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/d
   */
  static fromD(...commandsOrD: OrArrayRest<string>) {
    return new Path(flatten(commandsOrD).map(d => d.trim()), undefined);
  }

  private getElement() {
    return createElement({tagName: "path", attributes: {d: this.asPathD()}});
  }

  private append(elementSpecs: readonly {
    command: string,
    args?: string,
    relative?: boolean,
  }[], pathClass = Path) {
    if (!elementSpecs.length)
      return this;
    const commands = [...this.commands];
    let lastCommand = this.lastCommand;
    for (const {command, args, relative = false} of elementSpecs) {
      if (command === "M" && lastCommand === "M")
        commands.pop();
      lastCommand = command;
      const casedCommand = relative ? command.toLowerCase() : command;
      commands.push(args ? `${casedCommand}${args}` : casedCommand);
    }
    return new pathClass(commands, lastCommand);
  }

  /** Moves to the point, without drawing a line. */
  moveTo(target: Point, {relative = false} = {}) {
    return relative && isZeroPoint(target) ? this : this.append([{
      command: "M",
      args: pointsToString([target]),
      relative,
    }]);
  }

  relativeMoveTo(target: Point) {
    return this.moveTo(target, {relative: true});
  }

  private appendLineTo(targets: readonly Point[], relative = false) {
    if (relative)
      targets = targets.filter(target => !isZeroPoint(target));
    return this.append(targets.map(target => ({
      command: "L",
      args: pointsToString([target]),
      relative,
    })));
  }

  lineTo(...targets: Point[]) {
    return this.appendLineTo(targets);
  }

  relativeLineTo(...targets: Point[]) {
    return this.appendLineTo(targets, true);
  }

  /** Draws a horizontal line. */
  horizontal(x: number, {relative = false} = {}) {
    return relative && x === 0 ? this : this.append([{command: "H", args: String(x), relative}]);
  }

  relativeHorizontal(dx: number) {
    return this.horizontal(dx, {relative: true});
  }

  /** Draws a vertical line. */
  vertical(y: number, {relative = false} = {}) {
    return relative && y === 0 ? this : this.append([{command: "V", args: String(y), relative}]);
  }

  relativeVertical(dy: number) {
    return this.vertical(dy, {relative: true});
  }

  /** Closes the path by going back to the beginning. */
  closePath() {
    return this.append([{command: "Z"}]);
  }

  protected appendQuadratic({args, relative = false}: {
    args: readonly NextQuadraticArgs[],
    relative?: boolean,
  }): LastQuadraticPath {
    return this.append(args.map(({point1, target}) =>
      point1 ? {
        command: "Q",
        args: pointsToString([point1, target]),
        relative,
      } : {
        command: "T",
        args: pointsToString([target]),
        relative,
      }), LastQuadraticPath);
  }

  /**
   * Draws a quadratic Bézier curve.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#bézier_curves
   */
  quadratic(args: QuadraticArgs, ...nextArgs: NextQuadraticArgs[]) {
    return this.appendQuadratic({args: [args, ...nextArgs]});
  }

  relativeQuadratic(args: QuadraticArgs, ...nextArgs: NextQuadraticArgs[]) {
    return this.appendQuadratic({args: [args, ...nextArgs], relative: true});
  }

  protected appendCubic({args, relative = false}: {
    args: readonly NextCubicArgs[],
    relative?: boolean,
  }): LastCubicPath {
    return this.append(args.map(({point1, point2, target}) =>
      point1 ? {
        command: "C",
        args: pointsToString([point1, point2, target]),
        relative,
      } : {
        command: "S",
        args: pointsToString([point2, target]),
        relative,
      }), LastCubicPath);
  }

  /**
   * Draws a cubic Bézier curve.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#b%C3%A9zier_curves
   */
  cubic(args: CubicArgs, ...nextArgs: NextCubicArgs[]) {
    return this.appendCubic({args: [args, ...nextArgs]});
  }

  relativeCubic(args: CubicArgs, ...nextArgs: NextCubicArgs[]) {
    return this.appendCubic({args: [args, ...nextArgs], relative: true});
  }

  private appendArc({args, relative = false}: {
    args: readonly PartialArcArgs[],
    relative?: boolean,
  }) {
    return this.append(args.map(arcArgs => {
      const {radiusX, radiusY, xAxisRotationDeg, largeArc, clockwise, target} =
        arcArgsFromPartial(arcArgs);
      return {
        command: "A",
        args: `${roundReasonably(radiusX)},${roundReasonably(radiusY)} ` +
          `${roundReasonably(xAxisRotationDeg)} ${Number(largeArc)} ${Number(clockwise)} ` +
          pointsToString([target]),
        relative,
      };
    }));
  }

  /**
   * Draws an arc.
   * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths#arcs
   */
  arc(...args: PartialArcArgs[]) {
    return this.appendArc({args});
  }

  relativeArc(...args: PartialArcArgs[]) {
    return this.appendArc({args, relative: true});
  }

  asPathD() {
    return this.commands.join(" ");
  }

  toString() {
    return `Path[${this.asPathD()}]`;
  }

}

class LastQuadraticPath extends Path {

  quadratic(...args: NextQuadraticArgs[]) {
    return this.appendQuadratic({args});
  }

  relativeQuadratic(...args: NextQuadraticArgs[]) {
    return this.appendQuadratic({args, relative: true});
  }

}

class LastCubicPath extends Path {

  cubic(...args: NextCubicArgs[]) {
    return this.appendCubic({args});
  }

  relativeCubic(...args: NextCubicArgs[]) {
    return this.appendCubic({args, relative: true});
  }

}
