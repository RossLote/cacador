import { useState } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router';
import { DockContext, useFooterScrollPadding } from '@/components/nav/dock';
import { TabBar } from '@/components/nav/TabBar';
import { showsTabBar } from '@/components/nav/tabs';
import { ExamPage } from '@/exam/ExamPage';
import { FlaggedPage } from '@/flagged/FlaggedPage';
import { HomePage } from '@/home/HomePage';
import { NotFoundPage } from '@/notfound/NotFoundPage';
import { PracticePage } from '@/practice/PracticePage';
import { ProgressPage } from '@/progress/ProgressPage';
import { SettingsPage } from '@/settings/SettingsPage';

/**
 * The shared frame (DESIGN.md § 8.2, epic cac-8cn D5): one phone-first column
 * with the 20 px gutter, and the footer held to the bottom of the viewport:
 * the dock (cac-2tb), empty unless a screen portals its controls into it, over
 * the tab bar, which shows on every route but /exam itself. The footer is
 * sticky at the end of the column, so it takes its own room under the content
 * and nothing hides behind it at the bottom of the page. The back control to
 * Home is no longer here: every page but Home opens with its own ScreenHeader,
 * which carries it.
 */
function Layout() {
  const tabBar = showsTabBar(useLocation().pathname);
  const [dock, setDock] = useState<HTMLElement | null>(null);
  const [footer, setFooter] = useState<HTMLElement | null>(null);
  useFooterScrollPadding(footer);
  return (
    <DockContext value={dock}>
      <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pt-4">
        <main className="flex-1 pb-8">
          <Outlet />
        </main>
        <div ref={setFooter} className="sticky bottom-0 z-10 -mx-5">
          <div ref={setDock} />
          {tabBar && <TabBar />}
        </div>
      </div>
    </DockContext>
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
