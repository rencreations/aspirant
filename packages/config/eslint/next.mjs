import tanstackQuery from "@tanstack/eslint-plugin-query";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

import { baseConfig } from "./base.mjs";

/**
 * Flat config for the Next.js app: base + Next.js core-web-vitals (includes
 * react, react-hooks, jsx-a11y and @next/next) + TanStack Query rules.
 */
export const nextConfig = tseslint.config(
  ...baseConfig,
  ...nextCoreWebVitals,
  ...nextTypescript,
  ...tanstackQuery.configs["flat/recommended"],
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react/jsx-key": "error",
    },
  },
);
