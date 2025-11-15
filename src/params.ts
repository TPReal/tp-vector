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
export function createInlineParams(init: Readonly<Record<string, number>> = {}): InlineParams {
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

function mergeParams<P1 extends object, P2 extends object>(p1: P1, p2: P2): P1 & P2 {
  const result = {...p1, ...p2};
  for (const [key, p2Value] of Object.entries(p2))
    if (Object.hasOwn(p1, key))
      (result as Record<string, unknown>)[key] =
        mergeValue(key, (p1 as Record<string, unknown>)[key], p2Value);
  return result;
}

function mergeValue(key: string, v1: unknown, v2: unknown) {
  if (v1 == undefined)
    return v2;
  if (v2 == undefined)
    return v1;
  if (typeof v1 === "object" && !Array.isArray(v1) && typeof v2 === "object" && !Array.isArray(v2))
    return mergeParams(v1, v2);
  throw new Error(`Cannot merge values for key ${key}, can only merge objects`);
}

/**
 * Creates a type-safe params object, with the ability to create params based on other params.
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
  const result = Object.assign(
    <P2 extends object>(arg: P2 | ((p: P) => P2)) =>
      createParams(mergeParams(params, typeof arg === "function" ? arg(params) : arg)),
    params,
  );
  result.toString = () => JSON.stringify(params);
  return result;
}

interface NumParamsType {
  readonly [key: string]: number | NumParamsType | undefined;
}

// deno-lint-ignore no-explicit-any
type NumParamsArgType = {readonly [key: string]: number & NumParamsArgType & any};

type NumParamsInput<P extends NumParamsType> = P | ((p: NumParamsArgType, helpers: {assert: typeof numParamsAssert}) => P);

type IsAny<T> = boolean extends (T extends never ? true : false) ? true : false;
/**
 * Replaces the any-typed values caused by referencing the parameter of NumParamsInput
 * with the number type.
 */
type ReplaceAnys<P extends NumParamsType> = {
  [K in keyof P]: IsAny<P[K]> extends true ? number : P[K] extends NumParamsType ? ReplaceAnys<P[K]> : P[K];
};

function mergeNumParams<P extends NumParamsType, R extends NumParamsType>(
  base: P, params: NumParamsInput<R>): ReplaceAnys<P & R> {
  function toPrimitive(hint: string) {
    return hint === "string" ? "??" : NaN;
  }
  function merge(p1: NumParamsType, p2: NumParamsType) {
    const result: {-readonly [K in keyof NumParamsType]: NumParamsType[K]} = {...p1};
    for (const [key, value2] of Object.entries(p2)) {
      if (value2 == undefined)
        continue;
      let v2 = value2;
      if ((v2 as {[Symbol.toPrimitive]?: unknown})[Symbol.toPrimitive] === toPrimitive)
        v2 = Number.NaN;
      const v1 = result[key];
      result[key] = (() => {
        if (typeof v2 === "number") {
          if (v1 === undefined)
            return v2;
          if (typeof v1 === "number") {
            if (!Number.isNaN(v1) && v2 !== v1)
              throw new Error(`Unstable value for key ${key}, ${v1} -> ${v2}`);
            return v2;
          }
        }
        if (typeof v2 === "object" && (v1 === undefined || typeof v1 === "object"))
          return merge(v1 || {}, v2);
        throw new Error(`Cannot merge values for key ${key}, can only merge objects`);
      })();
    }
    return result as NumParamsType;
  }
  if (typeof params === "function") {
    let missCount = 0;
    const handler: ProxyHandler<NumParamsType> = {
      get: (target, key) => {
        if (key === Symbol.toPrimitive)
          return toPrimitive;
        if (typeof key !== "string")
          throw new Error(`Expected string key, got: ${String(key)}`);
        if (!Object.hasOwn(target, key)) {
          missCount++;
          return wrap({});
        }
        const val = target[key];
        if (val === undefined) {
          return undefined;
        }
        if (typeof val === "number") {
          if (Number.isNaN(val))
            missCount++;
          return val;
        }
        if (typeof val === "object" && !Array.isArray(val))
          return wrap(val);
        throw new Error(`Expected number or number params, got: ${val} (key: ${key})`);
      }
    };
    function wrap(target: NumParamsType) {
      return new Proxy(target, handler);
    }
    let lastMissCount = Number.POSITIVE_INFINITY;
    let current = base;
    for (; ;) {
      missCount = 0;
      const processed = params(wrap(current), {assert: numParamsAssert});
      if (!missCount)
        return merge(base, processed) as ReplaceAnys<P & R>;
      if (missCount >= lastMissCount) {
        const badKeys: string[][] = [];
        function findBadKeys(keys: readonly string[], val: NumParamsType) {
          for (const [key, value] of Object.entries(val)) {
            if (Number.isNaN(value))
              badKeys.push([...keys, key]);
            else if (value && typeof value === "object")
              findBadKeys([...keys, key], value);
          }
        }
        findBadKeys([], processed);
        throw new Error(`Cannot compute numeric params, bad keys: ${badKeys.map(k => k.join(".")).join(", ")}`);
      }
      lastMissCount = missCount;
      current = merge(current, processed) as P & R;
    }
  } else
    return merge(base, params) as ReplaceAnys<P & R>;
}

type NumParams<P extends NumParamsType> = P & {
  andThen<R extends NumParamsType>(params: NumParamsInput<R>): NumParams<P & R>;
  andThenParams<R extends object>(params: R | ((p: P) => R)): ConstructedParams<P & R>;
};

class NumParamsImpl<P extends NumParamsType> {
  protected constructor(params: P) {
    Object.assign(this, params);
  }

  static create<P extends NumParamsType>(params: P) {
    return new NumParamsImpl(params) as unknown as NumParams<P>;
  }

  andThen<R extends NumParamsType>(params: NumParamsInput<R>) {
    return NumParamsImpl.create(mergeNumParams(this as unknown as NumParams<P>, params));
  }

  andThenParams<R extends object>(params: R | ((p: P) => R)) {
    return createParams({...this} as unknown as P)(params);
  }
}

/**
 * Creates a numeric params object, with the ability to create params based on other params.
 *
 * Usage example:
 *
 *     const p = createNumParams(p => ({
 *       side: 5,
 *       side2: 2 * p.side,
 *     }));
 *
 * This sets `p.side` to 5 and `p.side2` to 10.
 */
export function createNumParams<P extends NumParamsType>(params: NumParamsInput<P>) {
  return NumParamsImpl.create(mergeNumParams({}, params));
}

export namespace numParamsAssert {

  export function gt(value: number, reference: number, message = `Expected value greater than reference`) {
    reference = Number(reference);
    if (Number.isNaN(reference))
      return Number.NaN;
    return assert(value, v => v > reference, `${message} (value: ${value}, reference: ${reference})`);
  }

  export function lt(value: number, reference: number, message = `Expected value less than reference`) {
    reference = Number(reference);
    if (Number.isNaN(reference))
      return Number.NaN;
    return assert(value, v => v < reference, `${message} (value: ${value}, reference: ${reference})`);
  }

  export function gte(value: number, reference: number, message = `Expected value greater than or equal to reference`) {
    reference = Number(reference);
    if (Number.isNaN(reference))
      return Number.NaN;
    return assert(value, v => v >= reference, `${message} (value: ${value}, reference: ${reference})`);
  }

  export function lte(value: number, reference: number, message = `Expected value less than or equal to reference`) {
    reference = Number(reference);
    if (Number.isNaN(reference))
      return Number.NaN;
    return assert(value, v => v <= reference, `${message} (value: ${value}, reference: ${reference})`);
  }

  export function pos(value: number, message = `Expected positive value`) {
    return assert(value, v => v > 0, `${message} (value: ${value})`);
  }

  export function nonNeg(value: number, message = `Expected non-negative value`) {
    return assert(value, v => v >= 0, `${message} (value: ${value})`);
  }

  export function assert(value: number, predicate: (v: number) => boolean, message = `Expected value to satisfy the predicate`) {
    if (Number.isNaN(value))
      return Number.NaN;
    if (!predicate(value))
      throw new Error(message);
    return value;
  }

}
