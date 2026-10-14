/** @type {import("prettier").Config} */
const config = {
  semi: true,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
  endOfLine: "lf",
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindFunctions: ["cn", "cva", "clsx"],
};

export default config;
