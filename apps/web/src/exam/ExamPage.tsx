import { Route, Routes } from 'react-router';
import { ExamResultsPage } from './ExamResultsPage';
import { ExamStart } from './ExamStart';

/**
 * The Exam screen (DESIGN.md § 6.5), routed as /exam/* so this folder owns its
 * sub-routes (D19): /exam is the start screen, which resumes the unfinished
 * exam or becomes the running exam after Start, and /exam/results/<id> the
 * results.
 */
export function ExamPage() {
  return (
    <Routes>
      <Route index element={<ExamStart />} />
      <Route path="results/:id" element={<ExamResultsPage />} />
    </Routes>
  );
}
