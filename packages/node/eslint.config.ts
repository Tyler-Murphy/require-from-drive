import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from "globals";
import { globalIgnores } from 'eslint/config'

export default tseslint.config(
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  globalIgnores([
    `**/vendor/`,
  ]),
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-definitions": "off" // Otherwise some types get changed to interfaces and it breaks things
    },
  },
);
