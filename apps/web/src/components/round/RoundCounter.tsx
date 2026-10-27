/**
 * A round's counter in the screen header's right-hand slot (DESIGN.md § 6.4,
 * § 6.11), "3 of 10" in Fraunces 26 px: Practice's round and the words drill
 * each pass their own words.
 */
export function RoundCounter({ label }: { label: string }) {
  return <p className="shrink-0 pr-0.5 font-heading text-[26px] leading-none font-semibold tabular-nums">{label}</p>;
}
