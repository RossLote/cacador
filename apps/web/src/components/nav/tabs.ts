import { ChartNoAxesColumn, House, Target, Timer, type LucideIcon } from 'lucide-react';

/** A destination of the tab bar: its path, its word in `common.nav` and its icon (DESIGN.md § 6.3, D5). */
export interface Tab {
  to: string;
  label: 'home' | 'practice' | 'exam' | 'progress';
  Icon: LucideIcon;
}

/** The four tabs, in order. There is never a fifth. */
export const TABS: readonly Tab[] = [
  { to: '/', label: 'home', Icon: House },
  { to: '/practice', label: 'practice', Icon: Target },
  { to: '/exam', label: 'exam', Icon: Timer },
  { to: '/progress', label: 'progress', Icon: ChartNoAxesColumn },
];

/**
 * The pathname without its trailing slashes and in lower case, so /practice/ and /Practice are /practice and the
 * root stays /: the router matches its paths regardless of case, so /Exam is the running exam too (cac-8cn.12).
 */
function normalise(pathname: string): string {
  return pathname.replace(/\/+$/, '').toLowerCase() || '/';
}

/** The bar shows everywhere but the /exam route itself, the start screen and the running exam (D5); its results and an unknown address under /exam/ show it. */
export function showsTabBar(pathname: string): boolean {
  return normalise(pathname) !== '/exam';
}

/** The tab whose screen is open, or undefined on results, Settings, Flagged and not-found. The query is not part of the pathname, so focused practice keeps Practice current. */
export function currentTab(pathname: string): Tab | undefined {
  const path = normalise(pathname);
  return TABS.find((tab) => tab.to === path);
}
