export interface Kerf {
  readonly oneSideInUnits: number;
}

export const ZERO: Kerf = {oneSideInUnits: 0};

export function millimeters(
  inMillimeters: number,
  {millimetersPerUnit}: {millimetersPerUnit: number},
) {
  return oneSideMillimeters(inMillimeters / 2, {millimetersPerUnit});
}

export function oneSideMillimeters(
  oneSideMillimeters: number,
  {millimetersPerUnit}: {millimetersPerUnit: number},
) {
  return oneSideUnits(oneSideMillimeters / millimetersPerUnit);
}

export function units(inUnits: number) {
  return oneSideUnits(inUnits / 2);
}

export function oneSideUnits(oneSideInUnits: number): Kerf {
  return {oneSideInUnits};
}
