export type OrPromise<T> = T | Promise<T>;
export type OrFuncPromise<T, Args extends unknown[] = []> =
  OrPromise<T> | ((...args: Args) => OrPromise<T>);

export async function unwrap<T, Args extends unknown[]>(obj: OrFuncPromise<T, Args>, args: Args): Promise<T> {
  const awaitable = typeof obj === "function" ?
    (obj as (...args: Args) => OrPromise<T>)(...args) :
    obj;
  return await awaitable;
}

export type SectionDef = OrFuncPromise<{
  name: string,
  element: HTMLElement,
}>;
