import {getGlobalOptions} from './global_options.ts';
import {Piece} from './pieces.ts';
import {Point, pointsToString} from './point.ts';
import {flattenPoints, OrArrayRest} from './util.ts';
import {PartialViewBox, viewBoxFromPartial} from './view_box.ts';

export function circle({
  center = [0, 0],
  radius = 1,
}: {
  center?: Point,
  radius?: number,
} = {}) {
  return Piece.createElement({
    tagName: "circle",
    attributes: {cx: center[0], cy: center[1], r: radius},
  });
}

export function ellipse({
  center = [0, 0],
  radiusX = 1,
  radiusY = 1,
}: {
  center?: Point,
  radiusX?: number,
  radiusY?: number,
} = {}) {
  return Piece.createElement({
    tagName: "ellipse",
    attributes: {cx: center[0], cy: center[1], rx: radiusX, ry: radiusY},
  });
}

export function rectangle({
  cornerRadius = 0,
  cornerRadiusX = cornerRadius,
  cornerRadiusY = cornerRadius,
  ...viewBox
}: PartialViewBox & {
  cornerRadius?: number,
  cornerRadiusX?: number,
  cornerRadiusY?: number,
} = {}) {
  const {minX, minY, width, height} = viewBoxFromPartial(viewBox);
  return Piece.createElement({
    tagName: "rect",
    attributes: {
      x: minX, y: minY, width, height,
      ...cornerRadiusX ? {rx: cornerRadiusX} : {},
      ...cornerRadiusY ? {ry: cornerRadiusY} : {},
    },
  });
}

export function line(originTo: Point): Piece;
export function line(from: Point, to: Point): Piece;
export function line(...args: [Point] | [Point, Point]) {
  const [from, to] = args.length == 1 ? [[0, 0], args[0]] : args;
  const line = Piece.createElement({
    tagName: "line",
    attributes: {x1: from[0], y1: from[1], x2: to[0], y2: to[1]},
  });
  return getGlobalOptions().quirks?.lineTransformBroken ?
    line.wrapInG() : line;
}

export function polygon(...points: OrArrayRest<Point>) {
  return Piece.createElement({
    tagName: "polygon",
    attributes: {points: pointsToString(flattenPoints(points))},
  });
}

export function polyLine(...points: OrArrayRest<Point>) {
  return Piece.createElement({
    tagName: "polyline",
    attributes: {points: pointsToString(flattenPoints(points))},
  });
}
