type ValueSaver = (v: number) => number;
export type InlineParams = Readonly<Record<string, number & ValueSaver>>;

/**
 * Creates an inline params object. It is a quick and dirty way of specifying
 * numeric parameters on the fly. Each property of the object can act as
 * a number, or as a function to set that number.
 *
 * Usage example:
 *
 *     const p = createInlineParams();
 *     let t = Turtle.create()
 *       .forward(p.side(5)).right().forward(p.side2(2 * p.side)).right()
 *       .forward(p.side).right().forward(p.side2);
 *
 * This example sets `p.side` to 5 on the first use, and `p.side2` to 10. The values
 * are then available for use.
 */
export function createInlineParams(init: Record<string, number> = {}): InlineParams {
  const storage = {...init};
  function set(key: string, value: number) {
    if (Object.hasOwn(storage, key) && value !== storage[key])
      throw new Error(`Param ${key} already set to ${JSON.stringify(storage[key])}, ` +
        `cannot set to ${JSON.stringify(value)}`);
    storage[key] = value;
    return value;
  }
  return new Proxy(storage, {
    set: (target, key, value) => {
      if (typeof key !== "string") {
        // deno-lint-ignore no-explicit-any
        target[key as any] = value;
        return true;
      }
      set(key, value);
      return true;
    },
    get: (target, key) => {
      if (typeof key !== "string")
        // deno-lint-ignore no-explicit-any
        return target[key as any];
      const wrapper = (value: number) => set(key, value);
      // deno-lint-ignore no-explicit-any
      (wrapper as any)[Symbol.toPrimitive] = () => {
        if (!Object.hasOwn(storage, key))
          throw new Error(`Param ${key} not set yet, set it by calling params.${key}(value)`);
        const value = storage[key];
        return value;
      };
      return wrapper;
    },
  }) as InlineParams;
}

type ConstructedParams<P extends object> = P & {
  <P2 extends object>(paramsFunc: P2 | ((p: P) => P2)): ConstructedParams<P & P2>,
};

function mergeValue(key: string, v1: unknown, v2: unknown) {
  if (Array.isArray(v1)) {
    if (!Array.isArray(v2))
      throw new Error(`Cannot merge array with non-array for key ${key}`);
    return [...v1, ...v2];
  }
  if (typeof v1 === "object") {
    if (typeof v2 !== "object")
      throw new Error(`Cannot merge object with non-object for key ${key}`);
    if (v2 == null)
      return v1;
    if (v1 == null)
      return v2;
    return mergeParams(v1, v2);
  }
  throw new Error(`Cannot merge values for key ${key}, can only merge objects and arrays`);
}

function mergeParams<P1 extends object, P2 extends object>(p1: P1, p2: P2): P1 & P2 {
  const result = {...p1, ...p2};
  const p1Keys = new Set(Object.keys(p1));
  for (const [key, p2Value] of Object.entries(p2))
    if (p1Keys.has(key))
      (result as Record<string, unknown>)[key] =
        mergeValue(key, (p1 as Record<string, unknown>)[key], p2Value);
  return result;
}

/**
 * Creates a type-safe params object, with the ability to create params
 * based on other params.
 *
 * Usage example:
 *
 *     const p = createParams({
 *       side: 5,
 *     })(p => ({
 *       side2: 2 * p.side,
 *     });
 *
 * This sets `p.side` to 5 and `p.side2` to 10.
 */
export function createParams<P extends object>(params: P): ConstructedParams<P> {
  return Object.assign(
    <P2 extends object>(arg: P2 | ((p: P) => P2)) =>
      createParams(mergeParams(
        params,
        typeof arg === "function" ? arg(params) : arg,
      )),
    params,
  );
}
