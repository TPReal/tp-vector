/**
 * Definition of kerf correction. It is a size correction necessary to obtain the desired
 * tightness between elements. It is dependent on the laser type, focus, material type, desired
 * tightness and other variables.
 * See the calibrator in _calibration/kerf.ts_.
 */
export interface Kerf {
  /** The distance (in units) by which each of two adjacent edges be moved towards each other. */
  readonly oneSideInUnits: number;
}

/** Zero kerf, corresponding to a very loose connection. */
export const ZERO: Kerf = {oneSideInUnits: 0};

/**
 * Creates kerf specified as the total relative displacement of the adjacent edges, in millimeters.
 */
export function millimeters(
  inMillimeters: number,
  {millimetersPerUnit}: {millimetersPerUnit: number},
) {
  return oneSideMillimeters(inMillimeters / 2, {millimetersPerUnit});
}

/**
 * Creates kerf specified as the displacement of one of a pair of adjacent edges, in millimeters.
 */
export function oneSideMillimeters(
  oneSideMillimeters: number,
  {millimetersPerUnit}: {millimetersPerUnit: number},
) {
  return oneSideUnits(oneSideMillimeters / millimetersPerUnit);
}

/** Creates kerf specified as the total relative displacement of the adjacent edges, in units. */
export function units(inUnits: number) {
  return oneSideUnits(inUnits / 2);
}

/** Creates kerf specified as the displacement of one of a pair of adjacent edges, in units. */
export function oneSideUnits(oneSideInUnits: number): Kerf {
  return {oneSideInUnits};
}
