// ESLint checks code quality (likely bugs, `any`, unused variables). Types are
// checked by `tsc`; formatting by Prettier, plugged in below.
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Don't lint installed or generated code, anywhere in the tree.
  { ignores: ['**/node_modules/', '**/.serverless/', '**/dist/'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  // Keep last so it turns off ESLint rules that conflict with Prettier.
  eslintPluginPrettierRecommended,
);
