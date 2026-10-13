import { Route, Routes } from 'react-router';
import type { RandomSource } from '@/model';
import { ExamResultsPage } from './ExamResultsPage';
import { ExamStart } from './ExamStart';

export interface ExamPageProps {
  /** Injectable for tests: the source the exam draw uses; Math.random otherwise. */
  random?: RandomSource;
}

/**
 * The Exam screen (DESIGN.md § 6.5), routed as /exam/* so this folder owns its
 * sub-routes (D19): /exam is the start screen, which resumes the unfinished
 * exam or becomes the running exam after Start, and /exam/results/<id> the
 * results.
 */
export function ExamPage({ random }: ExamPageProps) {
  return (
    <Routes>
      <Route index element={<ExamStart random={random} />} />
      <Route path="results/:id" element={<ExamResultsPage />} />
    </Routes>
  );
}
