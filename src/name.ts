import {round} from './util.ts';

export function getSizeString(size: number, millimetersPerUnit?: number) {
  if (millimetersPerUnit === undefined)
    return `${round(size)}`;
  return `${round(size * millimetersPerUnit, {maxDigits: 2})}mm`;
}

export function getNameSizeSuffix({width}: {width: number}, millimetersPerUnit?: number) {
  return ` w${getSizeString(width, millimetersPerUnit).replace(".", "_")}`;
}

export function getSuffixedFileName(fileName: string, fileNameSuffix: string | undefined) {
  return fileNameSuffix ? fileName + fileNameSuffix : fileName;
}

export function toFileName(name: string) {
  return name.replaceAll(/\p{Z}+/gu, " ");
}
