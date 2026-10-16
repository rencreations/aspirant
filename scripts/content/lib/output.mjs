// Writes generated files through Prettier, so `pnpm format:check` passes and re-runs
// produce byte-identical output.
import fs from "node:fs";
import path from "node:path";

import * as prettier from "prettier";

export const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");

async function format(filePath, text, parser) {
  const config = (await prettier.resolveConfig(filePath)) ?? {};
  return prettier.format(text, { ...config, filepath: filePath, parser });
}

/** Write a value as Prettier-formatted JSON. Returns true when the file changed. */
export async function writeJson(filePath, value) {
  return writeFormatted(filePath, JSON.stringify(value), "json");
}

/** Write TypeScript source, formatted by Prettier. Returns true when the file changed. */
export async function writeTs(filePath, source) {
  return writeFormatted(filePath, source, "typescript");
}

async function writeFormatted(filePath, text, parser) {
  const formatted = await format(filePath, text, parser);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const previous = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
  if (previous === formatted) return false;
  fs.writeFileSync(filePath, formatted, "utf8");
  return true;
}

export function writeText(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, text, "utf8");
}

/** Short repo-relative path with forward slashes, for logs. */
export function rel(filePath) {
  return path.relative(REPO_ROOT, filePath).split(path.sep).join("/");
}
