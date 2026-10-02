import { DE_UI } from './de.ui';
import { DE_DATA } from './de.data';

/** German translations, keyed by the English source text. */
export const DE: Readonly<Record<string, string>> = { ...DE_UI, ...DE_DATA };
