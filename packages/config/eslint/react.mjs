import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

import { baseConfig } from "./base.mjs";

/** Flat config for React component libraries (no Next.js). */
export const reactConfig = tseslint.config(
  ...baseConfig,
  reactHooks.configs.flat["recommended-latest"],
  {
    rules: {
      "no-restricted-imports": [
        "error",
        { paths: [{ name: "next", message: "Shared UI must not depend on Next.js." }] },
      ],
    },
  },
);
