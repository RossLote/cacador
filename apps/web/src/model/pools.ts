import { hintFor, questions, questionsInSection, questionsInTopic } from '@cacador/data';

/** Every question id in the bank, in id order: the whole-bank practice pool. */
export const bankPool: readonly number[] = questions.map((q) => q.id);

/** The ids of a topic's questions (by manifest slug); empty for an unknown slug. */
export function topicPool(slug: string): number[] {
  return questionsInTopic(slug).map((q) => q.id);
}

/** The ids of a section's questions (by manifest slug); empty for an unknown slug. */
export function sectionPool(slug: string): number[] {
  return questionsInSection(slug).map((q) => q.id);
}

/** The ids of every question whose hint carries the pattern tag (D4); empty for an unknown slug. */
export function patternPool(slug: string): number[] {
  return bankPool.filter((id) => hintFor(id)?.patterns.includes(slug) ?? false);
}
