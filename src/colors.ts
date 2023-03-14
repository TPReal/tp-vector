export function darkness(darknessValue: number) {
  const val = 255 * (1 - darknessValue);
  return `rgb(${val},${val},${val})`;
}
