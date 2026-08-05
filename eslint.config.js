/* eslint-disable import/extensions */
import { defineConfig } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier/flat";
import importPlugin from "eslint-plugin-import";

export default defineConfig([
	{
		ignores: [
			"node_modules",
			"out",
			"dist",
			"dev",
			"packages/*/lib",
			"packages/*/out",
			"packages/*/scripts",
			"packages/*/test",
			"packages/*/index.*",
			"packages/*/.wireit",
			"packages/vscode-lit-plugin/built",
			"packages/vscode-lit-plugin/.vscode",
			"packages/vscode-lit-plugin/.vscode-test"
		]
	},
	{
		files: ["**/*.{js,ts}"],

		plugins: {
			js
		},
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			importPlugin.flatConfigs.recommended,
			importPlugin.flatConfigs.typescript,
			eslintConfigPrettier
		],
		rules: {
			"no-console": "error",
			"prefer-rest-params": "off",
			"@typescript-eslint/no-this-alias": "off",
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
			"no-dupe-class-members": "off",
			"import/extensions": ["error", "always"],
			"import/no-unresolved": ["off"]
		},
		languageOptions: {
			globals: {
				...globals.es2021,
				...globals.node
			}
		}
	}
]);
