/**
 * Calendar days in the device's time zone. A leaf with no imports, so the e2e
 * suite can import it as it imports `random.ts`.
 */

/** A moment's calendar day in the device's time zone, as YYYY-MM-DD. */
export function localDateKey(at: number): string {
  const d = new Date(at);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}
