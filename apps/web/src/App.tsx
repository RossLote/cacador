import { ArrowLeft } from 'lucide-react';
import { Link, Outlet, Route, Routes, useLocation } from 'react-router';
import { buttonVariants } from '@/components/ui/button';
import { ExamPage } from '@/exam/ExamPage';
import { FlaggedPage } from '@/flagged/FlaggedPage';
import { HomePage } from '@/home/HomePage';
import { useI18n } from '@/i18n/useI18n';
import { NotFoundPage } from '@/notfound/NotFoundPage';
import { PracticePage } from '@/practice/PracticePage';
import { ProgressPage } from '@/progress/ProgressPage';
import { SettingsPage } from '@/settings/SettingsPage';

/**
 * The shared frame (phase 4 D19): one phone-first column, and on every screen
 * but Home a back control to Home. Home is the hub; there is no bottom bar.
 */
function Layout() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-4 py-4">
      {pathname !== '/' && (
        <nav>
          <Link
            to="/"
            aria-label={t.common.backToHome}
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <ArrowLeft aria-hidden="true" />
            {t.common.nav.home}
          </Link>
        </nav>
      )}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

/** The routes under the /cacador/ basename (D19). Each screen's page lives in its own folder; any other address gets the not-found page, inside the layout so it keeps the back control. */
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="practice" element={<PracticePage />} />
        <Route path="exam/*" element={<ExamPage />} />
        <Route path="progress" element={<ProgressPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="flagged" element={<FlaggedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
