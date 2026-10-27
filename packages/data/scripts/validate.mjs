// Checks packages/data against the rules of DESIGN.md § 4; run by `pnpm lint`.
import { dataDir } from './lib/manifest.mjs';
import { ValidationError, validate } from './lib/validate.mjs';

/** A translations or hints count as validate prints it. */
const entryLine = (label, n) =>
  `${label} ${n.entries} entries in ${n.files} files, ${n.draft} draft, ${n.checked} checked, ${n.reviewed} reviewed`;

try {
  const c = validate(dataDir);
  console.log(
    `validate: ${c.questions} questions, ${c.files} files, ${c.sections} sections, ${c.topics} topics, ` +
      `${c.images} images on ${c.imageQuestions} questions`,
  );
  console.log(
    `validate: ${entryLine('translations', c.translations)}; ` +
      `glossaries ${c.glossaries.species} species, ${c.glossaries.terms} terms`,
  );
  console.log(`validate: ${entryLine('hints', c.hints)}; patterns ${c.patterns}`);
  console.log(`validate: words ${c.words.entries} entries in ${c.words.files} files`);
} catch (error) {
  if (!(error instanceof ValidationError)) throw error;
  console.error(`validate: ${error.message}`);
  process.exit(1);
}
