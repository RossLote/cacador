import type { Locale } from '../locales';
import { en, type Messages } from './en';
import { pt } from './pt';

export type { Messages };

export const MESSAGES: Record<Locale, Messages> = { en, pt };
