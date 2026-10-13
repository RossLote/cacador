// Checks packages/data against the rules of DESIGN.md § 4; run by `pnpm lint`.
import { dataDir } from './lib/manifest.mjs';
import { ValidationError, validate } from './lib/validate.mjs';

try {
  const c = validate(dataDir);
  console.log(
    `validate: ${c.questions} questions, ${c.files} files, ${c.sections} sections, ${c.topics} topics, ` +
      `${c.images} images on ${c.imageQuestions} questions`,
  );
} catch (error) {
  if (!(error instanceof ValidationError)) throw error;
  console.error(`validate: ${error.message}`);
  process.exit(1);
}
