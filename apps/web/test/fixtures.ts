/** Bank lookups the tests share. */
import { questionById, type OptionKey, type Question } from '@cacador/data';

/** The question with this id; throws for an id not in the bank. */
export function question(id: number): Question {
  const q = questionById(id);
  if (!q) throw new Error(`no question ${id}`);
  return q;
}

/** The right option of question `id`. */
export const correctOf = (id: number): OptionKey => question(id).answer;

/** A wrong option of question `id`: B when A is right, A otherwise. */
export const wrongOf = (id: number): OptionKey => (correctOf(id) === 'A' ? 'B' : 'A');
