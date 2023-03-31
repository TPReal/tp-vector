export enum Axis {
  X = "X",
  Y = "Y",
}

export function otherAxis(axis: Axis) {
  return axis === Axis.X ? Axis.Y : Axis.X;
}
