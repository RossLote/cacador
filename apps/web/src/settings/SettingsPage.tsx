import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
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
import { Button, buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { LOCALE_NAMES, LOCALE_TAGS, LOCALES } from '@/i18n/locales';
import { useI18n } from '@/i18n/useI18n';
import { cn } from '@/lib/utils';
import { clearProgress, importProgress, storageMode, type ImportCounts } from '@/storage';
import { canShareProgressFile, downloadFile, makeProgressFile } from './progressFile';

/** What the progress line says after the last action. */
type Outcome = { kind: 'importing' } | { kind: 'imported'; added: ImportCounts } | { kind: 'refused' } | { kind: 'cleared' };

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
  const [inMemory, setInMemory] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | undefined>();
  const [confirming, setConfirming] = useState(false);
  const [canShare] = useState(canShareProgressFile);
  const fileInput = useRef<HTMLInputElement>(null);
  const languageId = useId();
  const progressId = useId();

  useEffect(() => {
    let active = true;
    void storageMode().then((mode) => {
      if (active) setInMemory(mode === 'memory');
    });
    return () => {
      active = false;
    };
  }, []);

  async function exportFile() {
    downloadFile(await makeProgressFile());
  }

  async function shareFile() {
    const file = await makeProgressFile();
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
    // An unreadable file is refused like any other that is not an export.
    const result = text === undefined ? undefined : await importProgress(text);
    setOutcome(result?.ok ? { kind: 'imported', added: result.added } : { kind: 'refused' });
    // Lets the same file be chosen again.
    input.value = '';
  }

  async function clear() {
    await clearProgress();
    setConfirming(false);
    setOutcome({ kind: 'cleared' });
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
    }
  }

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t.settings.title}</h1>

      {inMemory && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-foreground">
          {t.settings.notSaving}
        </p>
      )}

      <section aria-labelledby={languageId} className="flex flex-col gap-3">
        <h2 id={languageId} className="text-lg font-medium">
          {t.settings.language}
        </h2>
        <div role="group" aria-labelledby={languageId} className="grid grid-cols-2 gap-2">
          {LOCALES.map((code) => (
            <Button
              key={code}
              lang={LOCALE_TAGS[code]}
              size="lg"
              variant={code === locale ? 'default' : 'outline'}
              aria-pressed={code === locale}
              onClick={() => setLocale(code)}
            >
              {LOCALE_NAMES[code]}
            </Button>
          ))}
        </div>
      </section>

      <Separator />

      <section aria-labelledby={progressId} className="flex flex-col gap-3">
        <h2 id={progressId} className="text-lg font-medium">
          {t.settings.progress}
        </h2>
        <p className="text-sm text-muted-foreground">{t.settings.progressHelp}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={() => void exportFile()}>
            {t.settings.export}
          </Button>
          {canShare && (
            <Button variant="outline" size="lg" className="flex-1" onClick={() => void shareFile()}>
              {t.settings.share}
            </Button>
          )}
          <Button
            variant="outline"
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

      <Separator />

      {/* buttonVariants alone does not merge classes, so outline's border would lose to the base's border-transparent. */}
      <Link to="/flagged" className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}>
        {t.settings.flaggedLink}
      </Link>
    </section>
  );
}
