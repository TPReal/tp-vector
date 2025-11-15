export {};

declare global {
  interface ArrayConstructor {
    // Improve type inference for Array.isArray on readonly arrays.
    isArray<T>(arg: ReadonlyArray<T> | unknown): arg is ReadonlyArray<T>;
  }
}
