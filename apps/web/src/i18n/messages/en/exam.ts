/** The mock exam (DESIGN.md § 6.5): the start screen, the running exam and the results. The question card's own words are in practice.card. */
export const exam = {
  title: 'Exam',
  loading: 'Loading the exam…',
  /** The start screen: the exam's size, time limit in minutes and pass mark come from the model. */
  intro: (size: number, minutes: number, passMark: number) =>
    `A mock exam run like the real one: ${size} questions drawn from the whole bank, ${minutes} minutes, and ${passMark} right to pass.`,
  rules: 'Move freely between the questions and change any answer until you submit. No English and no hints until the results.',
  start: 'Start',
  /** Where the learner is, as "3 of 20". */
  position: (n: number, total: number) => `${n} of ${total}`,
  /** The accessible name of the clock, which shows mm:ss. */
  timeLeft: 'Time left',
  /** The strip of markers, one per question. */
  markers: 'Questions',
  marker: (n: number) => `Question ${n}`,
  /** Read after a marker's name when its question has an answer. */
  answered: 'Answered',
  previous: 'Previous',
  next: 'Next',
  submit: 'Submit',
  /** The confirmation shown when Submit is pressed with questions unanswered. */
  unansweredTitle: (count: number) => `${count} unanswered — submit anyway?`,
  unansweredBody: 'An unanswered question counts as wrong.',
  keepGoing: 'Back to the exam',
  confirmSubmit: 'Submit',
  /** The results page (/exam/results/<id>). */
  resultsTitle: 'Exam results',
  /** The accessible name of the score panel. */
  scoreLabel: 'Score',
  /** The score, as "14 out of 20". */
  score: (score: number, total: number) => `${score} out of ${total}`,
  passMark: (passMark: number) => `Pass mark ${passMark}`,
  passed: 'Passed',
  notPassed: 'Not passed',
  /** The heading and the accessible name of the list of wrong ones. */
  wrongAnswers: 'Wrong answers',
  noWrongAnswers: 'No wrong answers',
  /** Shown above a wrong one that was left unanswered. */
  notAnswered: 'Not answered',
  /** An id that is not a finished exam, unknown or still running. */
  notFound: 'There is no finished exam here.',
  toExam: 'Go to the exam',
};
