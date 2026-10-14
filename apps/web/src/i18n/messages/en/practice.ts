/**
 * The Practice screen (DESIGN.md § 6.4). `card` holds the question card's own
 * words (components/question/), which the exam renders too, so it reads them
 * from here rather than keeping a copy.
 */
export const practice = {
  title: 'Practice',
  next: 'Next',
  loading: 'Choosing a question…',
  /** Storage could not be read, so no question could be drawn. */
  loadFailed: 'Could not read your progress on this device, so no question was chosen. Reload the page to try again.',
  /** The answer was marked but could not be written, so it does not count yet. */
  answerNotSaved: 'This answer could not be saved on this device, so it does not count towards your progress.',
  focusedOn: 'Practising',
  flags: {
    group: 'Report a problem with this question',
    /** Read before the two chips. */
    report: 'Report:',
    englishOff: 'English is off',
    hintOff: 'Hint is off',
    englishNote: 'What is off with the English',
    hintNote: 'What is off with the hint',
    save: 'Save',
    saved: 'Saved',
    /** A flag or note could not be written; the row shows what is stored. */
    saveFailed: 'That change could not be saved on this device.',
    /** The question's flags could not be read, so the row cannot be used. */
    loadFailed: 'Could not read the flags for this question on this device.',
  },
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
