import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import { reactRefresh } from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Radix is banned (DESIGN.md § 8). UI primitives come from @base-ui/react via
 * the shadcn components in apps/web/src/components/ui/.
 */
const RADIX_IMPORT_PATTERNS = ['@radix-ui/*', 'radix-ui', 'radix-ui/*'];

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/node_modules/',
    '**/coverage/',
    '**/test-results/',
    '**/playwright-report/',
    '**/blob-report/',
  ]),
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 'latest',
      globals: { ...globals.node },
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite()],
    languageOptions: {
      globals: { ...globals.browser },
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: RADIX_IMPORT_PATTERNS,
              message: 'Radix is banned. Use the shadcn components on Base UI (@base-ui/react).',
            },
          ],
        },
      ],
    },
  },
  {
    // Generated shadcn components export variants next to components by design.
    files: ['apps/web/src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
]);
