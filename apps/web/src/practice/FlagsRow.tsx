import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n/useI18n';
import { getFlags, removeFlag, setFlag, type Flag, type FlagKind } from '@/storage';
import { OWN_KEYS_ATTRIBUTE } from './usePracticeKeys';

const KINDS: readonly FlagKind[] = ['translation', 'hint'];

/** One kind's flag on this question: its saved note, the draft in the field, and whether the field is open. */
interface KindState {
  saved: string;
  draft: string;
  open: boolean;
  /** The saved note was just written by Save. */
  justSaved: boolean;
}

type FlagState = Partial<Record<FlagKind, KindState>>;

/** The row as stored: every stored kind set, its note saved and in the field, the field closed. */
function fromFlags(flags: readonly Flag[]): FlagState {
  const state: FlagState = {};
  for (const flag of flags) state[flag.kind] = { saved: flag.note, draft: flag.note, open: false, justSaved: false };
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
 * shows and the writes land in tap order. A failed write puts the row back to
 * what is stored.
 */
export function FlagsRow({ questionId }: { questionId: number }) {
  const { t } = useI18n();
  const words = t.practice.flags;
  const [state, setState] = useState<FlagState>({});
  const [loaded, setLoaded] = useState(false);
  const idPrefix = useId();
  /** The row's writes, chained so they land in the order they were asked for. */
  const writes = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let current = true;
    void getFlags(questionId)
      .then((flags) => {
        if (current) setState(fromFlags(flags));
      })
      .catch(() => undefined)
      .finally(() => {
        if (current) setLoaded(true);
      });
    return () => {
      current = false;
    };
  }, [questionId]);

  const patch = (kind: FlagKind, change: Partial<KindState>) =>
    setState((previous) => {
      const kept = previous[kind];
      return kept === undefined ? previous : { ...previous, [kind]: { ...kept, ...change } };
    });

  /** Runs `write` once the row's earlier writes have landed; if it fails, the row goes back to what is stored. */
  const queue = (write: () => Promise<unknown>) => {
    writes.current = writes.current
      .then(write)
      .then(
        () => undefined,
        () =>
          getFlags(questionId).then(
            (flags) => setState(fromFlags(flags)),
            () => undefined,
          ),
      );
  };

  const toggle = (kind: FlagKind) => {
    if (state[kind] === undefined) {
      setState((previous) => ({ ...previous, [kind]: { saved: '', draft: '', open: true, justSaved: false } }));
      queue(() => setFlag(questionId, kind, ''));
    } else {
      setState((previous) => ({ ...previous, [kind]: undefined }));
      queue(() => removeFlag(questionId, kind));
    }
  };

  /** Stores the note in the field; "Saved" shows once the write has landed. */
  const save = (kind: FlagKind) => {
    const draft = state[kind]?.draft ?? '';
    queue(() => setFlag(questionId, kind, draft).then(() => patch(kind, { saved: draft, justSaved: true })));
  };

  const label = (kind: FlagKind) => (kind === 'translation' ? words.englishOff : words.hintOff);
  const noteLabel = (kind: FlagKind) => (kind === 'translation' ? words.englishNote : words.hintNote);

  return (
    <div role="group" aria-label={words.group} {...{ [OWN_KEYS_ATTRIBUTE]: '' }} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {KINDS.map((kind) => (
          <Button
            key={kind}
            type="button"
            variant={state[kind] === undefined ? 'outline' : 'default'}
            aria-pressed={state[kind] !== undefined}
            disabled={!loaded}
            onClick={() => toggle(kind)}
          >
            {label(kind)}
          </Button>
        ))}
      </div>
      {KINDS.map((kind) => {
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
    </div>
  );
}
