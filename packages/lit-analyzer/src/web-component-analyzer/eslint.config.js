import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig([
	{
		ignores: ["node_modules", "out", "lib", "dev", "dist", ".wireit"]
	},
	{
		files: ["**/*.{js,ts}"],
		plugins: {
			js
		},
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			eslintConfigPrettier
		],
		rules: {
			"no-console": "error",
			"@typescript-eslint/no-empty-function": "off",
			"@typescript-eslint/no-use-before-define": "off",
			"@typescript-eslint/explicit-function-return-type": "off",
			"@typescript-eslint/no-object-literal-type-assertion": "off",
			"@typescript-eslint/explicit-member-accessibility": "off",
			"@typescript-eslint/no-parameter-properties": "off",
			"@typescript-eslint/no-var-requires": "off",
			"@typescript-eslint/interface-name-prefix": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"@typescript-eslint/ban-types": "off",
			"@typescript-eslint/no-non-null-assertion": "off",
			"@typescript-eslint/prefer-interface": "off",
			"@typescript-eslint/no-empty-interface": "off",
			"@typescript-eslint/no-require-imports": "off",
			"@typescript-eslint/no-empty-object-type": "off",
			"no-dupe-class-members": "off"
		},
		languageOptions: {
			globals: {
				...globals.es2021,
				...globals.node
			}
		}
	}
]);
