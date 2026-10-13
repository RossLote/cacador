import { useCallback, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n/useI18n';
import { useLoaded } from '@/lib/useLoaded';
import { FLAG_KINDS, getFlags, removeFlag, setFlag, type Flag, type FlagKind } from '@/storage';
import { OWN_KEYS_ATTRIBUTE } from './usePracticeKeys';

/** One kind's flag on this question: the draft in the note field, and whether the field is open. */
interface KindState {
  draft: string;
  open: boolean;
  /** The saved note was just written by Save. */
  justSaved: boolean;
}

type FlagState = Partial<Record<FlagKind, KindState>>;

/**
 * The row as stored: every stored kind set and every other kind unset. A
 * stored kind whose note field is open in `shown` keeps the field and what is
 * typed in it; any other shows its stored note in a closed field.
 */
function fromFlags(flags: readonly Flag[], shown: FlagState = {}): FlagState {
  const state: FlagState = {};
  for (const flag of flags) {
    const kept = shown[flag.kind];
    state[flag.kind] = kept?.open ? kept : { draft: flag.note, open: false, justSaved: false };
  }
  return state;
}

/**
 * The flags row (D2), shown under the result once a practice question is
 * answered: "English is off" (kind translation) and "Hint is off" (kind hint).
 * A tap on an unset kind stores the flag at once with an empty note and opens
 * a one-line note field; Save updates the note; a tap on a set kind removes
 * the flag. A question drawn again shows its stored flags as set. Render it
 * keyed by question id.
 *
 * A tap changes the row at once and queues its write behind the row's earlier
 * ones, so a second tap before the first write lands acts on what the row
 * shows and the writes land in tap order. A failed write says so in one line
 * (DESIGN.md § 6.9) and, once the writes queued behind it have landed, the row
 * goes back to what is stored, keeping an open note field and its draft. A row
 * whose flags cannot be read, at first or after a failed write, says so and
 * keeps its buttons disabled rather than act on flags it does not know.
 */
export function FlagsRow({ questionId }: { questionId: number }) {
  const { t } = useI18n();
  const words = t.practice.flags;
  const load = useCallback(() => getFlags(questionId).then((flags) => fromFlags(flags)), [questionId]);
  /** Undefined until the stored flags are read; the buttons wait for them. */
  const { data: loadedState, failed: loadFailed, set: setState } = useLoaded(load);
  /** A write failed (DESIGN.md § 6.9). */
  const [saveFailed, setSaveFailed] = useState(false);
  /** The flags could not be read again after a failed write, so what is stored is unknown. */
  const [unknown, setUnknown] = useState(false);
  const usable = loadedState !== undefined && !loadFailed && !unknown;
  const state = usable ? loadedState : {};
  const idPrefix = useId();
  /** The row's writes, chained so they land in the order they were asked for. */
  const writes = useRef<Promise<void>>(Promise.resolve());
  /** How many writes have been queued; a write knows it is the last one queued when this still equals its own count. */
  const queued = useRef(0);
  /** A write failed, so the row is to be read again once the queue has drained. */
  const stale = useRef(false);

  const patch = (kind: FlagKind, change: Partial<KindState>) =>
    setState((previous = {}) => {
      const kept = previous[kind];
      return kept === undefined ? previous : { ...previous, [kind]: { ...kept, ...change } };
    });

  /**
   * Runs `write` once the row's earlier writes have landed. If any of them
   * failed, the last one queued reads the row back from storage after it has
   * landed; a read overtaken by a newer write is left for that write to redo.
   */
  const queue = (write: () => Promise<unknown>) => {
    const count = ++queued.current;
    const isLast = () => count === queued.current;
    writes.current = writes.current
      .then(write)
      .catch(() => {
        stale.current = true;
        setSaveFailed(true);
      })
      .then(async () => {
        if (!stale.current || !isLast()) return;
        stale.current = false;
        try {
          const flags = await getFlags(questionId);
          if (isLast()) setState((shown = {}) => fromFlags(flags, shown));
          else stale.current = true;
        } catch {
          setUnknown(true);
        }
      });
  };

  const toggle = (kind: FlagKind) => {
    if (state[kind] === undefined) {
      setState((previous) => ({ ...previous, [kind]: { draft: '', open: true, justSaved: false } }));
      queue(() => setFlag(questionId, kind, ''));
    } else {
      setState((previous) => ({ ...previous, [kind]: undefined }));
      queue(() => removeFlag(questionId, kind));
    }
  };

  /** Stores the note in the field; "Saved" shows once the write has landed, while the field still holds that note. */
  const save = (kind: FlagKind) => {
    const draft = state[kind]?.draft ?? '';
    queue(() =>
      setFlag(questionId, kind, draft).then(() =>
        setState((previous = {}) => {
          const kept = previous[kind];
          return kept?.draft === draft ? { ...previous, [kind]: { ...kept, justSaved: true } } : previous;
        }),
      ),
    );
  };

  const label = (kind: FlagKind) => (kind === 'translation' ? words.englishOff : words.hintOff);
  const noteLabel = (kind: FlagKind) => (kind === 'translation' ? words.englishNote : words.hintNote);

  return (
    <div role="group" aria-label={words.group} {...{ [OWN_KEYS_ATTRIBUTE]: '' }} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {FLAG_KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            variant={state[kind] === undefined ? 'outline' : 'default'}
            aria-pressed={state[kind] !== undefined}
            disabled={!usable}
            onClick={() => toggle(kind)}
          >
            {label(kind)}
          </Button>
        ))}
      </div>
      {FLAG_KINDS.map((kind) => {
        const flag = state[kind];
        if (flag === undefined || !flag.open) return null;
        const inputId = `${idPrefix}-${kind}`;
        return (
          <form
            key={kind}
            className="flex flex-col gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              save(kind);
            }}
          >
            <label htmlFor={inputId} className="text-sm font-medium">
              {noteLabel(kind)}
            </label>
            <div className="flex gap-2">
              <Input
                id={inputId}
                value={flag.draft}
                onChange={(event) => patch(kind, { draft: event.target.value, justSaved: false })}
              />
              <Button type="submit" variant="secondary">
                {words.save}
              </Button>
            </div>
            {flag.justSaved && (
              <p role="status" className="text-sm text-muted-foreground">
                {words.saved}
              </p>
            )}
          </form>
        );
      })}
      {(loadFailed || unknown || saveFailed) && (
        <p role="status" className="text-sm text-destructive">
          {loadFailed || unknown ? words.loadFailed : words.saveFailed}
        </p>
      )}
    </div>
  );
}
