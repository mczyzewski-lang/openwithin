// Lists translation keys referenced in source (static keys + dynamic templates) for i18n completeness checks.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(f)) out.push(p);
  }
  return out;
}
const keys = new Set();
const dynamic = new Set();
for (const file of walk(process.argv[2] ?? "src")) {
  const src = readFileSync(file, "utf8");
  const vars = {};
  for (const m of src.matchAll(/const (\w+) = (?:await )?(?:useTranslations|getTranslations)\((?:"([\w.]+)"|\{[^}]*namespace: "([\w.]+)"[^}]*\})\)/g)) vars[m[1]] = m[2] ?? m[3];
  for (const [v, ns] of Object.entries(vars)) {
    for (const m of src.matchAll(new RegExp(`\\b${v}(?:\\.rich|\\.has)?\\(\\s*("([^"]+)"|\`([^\`]+)\`)`, "g"))) {
      if (m[2]) keys.add(`${ns}.${m[2]}`);
      else dynamic.add(`${ns}.${m[3]}  (${path.relative(".", file)})`);
    }
  }
}
console.log([...keys].sort().join("\n"));
console.log("\n# dynamic\n" + [...dynamic].sort().join("\n"));
