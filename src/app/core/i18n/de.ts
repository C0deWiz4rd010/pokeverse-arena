import { DE_UI } from './de.ui';
import { DE_DATA } from './de.data';
import { DE_DATA_GAME } from './de.data.game';
import { DE_DATA_RPG } from './de.data.rpg';

/**
 * German translations, keyed by the English source text. The dictionary is split by domain
 * (`de.ui`, `de.data`, `de.data.game`, `de.data.rpg`); `npm run i18n:check` fails when a key
 * appears in more than one file, so merging cannot silently override an entry.
 */
export const DE: Readonly<Record<string, string>> = {
  ...DE_UI,
  ...DE_DATA,
  ...DE_DATA_GAME,
  ...DE_DATA_RPG,
};
