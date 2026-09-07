import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", "node_modules/**"] },
  js.configs.recommended,

  // Application code: browser globals, React + hooks rules.
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      // Plain JS, no prop-types; the new JSX transform means React need not
      // be in scope.
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off",

      "no-unused-vars": ["warn", { varsIgnorePattern: "^_", argsIgnorePattern: "^_" }],

      // Downgraded, not disabled. demo.jsx has a handful of pre-existing
      // violations in the autoplay loop and the unread-webhook badge, which
      // predate this config and need a real refactor of those effects to fix.
      // Kept visible as warnings so `npm run lint` is usable today and the
      // backlog stays on screen — please burn these down rather than adding
      // to them, then raise both back to "error".
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  // Build/lint tooling runs in Node, not the browser.
  {
    files: ["scripts/**/*.mjs", "*.config.js", "vite.config.js"],
    languageOptions: {
      globals: { ...globals.node },
    },
  },
];
