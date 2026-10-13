// Checks packages/data against the rules of DESIGN.md § 4; run by `pnpm lint`.
import { dataDir } from './lib/manifest.mjs';
import { ValidationError, validate } from './lib/validate.mjs';

try {
  const c = validate(dataDir);
  console.log(
    `validate: ${c.questions} questions, ${c.files} files, ${c.sections} sections, ${c.topics} topics, ` +
      `${c.images} images on ${c.imageQuestions} questions`,
  );
  const t = c.translations;
  console.log(
    `validate: translations ${t.entries} entries in ${t.files} files, ${t.draft} draft, ${t.checked} checked, ${t.reviewed} reviewed; ` +
      `glossaries ${c.glossaries.species} species, ${c.glossaries.terms} terms`,
  );
  const h = c.hints;
  console.log(
    `validate: hints ${h.entries} entries in ${h.files} files, ${h.draft} draft, ${h.checked} checked, ${h.reviewed} reviewed; ` +
      `patterns ${c.patterns}`,
  );
} catch (error) {
  if (!(error instanceof ValidationError)) throw error;
  console.error(`validate: ${error.message}`);
  process.exit(1);
}
