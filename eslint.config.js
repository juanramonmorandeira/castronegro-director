import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.firebase/**',
      '*.log',
      'docs/**',
      'public/**',
      'reference-data/**',
      'flavours/**'
    ]
  },
  js.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    files: ['**/*.{js,svelte}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node
      }
    },
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['src/lib/domain/__test__/**/*.js', 'tools/**/*.js'],
    rules: {
      'no-console': 'off'
    }
  }
];
