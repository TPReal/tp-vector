import {createElement} from './elements.ts';
import {lazyPiece} from './lazy_piece.ts';
import {Point, pointsToString} from './point.ts';
import {OrArrayRest, flatten} from './util.ts';

export interface QuadraticArgs {
  point1: Point;
  target: Point;
}

export interface NextQuadraticArgs {
  point1?: Point;
  target: Point;
}

export interface BezierArgs extends QuadraticArgs {
  point2: Point;
}

export interface NextBezierArgs extends NextQuadraticArgs {
  point2: Point;
}

export interface PartialArcArgs {
  radiusX: number;
  radiusY?: number;
  xAxisRotationDeg?: number;
  largeArc?: boolean;
  clockwiseSweep: boolean;
  target: Point;
}
interface ArcArgs extends Required<PartialArcArgs> {
}
function arcArgsFromPartial({
  radiusX,
  radiusY = radiusX,
  xAxisRotationDeg = 0,
  largeArc = false,
  clockwiseSweep,
  target,
}: PartialArcArgs): ArcArgs {
  return {radiusX, radiusY, xAxisRotationDeg, largeArc, clockwiseSweep, target};
}

export class Path extends lazyPiece<Path, [Point?]>() {

  protected constructor(private readonly commands: readonly string[]) {
    super(() => this.getElement());
  }

  protected static createInternal(start: Point = [0, 0]) {
    return new Path([]).moveTo(start);
  }

  static fromD(...commandsOrD: OrArrayRest<string>) {
    return new Path(flatten(commandsOrD));
  }

  private getElement() {
    return createElement({tagName: "path", attributes: {d: this.asPathD()}});
  }

  private append(elementSpecs: {
    command: string,
    args?: string,
    relative?: boolean,
  }[], pathClass = Path) {
    const newElements = elementSpecs.map(({command, args, relative = false}) => {
      const caseCommand = relative ? command.toLowerCase() : command;
      return args ? `${caseCommand} ${args}` : caseCommand;
    });
    return new pathClass([...this.commands, ...newElements]);
  }

  moveTo(target: Point, {relative = false} = {}) {
    return this.append([{
      command: "M",
      args: pointsToString([target]),
      relative,
    }]);
  }

  relativeMoveTo(target: Point) {
    return this.moveTo(target, {relative: true});
  }

  private appendLineTo(targets: Point[], relative = false) {
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

  horizontal(x: number, {relative = false} = {}) {
    return this.append([{command: "H", args: String(x), relative}]);
  }

  relativeHorizontal(dx: number) {
    return this.horizontal(dx, {relative: true});
  }

  vertical(y: number, {relative = false} = {}) {
    return this.append([{command: "V", args: String(y), relative}]);
  }

  relativeVertical(dy: number) {
    return this.vertical(dy, {relative: true});
  }

  closePath() {
    return this.append([{command: "Z"}]);
  }

  protected appendQuadratic({args, relative = false}: {
    args: NextQuadraticArgs[],
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

  quadratic(args: QuadraticArgs, ...nextArgs: NextQuadraticArgs[]) {
    return this.appendQuadratic({args: [args, ...nextArgs]});
  }

  relativeQuadratic(args: QuadraticArgs, ...nextArgs: NextQuadraticArgs[]) {
    return this.appendQuadratic({args: [args, ...nextArgs], relative: true});
  }

  protected appendBezier({args, relative = false}: {
    args: NextBezierArgs[],
    relative?: boolean,
  }): LastBezierPath {
    return this.append(args.map(({point1, point2, target}) =>
      point1 ? {
        command: "C",
        args: pointsToString([point1, point2, target]),
        relative,
      } : {
        command: "S",
        args: pointsToString([point2, target]),
        relative,
      }), LastBezierPath);
  }

  bezier(args: BezierArgs, ...nextArgs: NextBezierArgs[]) {
    return this.appendBezier({args: [args, ...nextArgs]});
  }

  relativeBezier(args: BezierArgs, ...nextArgs: NextBezierArgs[]) {
    return this.appendBezier({args: [args, ...nextArgs], relative: true});
  }

  private appendArc({args, relative = false}: {
    args: PartialArcArgs[],
    relative?: boolean,
  }) {
    return this.append(args.map(arcArgs => {
      const {radiusX, radiusY, xAxisRotationDeg, largeArc, clockwiseSweep, target} =
        arcArgsFromPartial(arcArgs);
      return {
        command: "A",
        args: `${radiusX},${radiusY} ${xAxisRotationDeg} ${Number(largeArc)} ${Number(clockwiseSweep)} ${pointsToString([target])}`,
        relative,
      };
    }));
  }

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

class LastBezierPath extends Path {

  bezier(...args: NextBezierArgs[]) {
    return this.appendBezier({args});
  }

  relativeBezier(...args: NextBezierArgs[]) {
    return this.appendBezier({args, relative: true});
  }

}
