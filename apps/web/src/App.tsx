import { Outlet, Route, Routes, useLocation } from 'react-router';
import { TabBar } from '@/components/nav/TabBar';
import { showsTabBar } from '@/components/nav/tabs';
import { ExamPage } from '@/exam/ExamPage';
import { FlaggedPage } from '@/flagged/FlaggedPage';
import { HomePage } from '@/home/HomePage';
import { cn } from '@/lib/utils';
import { NotFoundPage } from '@/notfound/NotFoundPage';
import { PracticePage } from '@/practice/PracticePage';
import { ProgressPage } from '@/progress/ProgressPage';
import { SettingsPage } from '@/settings/SettingsPage';

/**
 * The shared frame (DESIGN.md § 8.2, epic cac-8cn D5): one phone-first column
 * with the 20 px gutter, and the tab bar fixed along the bottom on every route
 * but /exam itself, with room left under the content so nothing hides behind
 * it. The back control to Home is no longer here: every page but Home opens
 * with its own ScreenHeader, which carries it.
 */
function Layout() {
  const tabBar = showsTabBar(useLocation().pathname);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pt-4">
      <main className={cn('flex-1', tabBar ? 'pb-[calc(6.5rem+env(safe-area-inset-bottom))]' : 'pb-8')}>
        <Outlet />
      </main>
      {tabBar && <TabBar />}
    </div>
  );
}

/** The routes under the /cacador/ basename (D19). Each screen's page lives in its own folder; any other address gets the not-found page, inside the layout so it shows the tab bar, under its own header with the back control. */
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
