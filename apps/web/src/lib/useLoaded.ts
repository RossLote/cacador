import { useCallback, useEffect, useState } from 'react';

export interface Loaded<T> {
  /** What `load` resolved to; undefined until it has, and again while a new `load` runs. */
  data: T | undefined;
  /** Runs `load` again; `data` keeps its value until the new one arrives. */
  reload: () => void;
  /** Replaces `data` after a write the page made itself, with a value or, as useState's setter takes, an update of the current one. */
  set: (value: T | ((current: T | undefined) => T)) => void;
}

/**
 * Reads what a screen shows once it mounts: runs `load` and keeps its result.
 * `load` must keep its identity between renders (a module function, or a
 * useCallback over what it reads); a new one runs at once, and the result of
 * one that has been replaced, or of a component that has gone, is dropped.
 * A rejection is left to `load` to handle.
 */
export function useLoaded<T>(load: () => Promise<T>): Loaded<T> {
  const [loaded, setLoaded] = useState<{ load: () => Promise<T>; data: T }>();
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    void load().then((data) => {
      if (active) setLoaded({ load, data });
    });
    return () => {
      active = false;
    };
  }, [load, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const set = useCallback(
    (value: T | ((current: T | undefined) => T)) =>
      setLoaded((previous) => {
        const current = previous?.load === load ? previous.data : undefined;
        return { load, data: value instanceof Function ? value(current) : value };
      }),
    [load],
  );
  return { data: loaded?.load === load ? loaded.data : undefined, reload, set };
}
