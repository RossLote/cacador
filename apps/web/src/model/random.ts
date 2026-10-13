/**
 * A random source: a function returning a number in [0, 1), as Math.random does.
 * Every draw in the model takes one, so a test can pass a seeded source.
 */
export type RandomSource = () => number;

/**
 * A deterministic random source for tests (mulberry32): the same seed gives the
 * same sequence, two seeds give different ones.
 */
export function seededRandom(seed: number): RandomSource {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
