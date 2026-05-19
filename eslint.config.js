import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  { ignores: ['**/dist/', '**/node_modules/', '**/.papi/', 'e2e/', 'deployment/'] },

  // Base JS recommended rules
  eslint.configs.recommended,

  // TypeScript recommended rules
  ...tseslint.configs.recommended,

  // TypeScript-specific overrides
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // Disable rules that conflict with Prettier (must be last)
  eslintConfigPrettier,
);
