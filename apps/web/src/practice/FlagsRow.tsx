import { useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/i18n/useI18n';
import { getFlags, removeFlag, setFlag, type FlagKind } from '@/storage';
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

/**
 * The flags row (D2), shown under the result once a practice question is
 * answered: "English is off" (kind translation) and "Hint is off" (kind hint).
 * A tap on an unset kind stores the flag at once with an empty note and opens
 * a one-line note field; Save updates the note; a tap on a set kind removes
 * the flag. A question drawn again shows its stored flags as set. Render it
 * keyed by question id.
 */
export function FlagsRow({ questionId }: { questionId: number }) {
  const { t } = useI18n();
  const words = t.practice.flags;
  const [state, setState] = useState<FlagState>({});
  const [loaded, setLoaded] = useState(false);
  const idPrefix = useId();

  useEffect(() => {
    let current = true;
    void getFlags(questionId)
      .then((flags) => {
        if (!current) return;
        const next: FlagState = {};
        for (const flag of flags) next[flag.kind] = { saved: flag.note, draft: flag.note, open: false, justSaved: false };
        setState(next);
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

  const toggle = (kind: FlagKind) => {
    if (state[kind] === undefined) {
      void setFlag(questionId, kind, '')
        .then(() => setState((previous) => ({ ...previous, [kind]: { saved: '', draft: '', open: true, justSaved: false } })))
        .catch(() => undefined);
    } else {
      void removeFlag(questionId, kind)
        .then(() => setState((previous) => ({ ...previous, [kind]: undefined })))
        .catch(() => undefined);
    }
  };

  const save = (kind: FlagKind) => {
    const draft = state[kind]?.draft ?? '';
    void setFlag(questionId, kind, draft)
      .then(() => patch(kind, { saved: draft, justSaved: true }))
      .catch(() => undefined);
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
