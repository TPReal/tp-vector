/** Returns a grey color of the specified darkness, 0 is white, 1 is black. */
export function darkness(darknessValue: number) {
  const val = 255 * (1 - darknessValue);
  return `rgb(${val},${val},${val})`;
}
