/** A count with its noun, singular for one. */
const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export const settings = {
  title: 'Settings',
  notSaving: 'Progress is not being saved on this device: it lasts only until this page is closed. Export keeps a copy.',
  language: 'Language',
  progress: 'Progress',
  progressHelp:
    'Export saves your answers, exams and flags to a file. Import adds the progress in such a file, from this device or another, to the progress here.',
  export: 'Export',
  share: 'Share',
  shareTitle: 'Caçador progress',
  import: 'Import',
  importFile: 'Progress file to import',
  importing: 'Importing',
  imported: (answers: number, exams: number, flags: number) =>
    `Added ${counted(answers, 'answer', 'answers')}, ${counted(exams, 'exam', 'exams')} and ${counted(flags, 'flag', 'flags')}`,
  importRefused: 'That file is not a Caçador progress export. Nothing was changed.',
  clear: 'Clear progress',
  clearTitle: 'Clear all progress?',
  clearDescription:
    'This removes every answer, exam and flag on this device, and cannot be undone. The language stays. Export first to keep a copy.',
  clearConfirm: 'Clear everything',
  clearCancel: 'Cancel',
  cleared: 'Progress cleared',
  flaggedLink: 'Flagged',
};
