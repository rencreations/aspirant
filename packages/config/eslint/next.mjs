import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import tseslint from "typescript-eslint";

import { baseConfig } from "./base.mjs";

/**
 * Flat config for the Next.js app: base + Next.js core-web-vitals (includes
 * react, react-hooks, jsx-a11y and @next/next).
 */
export const nextConfig = tseslint.config(...baseConfig, ...nextCoreWebVitals, ...nextTypescript, {
  rules: {
    "react/no-unescaped-entities": "off",
    "react/jsx-key": "error",
  },
});
