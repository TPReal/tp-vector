import {round} from './util.ts';

export function getSizeString(size: number, millimetersPerUnit?: number) {
  if (millimetersPerUnit === undefined)
    return `${round(size)}`;
  return `${round(size * millimetersPerUnit, {maxDigits: 2})}mm`;
}

export function getNameSizeSuffix({width}: {width: number}, millimetersPerUnit?: number) {
  return `__w${getSizeString(width, millimetersPerUnit).replace(".", "_")}`;
}

export function getSuffixedName(name: string, nameSuffix: string | undefined) {
  return nameSuffix ? name + nameSuffix : name;
}
