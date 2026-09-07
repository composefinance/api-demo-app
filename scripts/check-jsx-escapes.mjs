#!/usr/bin/env node
// A \uXXXX escape written directly into JSX *text* is not interpreted — React
// renders the six literal characters "—" instead of an em dash. Inside a
// JS string it works fine, which is why this slips through review and through
// ESLint. This has shipped to the page three separate times in this file.
//
// Write the character itself, or wrap it in an expression: {"—"}.
//
// Usage: node scripts/check-jsx-escapes.mjs [files...]  (defaults to *.jsx)

import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

function collect(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (SKIP_DIRS.has(entry)) return [];
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return collect(full);
    return entry.endsWith(".jsx") ? [full] : [];
  });
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : collect(".");
const hits = [];

for (const file of files) {
  readFileSync(file, "utf8").split("\n").forEach((line, i) => {
    // Strip comments, then string and template literals — an escape that
    // survives is sitting in bare JSX text.
    const bare = line
      .replace(/\/\/.*$/, "")
      .replace(/\/\*.*?\*\//g, "")
      .replace(/"(?:[^"\\]|\\.)*"/g, " ")
      .replace(/'(?:[^'\\]|\\.)*'/g, " ")
      .replace(/`(?:[^`\\]|\\.)*`/g, " ");
    if (/\\u[0-9A-Fa-f]{4}/.test(bare) || /\\u\{[0-9A-Fa-f]+\}/.test(bare)) {
      hits.push(`${file}:${i + 1}  ${line.trim().slice(0, 140)}`);
    }
  });
}

if (hits.length) {
  console.error(`Unicode escapes in JSX text (these render literally):\n`);
  for (const h of hits) console.error(`  ${h}`);
  console.error(`\nWrite the character directly, or wrap it: {"\\u2014"}`);
  process.exit(1);
}

console.log(`check-jsx-escapes: clean (${files.length} file(s))`);
