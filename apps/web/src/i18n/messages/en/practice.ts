/**
 * The Practice screen (DESIGN.md § 6.4). `card` holds the question card's own
 * words (components/question/), which the exam renders too, so it reads them
 * from here rather than keeping a copy.
 */
export const practice = {
  title: 'Practice',
  next: 'Next',
  loading: 'Choosing a question…',
  card: {
    questionNumber: (id: number) => `Question ${id}`,
    pictureAlt: (id: number) => `The picture for question ${id}`,
    options: 'Options',
    holdForEnglish: 'Hold for English',
    hint: 'Hint',
    languageNotes: 'Language notes',
    noLanguageNotes: 'No language notes for this question.',
    nudge: 'Nudge',
    right: 'Right',
    wrong: 'Wrong',
    correctAnswer: 'Correct answer',
  },
};
