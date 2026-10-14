import { useId, useRef, useState, type ChangeEvent, type MouseEvent } from 'react';
import { ScreenHeader } from '@/components/nav/ScreenHeader';
import { CHIP, PLATE } from '@/components/styles';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { FlaggedLink } from '@/flagged/FlaggedLink';
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES } from '@/i18n/locales';
import { useI18n } from '@/i18n/useI18n';
import { useLoaded } from '@/lib/useLoaded';
import { cn } from '@/lib/utils';
import { clearProgress, importProgress, storageMode, type ImportCounts } from '@/storage';
import { canShareProgressFile, downloadFile, makeProgressFile } from './progressFile';

/** What the progress line says after the last action. */
type Outcome =
  | { kind: 'importing' }
  | { kind: 'imported'; added: ImportCounts }
  | { kind: 'refused' }
  | { kind: 'cleared' }
  /** Storage could not be read or written. */
  | { kind: 'failed' };

/** The file's text, or undefined when it cannot be read. */
async function readText(file: File): Promise<string | undefined> {
  try {
    return await file.text();
  } catch {
    return undefined;
  }
}

/**
 * Settings (DESIGN.md § 6.8): the language, Export (with the share sheet where
 * it takes files), Import with the counts added, Clear progress behind a
 * confirm, the not-saving line when storage runs in memory (D16), and a link
 * to Flagged.
 */
export function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const inMemory = useLoaded(storageMode).data === 'memory';
  const [outcome, setOutcome] = useState<Outcome | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [canShare] = useState(canShareProgressFile);
  const fileInput = useRef<HTMLInputElement>(null);
  const languageId = useId();
  const progressId = useId();

  /**
   * The file Share hands over, made fresh for each tap but started on the
   * press (pointerdown), so the read of the whole log runs while the finger is
   * down and navigator.share still falls inside the tap's user activation,
   * which a browser may let expire. Like Export's, it holds what the device
   * holds and today's date at the moment of the tap. Only the click that press
   * produces uses it: a press the browser takes over (pointercancel, a scroll)
   * drops it, and a keyboard click (detail 0), which has no press of its own,
   * always makes a fresh file, so a press dragged off Share never leaves an
   * older file for a later Share.
   */
  const shareFile = useRef<Promise<File>>(undefined);
  const prepareShare = () => {
    shareFile.current = makeProgressFile();
    // Its failure is reported by the click that uses it.
    shareFile.current.catch(() => undefined);
  };
  const dropShare = () => {
    shareFile.current = undefined;
  };

  /** A new Export or Share starts with no line from the last action (an import still running keeps its own). */
  const startAction = () => setOutcome((current) => (current?.kind === 'importing' ? current : undefined));

  async function exportFile() {
    startAction();
    try {
      downloadFile(await makeProgressFile());
    } catch {
      setOutcome({ kind: 'failed' });
    }
  }

  async function share(event: MouseEvent) {
    startAction();
    const pressed = event.detail === 0 ? undefined : shareFile.current;
    shareFile.current = undefined;
    const pending = pressed ?? makeProgressFile();
    let file: File;
    try {
      file = await pending;
    } catch {
      setOutcome({ kind: 'failed' });
      return;
    }
    try {
      await navigator.share({ files: [file], title: t.settings.shareTitle });
    } catch {
      // Closing the share sheet rejects too; nothing to say.
    }
  }

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    setOutcome({ kind: 'importing' });
    const text = await readText(file);
    try {
      // An unreadable file is refused like any other that is not an export.
      const result = text === undefined ? undefined : await importProgress(text);
      setOutcome(result?.ok ? { kind: 'imported', added: result.added } : { kind: 'refused' });
    } catch {
      setOutcome({ kind: 'failed' });
    }
    // Lets the same file be chosen again.
    input.value = '';
  }

  async function clear() {
    try {
      await clearProgress();
      setOutcome({ kind: 'cleared' });
    } catch {
      setOutcome({ kind: 'failed' });
    }
    setConfirming(false);
  }

  function outcomeText(): string {
    switch (outcome?.kind) {
      case undefined:
        return '';
      case 'importing':
        return t.settings.importing;
      case 'imported':
        return t.settings.imported(outcome.added.answers, outcome.added.exams, outcome.added.flags);
      case 'refused':
        return t.settings.importRefused;
      case 'cleared':
        return t.settings.cleared;
      case 'failed':
        return t.settings.failed;
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <ScreenHeader title={t.settings.title} />

      {inMemory && (
        <p className="rounded-lg border border-rust bg-clay px-4 py-3 text-sm text-ink">
          {t.settings.notSaving}
        </p>
      )}

      <section aria-labelledby={languageId} className={cn('flex flex-col gap-2.5', PLATE)}>
        <h2 id={languageId} className="eyebrow">
          {t.settings.language}
        </h2>
        <div role="group" aria-labelledby={languageId} className="grid grid-cols-2 gap-2">
          {LOCALES.map((code) => (
            <Button
              key={code}
              lang={LOCALE_TAGS[code]}
              variant="outline"
              className={CHIP}
              aria-pressed={code === locale}
              onClick={() => setLocale(code)}
            >
              {LOCALE_NAMES[code]}
            </Button>
          ))}
        </div>
      </section>

      <section aria-labelledby={progressId} className={cn('flex flex-col gap-2.5', PLATE)}>
        <h2 id={progressId} className="eyebrow">
          {t.settings.progress}
        </h2>
        <p className="text-sm text-muted-foreground">{t.settings.progressHelp}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="lg" className="flex-1" onClick={() => void exportFile()}>
            {t.settings.export}
          </Button>
          {canShare && (
            <Button
              variant="secondary"
              size="lg"
              className="flex-1"
              onPointerDown={prepareShare}
              onPointerCancel={dropShare}
              onClick={(event) => void share(event)}
            >
              {t.settings.share}
            </Button>
          )}
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            disabled={outcome?.kind === 'importing'}
            onClick={() => fileInput.current?.click()}
          >
            {t.settings.import}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            aria-label={t.settings.importFile}
            hidden
            onChange={(event) => void importFile(event)}
          />
        </div>
        <p role="status" className="text-sm empty:hidden">
          {outcomeText()}
        </p>

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogTrigger render={<Button variant="destructive" size="lg" />}>{t.settings.clear}</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.settings.clearTitle}</AlertDialogTitle>
              <AlertDialogDescription>{t.settings.clearDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.settings.clearCancel}</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={() => void clear()}>
                {t.settings.clearConfirm}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      <FlaggedLink>{t.settings.flaggedLink}</FlaggedLink>
    </section>
  );
}
