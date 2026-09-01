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
    // Vendored GPL fork of Roastd Studio — Qt translator .ts files, not JS/TS source.
    "roastd-studio-gpl/**",
    // Tauri build output (binary codegen-assets, .pdb, etc).
    "desktop/src-tauri/target/**",
    // Compiled desktop bundles.
    "desktop/dist/**",
    // Ad-hoc MQTT probe scripts, not application source.
    "desktop/test-mqtt.js",
    "desktop/test-mqtt-simple.js",
    // Pending merge from roastd-main UX branch — not yet integrated into main.
    "tools/pending-merge-from-roastd-main/**",
  ]),
]);

export default eslintConfig;
