/**
 * One JSON value under one Web Storage key, kept in memory for the page's life
 * instead while the storage cannot hold it (blocked site data): the no-repeat
 * window (recent.ts) and the words drill's pass (words.ts). Clear forgets the
 * stored value and the memory copy alike.
 */
export interface WebStorageSlot<T> {
  /** The value; undefined when none is stored or `parse` rejects the stored copy (garbled reads as none). */
  read(): T | undefined;
  /** Replaces the value, in Web Storage when it can hold it and in memory otherwise. */
  write(value: T): void;
  /** Forgets the value, stored or in memory. */
  clear(): void;
}

/**
 * The slot for `key` in `area`. `parse` takes the parsed JSON and returns the
 * value, or undefined when it does not have the value's shape.
 */
export function webStorageSlot<T>(
  area: 'localStorage' | 'sessionStorage',
  key: string,
  parse: (stored: unknown) => T | undefined,
): WebStorageSlot<T> {
  /** The value as last written while Web Storage could not hold it; undefined while storage holds it. */
  let unstored: T | undefined;
  return {
    read() {
      if (unstored !== undefined) return unstored;
      try {
        const raw = globalThis[area].getItem(key);
        return raw === null ? undefined : parse(JSON.parse(raw));
      } catch {
        return undefined;
      }
    },
    write(value) {
      try {
        globalThis[area].setItem(key, JSON.stringify(value));
        unstored = undefined;
      } catch {
        unstored = value;
      }
    },
    clear() {
      unstored = undefined;
      try {
        globalThis[area]?.removeItem(key);
      } catch {
        // Web Storage blocked: the memory copy above was the only value.
      }
    },
  };
}
