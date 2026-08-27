import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/rules-of-hooks": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "graphify-out/**",
    "scratch/**",
    "scratch*.js",
    "scratch*.ts",
    "scripts/**",
    "*.js",
    ".codex/**",
    ".ua/**",
    // Local-only / stale duplicates — not part of Vercel build
    "roastd-studio-gpl/**",
    "desktop/**",
    "research/**",
    "test-alog/**",
    ".pnpm-store/**",
    ".commandcode/**",
    ".playwright-cli/**",
    "public/downloads/**",
  ]),
]);

export default eslintConfig;
