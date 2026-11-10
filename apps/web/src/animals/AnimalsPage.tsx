import { Route, Routes } from 'react-router';
import { NotFoundPage } from '@/notfound/NotFoundPage';
import { AnimalCredits } from './AnimalCredits';
import { AnimalPass } from './AnimalPass';
import { AnimalsGrid } from './AnimalsGrid';

/**
 * The Animals screens (epic animal-practice D6, D21), routed as /animals/* so
 * this folder owns its sub-routes: /animals is the grid of photo tiles,
 * /animals/credits the photo credits, and /animals/<slug> the animal's pass
 * (an unknown slug, or anything deeper, gets the not-found page).
 */
export function AnimalsPage() {
  return (
    <Routes>
      <Route index element={<AnimalsGrid />} />
      <Route path="credits" element={<AnimalCredits />} />
      <Route path=":slug" element={<AnimalPass />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
