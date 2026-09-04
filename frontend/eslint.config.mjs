// ESLint v9 flat config.
//
// NOTE: `frontend/` is only a thin bridge in this sandbox - its package.json just runs
// `cd ../web && yarn dev`. The files under `frontend/src/` are the legacy Create React App
// sources kept for reference after the Next.js migration; the live code lives in `/app/web`.
// This config exists so `eslint` has a valid v9 configuration instead of erroring out.
export default [
  {
    ignores: ['**/node_modules/**', 'build/**', 'dist/**', 'public/**', 'plugins/**'],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'no-empty': 'off',
    },
  },
];
