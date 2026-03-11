'use strict';

module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2021: true,
  },

  ignorePatterns: ['dist/', 'node_modules/'],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
  },
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.mjs', '.cjs'],
      },
    },
  },
  plugins: ['import'],
  extends: ['eslint:recommended', 'plugin:import/recommended'],
  rules: {
    // stylistic
    indent: ['error', 2, { SwitchCase: 1 }],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
    'comma-dangle': ['error', 'only-multiline'],

    // modern best-practices
    'prefer-const': ['error', { destructuring: 'all' }],
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    'no-console': 'off',

    // import
    'import/no-unresolved': 'off', // handled by TS resolver in TS files
    'import/order': [
      'warn',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          ['parent', 'sibling', 'index'],
        ],
        'newlines-between': 'always',
      },
    ],
  },

  overrides: [
    // JavaScript files
    {
      files: ['*.js', '*.cjs', '*.mjs'],
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module',
      },
      rules: {
        // allow require in venerable JS files
      },
    },
  ],
};
