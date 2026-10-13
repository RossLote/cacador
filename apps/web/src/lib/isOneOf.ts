/** A type guard for "one of `list`", for narrowing a value read from outside (a query parameter, a file) to a closed set. */
export const isOneOf =
  <T>(list: readonly T[]) =>
  (value: unknown): value is T =>
    list.some((item) => item === value);
