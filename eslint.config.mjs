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
  {
    files: ["**/*.d.ts"],
    rules: {
      // Ambient module/interface names are consumed by TypeScript declaration merging.
      "no-unused-vars": "off",
    },
  },
  {
    files: ["workers/backend/src/**/*.ts"],
    languageOptions: {
      globals: {
        Queue: "readonly",
        MessageBatch: "readonly",
      },
    },
  },
  {
    files: ["apps/web/src/lib/visual-builder/**/*.ts"],
    rules: {
      // Adapter methods intentionally keep the source builder's callback
      // signatures even when a concrete port does not need every argument.
      "no-unused-vars": [
        "warn",
        { args: "none", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["packages/ui/src/**/*.ts", "packages/ui/src/**/*.tsx"],
    rules: {
      // Shared UI primitives preserve framework callback signatures for consumers;
      // unused callback arguments are not runtime defects.
      "no-unused-vars": [
        "warn",
        { args: "none", varsIgnorePattern: "^_" },
      ],
    },
  },
  ...(nextPlugin
    ? [
        {
          files: [
            "apps/web/**/*.ts",
            "apps/web/**/*.tsx",
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
