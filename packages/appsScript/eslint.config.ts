import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from "globals";

export default tseslint.config(
  // Configuration for Google Apps Script .js files ---
  {
    files: ['server.js'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  // --- Configuration for the eslint.config.ts file itself ---
  {
    files: ['eslint.config.ts'], // Apply this only to the config file
    languageOptions: {
      globals: {
        ...globals.node, // Use Node.js globals
      },
      parserOptions: {
        project: './tsconfig.eslint.json', // Use the dedicated tsconfig
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);
