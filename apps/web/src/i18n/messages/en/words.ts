/**
 * The words drill (DESIGN.md § 6.11, epic cac-zqe D9, D10, D14): the screen's
 * own words, which follow the interface language. The word, its phrase and the
 * sentence stay Portuguese and the options and the note English in either
 * language; they come from @cacador/data, never from here. The round's words
 * are Practice's, duplicated here rather than shared (DESIGN.md § 8.3).
 */
export const words = {
  /** The screen header's eyebrow, and the page's heading for screen readers. */
  title: 'Words',
  /** In the screen header's right-hand slot: the word on screen's place in the round, as "3 of 10". */
  position: (n: number, size: number) => `${n} of ${size}`,
  /** The name of the group of three option rows. */
  options: 'Options',
  next: 'Next',
  /** The button under the round's last answer, in place of Next. */
  finish: 'Finish',
  /** Over the sentence in the panel after answering: the question the word's phrase comes from. */
  questionNumber: (id: number) => `Question ${id}`,
  /** The caption of the score plate. */
  done: 'Round done',
  /** Beside the count right on the score plate. */
  ofRight: (size: number) => `of ${size} right`,
  /** On a score row whose word was answered wrongly. */
  missed: 'Missed',
  /** The button on the score plate that starts the next round. */
  another: (size: number) => `Another ${size}`,
};
