import { localDateKey } from '@/model';
import type { Flag, FlagKind } from '@/storage';

/**
 * The text Copy and Share put out (DESIGN.md § 6.7, phase 4 D2): a machine format
 * for an agent to read, the same English in every interface language. Its labels
 * live here as constants and not in the messages files, the one exception to the
 * rule that components hold no user-facing text.
 */
const COPY_HEADER = 'Caçador flags';

const COPY_KIND_LABEL: Record<FlagKind, string> = {
  translation: 'English',
  hint: 'Hint',
};

/** `#<id> English: <note>` or `#<id> Hint: <note>`; with an empty note just `#<id> English` or `#<id> Hint`. */
export function formatFlagLine(flag: Flag): string {
  const label = `#${flag.questionId} ${COPY_KIND_LABEL[flag.kind]}`;
  const note = flag.note.trim();
  return note === '' ? label : `${label}: ${note}`;
}

/** The header line with the device's local date, then one line per flag in the order given. */
export function formatFlags(flags: readonly Flag[], now: number = Date.now()): string {
  return [`${COPY_HEADER} ${localDateKey(now)}`, ...flags.map(formatFlagLine)].join('\n');
}
