import { questionById } from '@cacador/data';
import { useCallback, useEffect, useState } from 'react';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n/useI18n';
import { useLoaded } from '@/lib/useLoaded';
import { listFlags, removeFlag, type Flag } from '@/storage';
import { formatFlags } from './copyFormat';

const COPIED_MS = 2000;

type CopyState = 'idle' | 'copied' | 'failed';

/** Flagged (DESIGN.md § 6.7): every flag newest first, with Copy and Share of the same plain text and a clear on each. */
export function FlaggedPage() {
  const { t } = useI18n();
  const { data: flags, failed, set: setFlags } = useLoaded(listFlags);
  const [copy, setCopy] = useState<CopyState>('idle');
  /** A clear that storage refused: the page says so even when the list reads again fine (DESIGN.md § 6.9). */
  const [clearFailed, setClearFailed] = useState(false);
  const canShare = typeof navigator.share === 'function';

  useEffect(() => {
    if (copy === 'idle') return;
    const timer = setTimeout(() => setCopy('idle'), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copy]);

  const clear = useCallback(
    async (flag: Flag) => {
      try {
        await removeFlag(flag.questionId, flag.kind);
        setFlags(await listFlags());
      } catch {
        setClearFailed(true);
      }
    },
    [setFlags],
  );

  const list = flags ?? [];

  // The text is made at the tap, so its header carries the date of the tap (§ 6.7), not of the last render.
  async function copyText() {
    try {
      await navigator.clipboard.writeText(formatFlags(list));
      setCopy('copied');
    } catch {
      setCopy('failed');
    }
  }

  async function shareText() {
    try {
      await navigator.share({ text: formatFlags(list) });
    } catch {
      // Closing the share sheet rejects too; nothing to say.
    }
  }

  const kindLabel = (flag: Flag) => (flag.kind === 'translation' ? t.flagged.kindEnglish : t.flagged.kindHint);

  return (
    <section className="flex flex-col gap-4">
      <ScreenHeader title={t.flagged.title} />

      <div className="flex gap-2">
        <Button size="lg" className="flex-1" disabled={list.length === 0} onClick={() => void copyText()}>
          {t.flagged.copy}
        </Button>
        {canShare && (
          <Button variant="secondary" size="lg" className="flex-1" disabled={list.length === 0} onClick={() => void shareText()}>
            {t.flagged.share}
          </Button>
        )}
      </div>
      <span role="status" className="text-sm text-muted-foreground empty:hidden">
        {copy === 'copied' ? t.flagged.copied : copy === 'failed' ? t.flagged.copyFailed : ''}
      </span>

      {failed || clearFailed ? (
        <p role="status" className="text-muted-foreground">
          {t.flagged.loadFailed}
        </p>
      ) : flags === undefined ? (
        <p role="status" className="text-muted-foreground">
          {t.flagged.loading}
        </p>
      ) : list.length === 0 ? (
        <p className="text-muted-foreground">{t.flagged.empty}</p>
      ) : (
        <ul aria-label={t.flagged.list} className="flex flex-col gap-2">
          {list.map((flag) => (
            <li key={`${flag.questionId}-${flag.kind}`}>
              <div className="flex items-start justify-between gap-3 rounded-md border border-line bg-card px-3.5 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="flex items-center gap-2">
                    <span className="font-heading text-base font-semibold">{t.flagged.questionNumber(flag.questionId)}</span>
                    <span className="sr-only"> · </span>
                    <Badge variant="outline">{kindLabel(flag)}</Badge>
                  </p>
                  <p>{flag.note.trim() === '' ? <span className="text-muted-foreground">{t.flagged.noNote}</span> : flag.note}</p>
                  <p lang="pt-PT" className="text-sm text-muted-foreground">
                    {questionById(flag.questionId)?.question}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={t.flagged.clearLabel(flag.questionId, kindLabel(flag))}
                  onClick={() => void clear(flag)}
                >
                  {t.flagged.clear}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
