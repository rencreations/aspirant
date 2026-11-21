// Removes the declarations that tsc reports as unused (TS6133, TS6196), after knip took their export away.
// Run it after `knip --fix --fix-type exports,types` has taken the `export` keyword off what nothing imports:
// the declarations that are now unused by their own file are deleted here, round by round, until `tsc` is quiet.
// Usage: node scripts/dev/prune-unused.cjs   (from anywhere; it runs `npx tsc --noEmit -p .` in apps/web)
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "../../apps/web");
const NL = String.fromCharCode(10);

function tscErrors() {
  let out = "";
  try {
    out = execSync("npx tsc --noEmit -p .", {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 1 << 28,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    out = String(e.stdout || "") + String(e.stderr || "");
  }
  const rows = [];
  for (const line of out.split(NL)) {
    const m = /^(.+?)\((\d+),(\d+)\): error TS(6133|6196): (.*)$/.exec(line.trim());
    if (m) rows.push({ file: path.join(ROOT, m[1]), line: +m[2] - 1, col: +m[3] - 1, msg: m[5] });
  }
  const other = out.split(NL).filter((l) => /error TS/.test(l) && !/TS6133|TS6196/.test(l));
  return { rows, other };
}

function findIdent(sf, pos) {
  let found = null;
  (function walk(n) {
    if (pos >= n.getStart(sf) && pos < n.getEnd()) {
      if (ts.isIdentifier(n) && n.getStart(sf) === pos) found = n;
      ts.forEachChild(n, walk);
    }
  })(sf);
  return found;
}

function removalFor(sf, id) {
  const parent = id.parent;
  if (ts.isVariableDeclaration(parent) && parent.name === id) {
    const list = parent.parent;
    const stmt = list.parent;
    if (list.declarations.length === 1 && ts.isVariableStatement(stmt))
      return [stmt.getFullStart(), stmt.getEnd()];
    const i = list.declarations.indexOf(parent);
    const next = list.declarations[i + 1];
    if (next) return [parent.getStart(sf), next.getStart(sf)];
    const prev = list.declarations[i - 1];
    if (prev) return [prev.getEnd(), parent.getEnd()];
    return null;
  }
  if (
    (ts.isFunctionDeclaration(parent) ||
      ts.isInterfaceDeclaration(parent) ||
      ts.isTypeAliasDeclaration(parent) ||
      ts.isClassDeclaration(parent) ||
      ts.isEnumDeclaration(parent)) &&
    parent.name === id
  ) {
    return [parent.getFullStart(), parent.getEnd()];
  }
  if (ts.isImportSpecifier(parent)) {
    const clause = parent.parent.parent;
    const decl = clause.parent;
    const els = parent.parent.elements;
    if (els.length === 1 && !clause.name) return [decl.getFullStart(), decl.getEnd()];
    const i = els.indexOf(parent);
    const next = els[i + 1];
    if (next) return [parent.getStart(sf), next.getStart(sf)];
    const prev = els[i - 1];
    if (prev) return [prev.getEnd(), parent.getEnd()];
    return null;
  }
  if (ts.isImportClause(parent) && parent.name === id) {
    const decl = parent.parent;
    if (!parent.namedBindings) return [decl.getFullStart(), decl.getEnd()];
    return [id.getStart(sf), parent.namedBindings.getStart(sf)];
  }
  if (ts.isNamespaceImport(parent)) {
    const decl = parent.parent.parent;
    if (!parent.parent.name) return [decl.getFullStart(), decl.getEnd()];
    return null;
  }
  return null;
}

let round = 0;
for (; round < 8; round += 1) {
  const { rows, other } = tscErrors();
  console.log("round", round, "unused:", rows.length, "other errors:", other.length);
  if (other.length) console.log(other.slice(0, 6).join(NL));
  if (rows.length === 0) break;
  const byFile = new Map();
  for (const r of rows) {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }
  for (const [file, list] of byFile) {
    const text = fs.readFileSync(file, "utf8");
    const sf = ts.createSourceFile(
      file,
      text,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const ranges = [];
    for (const r of list) {
      const pos = sf.getPositionOfLineAndCharacter(r.line, r.col);
      const id = findIdent(sf, pos);
      const range = id ? removalFor(sf, id) : null;
      if (!range) {
        console.log("skip", path.relative(ROOT, file), r.line + 1, r.msg.slice(0, 80));
        continue;
      }
      ranges.push(range);
    }
    ranges.sort((a, b) => b[0] - a[0]);
    let out = text;
    let last = Infinity;
    for (const [s, e] of ranges) {
      if (e > last) continue; // overlapping: next round
      let end = e;
      while (out[end] === " ") end += 1;
      if (out[end] === String.fromCharCode(13)) end += 1;
      if (out[end] === NL) end += 1;
      out = out.slice(0, s) + out.slice(end);
      last = s;
    }
    fs.writeFileSync(file, out);
  }
}
console.log("done after", round, "rounds");
