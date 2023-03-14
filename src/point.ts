export type Point = readonly [number, number]

export function isPoint(arg: Point | {} | null | undefined): arg is Point {
  return Array.isArray(arg) && arg.length === 2 &&
    typeof arg[0] === "number" && typeof arg[1] === "number";
}

export function pointsToString(points: Point[]) {
  return points.map(point => point.join(",")).join(" ");
}
