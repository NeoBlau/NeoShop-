import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      'apps/api/src/generated/**',
      'apps/desktop/src-tauri/**',
      // Vendor decoders copied out of the three package, and test output.
      'apps/web/public/**',
      'apps/web/.auth/**',
      'apps/web/test-results/**',
      'apps/web/playwright-report/**',
      // Downloaded source assets and the tools' own scratch space.
      '**/.cache/**',
      '**/.ktx/**',
      '**/*.config.js',
      // The space simulator's downloaded textures and vendored three.js.
      'apps/buran-odyssey/vendor/**',
      'apps/buran-odyssey/assets/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // The brief forbids `any`. This is the rule that enforces it.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Empty catch blocks hide failures; the brief calls them out explicitly.
      'no-empty': ['error', { allowEmptyCatch: false }],
      eqeqeq: ['error', 'always'],
    },
  },
  {
    // Plain Node scripts: no TypeScript, so `no-undef` needs the globals named.
    // URL is a Node global; window belongs to the page a script evaluates code
    // in, which is why the preview harness mentions it.
    files: ['**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        URL: 'readonly',
        window: 'readonly',
      },
    },
  },
  {
    // Buran-M runs as plain browser ES modules (no bundler), plus module
    // workers and a few Node tools.
    files: ['apps/buran-odyssey/**/*.js'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        performance: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        Image: 'readonly',
        Worker: 'readonly',
        URL: 'readonly',
        XMLHttpRequest: 'readonly',
        createImageBitmap: 'readonly',
        HTMLInputElement: 'readonly',
        setTimeout: 'readonly',
        console: 'readonly',
        self: 'readonly',
        PerformanceObserver: 'readonly',
      },
    },
  },
  {
    files: ['apps/buran-odyssey/tools/**/*.mjs'],
    languageOptions: {
      globals: { fetch: 'readonly', Buffer: 'readonly', performance: 'readonly' },
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
