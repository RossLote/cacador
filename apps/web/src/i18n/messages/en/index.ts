/**
 * English messages, one file per screen (phase 4 D18). This object defines the
 * Messages type; each Portuguese file is typed by its English counterpart, so a
 * key missing on either side fails `pnpm lint`. A screen bead edits only its
 * own two files (en/<screen>.ts and pt/<screen>.ts) and never this index.
 */
import { common } from './common';
import { exam } from './exam';
import { flagged } from './flagged';
import { home } from './home';
import { practice } from './practice';
import { progress } from './progress';
import { settings } from './settings';
import { words } from './words';

export const en = { common, home, practice, exam, progress, settings, flagged, words };

export type Messages = typeof en;
