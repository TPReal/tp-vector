import {BasicSheetParams, mergeSheetParams, Sheet, SheetParams} from './sheet.ts';

type SheetsCollectionCreateParams = readonly [SheetsCollectionInput] | readonly [BasicSheetParams | undefined, SheetsCollectionInput];

function getCreateParams(params: SheetsCollectionCreateParams): readonly [BasicSheetParams | undefined, SheetsCollectionInput] {
  return params.length === 1 ? [undefined, params[0]] : params;
}

export interface SheetsCollectionInput {
  [name: string]: SheetParams | SheetsCollectionCreateParams;
}

export type SheetsCollection<T extends SheetsCollectionInput> = {
  readonly [name in keyof T]: T[name] extends [BasicSheetParams | undefined, SheetsCollectionInput] ? SheetsCollection<T[name][1]> :
  T[name] extends [SheetsCollectionInput] ? SheetsCollection<T[name][0]> :
  Sheet;
} & readonly Sheet[];

export function sheetsCollection<T extends SheetsCollectionInput>(basicParams: BasicSheetParams, input: T): SheetsCollection<T>;
export function sheetsCollection<T extends SheetsCollectionInput>(input: T): SheetsCollection<T>;
export function sheetsCollection(...params: SheetsCollectionCreateParams) {
  const [basicParams, input] = getCreateParams(params)
  // deno-lint-ignore no-explicit-any
  const result: any = [];
  for (const [name, value] of Object.entries(input)) {
    const nameParams: BasicSheetParams | undefined = name.startsWith("_") ? undefined : {
      options: {
        name: [basicParams?.options?.name, name].filter(Boolean).join(" "),
        fileName: basicParams?.options?.fileName ? basicParams.options.fileName + " " + name : undefined,
      }
    };
    if (Array.isArray(value)) {
      const [basicParams2, input2] = getCreateParams(value);
      const collection = sheetsCollection(mergeSheetParams([basicParams, nameParams], basicParams2), input2);
      result.push(...collection);
      result[name] = collection;
    } else {
      const sheet = Sheet.create(mergeSheetParams([basicParams, nameParams], value));
      result.push(sheet);
      result[name] = sheet;
    }
  }
  return result;
}

export function sheetsCollectionParam<P>(
  paramValues: readonly P[],
  func: (p: P) => SheetsCollectionInput[string],
  paramName?: string | ((p: P) => string),
): SheetsCollectionInput {
  const result: SheetsCollectionInput = {};
  for (const p of paramValues)
    result[typeof paramName === "function" ? paramName(p) : `${paramName || "p"}=${p}`] = func(p);
  return result;
}
