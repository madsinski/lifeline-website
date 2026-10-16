#!/usr/bin/env node
// Static guard for AGENTS.md rule #3: every mutation handler
// (POST / PUT / PATCH / DELETE) exported from src/app/api/admin/**/route.ts
// must pass an AAL2 (MFA) gate before doing anything.
//
// Accepted gates inside the handler body:
//   requireAdminAAL2(…)        — admin-write role + AAL2
//   requireStaffAAL2(…)        — role/permission-scoped staff + AAL2
//   requireResearchWrite(…)    — admin+AAL2 or medical_advisor (research module)
//   adminGate(…, true)         — /api/admin/hc wrapper around requireAdminAAL2
//   aalFromToken(…) !== "aal2" — hand-rolled AAL2 check (discouraged; prefer
//                                requireStaffAAL2, which also does the staff
//                                lookup by user id)
// …or a call to a function defined in the same file whose body contains one
// of the above (one level of indirection, e.g. a local `gate(req)` helper).
//
// Usage: node scripts/check-admin-auth.mjs   (exit 1 on any violation)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const BASE = join(ROOT, "src/app/api/admin");
const METHODS = ["POST", "PUT", "PATCH", "DELETE"];
const GATE_RE = /\b(requireAdminAAL2|requireStaffAAL2|requireResearchWrite)\s*\(|\badminGate\s*\([^()]*,\s*true\s*\)|\baalFromToken\s*\(\s*\w+\s*\)\s*!==\s*["']aal2["']/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (name === "route.ts" || name === "route.tsx" || name === "route.js") out.push(p);
  }
  return out;
}

/** Return the text of the balanced {...} block starting at the first "{" at/after idx. */
function blockFrom(src, idx) {
  const start = src.indexOf("{", idx);
  if (start < 0) return "";
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return src.slice(start);
}

/** Strip line + block comments so a gate mentioned in a comment doesn't count. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

/** Find the body of a handler for `method`, or null if not exported. */
function handlerBody(src, method) {
  const fnRe = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`);
  const m = fnRe.exec(src);
  if (m) {
    // skip the parameter list (may contain `{ params }: { params: … }` braces)
    let i = m.index + m[0].length, depth = 1;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    return blockFrom(src, i);
  }
  const constRe = new RegExp(`export\\s+const\\s+${method}\\s*=`);
  const c = constRe.exec(src);
  if (c) {
    const arrow = src.indexOf("=>", c.index);
    const rest = src.slice(arrow + 2).trimStart();
    if (rest.startsWith("{")) return blockFrom(src, arrow);
    // `export const POST = withGate(handler)` or expression body: check the statement
    const end = src.indexOf("\n\n", c.index);
    return src.slice(c.index, end < 0 ? undefined : end);
  }
  // `export { handler as POST }`
  const reexp = new RegExp(`export\\s*\\{[^}]*\\b(\\w+)\\s+as\\s+${method}\\b`);
  const r = reexp.exec(src);
  if (r) return localFnBody(src, r[1]) ?? "";
  return null;
}

function localFnBody(src, name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(|const\\s+${name}\\s*=\\s*(?:async\\s*)?\\(`);
  const m = re.exec(src);
  if (!m) return null;
  let i = m.index + m[0].length, depth = 1;
  while (i < src.length && depth > 0) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")") depth--;
    i++;
  }
  return blockFrom(src, i);
}

function gated(src, body) {
  if (GATE_RE.test(body)) return true;
  // one level of indirection to a local helper
  for (const call of body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)) {
    const name = call[1];
    if (METHODS.includes(name)) continue;
    const inner = localFnBody(src, name);
    if (inner && GATE_RE.test(inner)) return true;
  }
  return false;
}

const files = walk(BASE).sort();
const violations = [];
let handlers = 0;
for (const f of files) {
  const src = stripComments(readFileSync(f, "utf8"));
  for (const method of METHODS) {
    const body = handlerBody(src, method);
    if (body === null) continue;
    handlers++;
    if (!gated(src, body)) violations.push(`${relative(ROOT, f)}  ${method}`);
  }
}

if (violations.length) {
  console.error(`check:admin-auth — ${violations.length} mutation handler(s) without an AAL2 gate:\n`);
  for (const v of violations) console.error("  " + v);
  console.error("\nUse requireAdminAAL2(req), requireStaffAAL2(req, {...}) or adminGate(req, true). See AGENTS.md rule #3.");
  process.exit(1);
}
console.log(`check:admin-auth — OK (${handlers} mutation handlers in ${files.length} route files, all AAL2-gated)`);
