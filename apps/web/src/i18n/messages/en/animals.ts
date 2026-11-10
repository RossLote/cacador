/**
 * The Animals screens (epic animal-practice D14, D19, D21, D23): the grid at
 * /animals, the photo credits at /animals/credits and an animal's pass at
 * /animals/<slug>. An animal's names come from @cacador/data, never from here.
 * The pass's and the score's words that Practice also uses are duplicated here
 * rather than shared (DESIGN.md § 8.3).
 */
export const animals = {
  /** The grid's title, the pass's eyebrow, and the pass's heading for screen readers. */
  title: 'Animals',
  /** The link at the foot of the grid, and the credits screen's title. */
  credits: 'Photo credits',
  /** The one line that opens the credits screen (D19). */
  creditsIntro: 'Photos from Wikimedia Commons, resized and cropped.',
  /** On a credits row: the link to the photo's Wikimedia Commons page. */
  source: 'Source',
  /** The source link's accessible name, with the animal's Portuguese tile name. */
  sourceOf: (name: string) => `Source: ${name}`,
  /** The chip on a tile's corner once a full pass is done, as "17/22". */
  tileScore: (right: number, total: number) => `${right}/${total}`,
  /** The chip on a tile's corner while a pass is kept partway, as "12 of 34". */
  tilePartway: (answered: number, total: number) => `${answered} of ${total}`,
  /** A tile's accessible name when not started: the Portuguese name, then the English. */
  tileName: (pt: string, en: string) => `${pt}, ${en}`,
  /** A tile's accessible name once a full pass is done. */
  tileDone: (pt: string, en: string, right: number, total: number) => `${pt}, ${en}, ${right} of ${total} right`,
  /** A tile's accessible name while a pass is kept partway. */
  tileStarted: (pt: string, en: string, answered: number, total: number) =>
    `${pt}, ${en}, ${answered} of ${total} answered`,
  /** In the pass's screen header: the question on screen's place in the pass, as "3 of 22". */
  position: (n: number, size: number) => `${n} of ${size}`,
  /** The chip over the question card, before the animal's Portuguese tile name. */
  practising: 'Practising',
  next: 'Next',
  /** The button under the pass's last answer, in place of Next. */
  finish: 'Finish',
  /** The caption of the score plate, with the animal's Portuguese tile name. */
  done: (name: string) => `${name} done`,
  /** Beside the count right on the score plate. */
  ofRight: (size: number) => `of ${size} right`,
  /** The score's button for a pass of only the questions answered wrongly, with how many. */
  missedOnly: (count: number) => `Missed ones only (${count})`,
  /** The score's button that starts the animal's pass again from question 1. */
  again: 'Go again',
  /** The score's link back to the grid. */
  back: 'Back to animals',
  /** Practice's words, duplicated: while the pass's question is read. */
  loading: 'Choosing a question…',
  /** Practice's words, duplicated: storage could not be read, so no question could be drawn. */
  loadFailed: 'Could not read your progress on this device, so no question was chosen. Reload the page to try again.',
  /** Practice's words, duplicated: the answer was marked but could not be written, so it does not count yet. */
  answerNotSaved: 'This answer could not be saved on this device, so it does not count towards your progress.',
};
