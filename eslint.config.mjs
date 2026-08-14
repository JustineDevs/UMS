import tsParser from "@typescript-eslint/parser";
import globals from "globals";

let nextPlugin;
try {
  nextPlugin = (await import("@next/eslint-plugin-next")).default;
} catch {
  nextPlugin = null;
}

/** @type {import("eslint").Linter.Config[]} */
export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/build/**",
      "**/.medusa/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        React: "readonly",
        JSX: "readonly",
        RequestInit: "readonly",
        Request: "readonly",
        Response: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-undef": "error",
    },
  },
  ...(nextPlugin
    ? [
        {
          files: [
            "apps/storefront/**/*.ts",
            "apps/storefront/**/*.tsx",
            "apps/admin/**/*.ts",
            "apps/admin/**/*.tsx",
          ],
          plugins: { "@next/next": nextPlugin },
          rules: {
            ...nextPlugin.configs.recommended.rules,
            ...nextPlugin.configs["core-web-vitals"].rules,
          },
        },
      ]
    : []),
];
