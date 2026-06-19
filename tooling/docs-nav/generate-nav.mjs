#!/usr/bin/env node
// Generate per-page navigation (Up / Prev / Next / Children) for the docs tree.
//
// Model:
//   - A directory's README.md is the INDEX of that directory.
//   - Children of an index = the non-README pages directly in the dir, plus the
//     index of each immediate subdirectory (and pages of any README-less subdir,
//     mapped up to this index). Order is taken from the index README's own link
//     order, with a natural-sort fallback for anything it does not link.
//   - Parent of a page = the index of its directory; for an index, the index of
//     the parent directory. The root (docs/README.md) has no parent.
//   - Prev/Next = adjacency in the depth-first pre-order reading sequence.
//
// The nav block is delimited by sentinels and regenerated in place (idempotent).
// Evidence transcripts (**/evidence/**) are excluded and never modified.
//
// Usage:
//   node tooling/docs-nav/generate-nav.mjs            # write nav into files
//   node tooling/docs-nav/generate-nav.mjs --dry      # print plan, write nothing
//   node tooling/docs-nav/generate-nav.mjs --root docs

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const rootArgIdx = args.indexOf("--root");
const DOCS = path.resolve(rootArgIdx !== -1 ? args[rootArgIdx + 1] : "docs");

const START = "<!-- DOCS-NAV (generated — do not edit by hand) -->";
const END = "<!-- /DOCS-NAV -->";

function walk(dir) {
  const out = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

const allMd = walk(DOCS).filter((p) => !p.split(path.sep).includes("evidence"));
const mdSet = new Set(allMd);
const isIndex = (p) => path.basename(p) === "README.md" || p === path.join(DOCS, "README.md");
const dirHasReadme = (dir) => mdSet.has(path.join(dir, "README.md"));

// nearest ancestor index (README) at or above a directory
function indexOfDir(dir) {
  let d = dir;
  while (true) {
    if (dirHasReadme(d)) return path.join(d, "README.md");
    if (d === DOCS) return path.join(DOCS, "README.md");
    const parent = path.dirname(d);
    if (parent === d) return null;
    d = parent;
  }
}

// title from frontmatter `title:` (strip "kit-vnext —" prefix) else first H1 else basename
function titleOf(p) {
  const txt = fs.readFileSync(p, "utf8");
  const fm = txt.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const m = fm[1].match(/^title:\s*["']?(.+?)["']?\s*$/m);
    if (m) return m[1].replace(/^kit-vnext\s*[—-]\s*/i, "").replace(/\s*[-—]+\s*design\s*$/i, "").trim();
  }
  const h1 = txt.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return path.basename(p, ".md");
}

// link order inside an index README, restricted to targets that are real children
function linkOrder(indexPath, candidates) {
  const txt = fs.readFileSync(indexPath, "utf8").replace(/<!-- DOCS-NAV[\s\S]*?\/DOCS-NAV -->/g, "");
  const base = path.dirname(indexPath);
  const order = new Map();
  const re = /\]\(([^)]+)\)/g;
  let m;
  let i = 0;
  while ((m = re.exec(txt))) {
    const tgt = m[1].split("#")[0].trim();
    if (!tgt || /^(https?:|mailto:)/.test(tgt)) continue;
    const abs = path.normpath ? path.normpath(path.join(base, tgt)) : path.normalize(path.join(base, tgt));
    if (candidates.includes(abs) && !order.has(abs)) order.set(abs, i++);
  }
  return order;
}

// children of an index page
function childrenOf(indexPath) {
  const dir = path.dirname(indexPath);
  const candidates = [];
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isFile() && name.endsWith(".md") && p !== indexPath) {
      candidates.push(p);
    } else if (st.isDirectory() && name !== "evidence") {
      if (dirHasReadme(p)) candidates.push(path.join(p, "README.md"));
      else {
        // README-less subdir: pull its md files up as children of this index
        for (const f of walk(p)) if (!f.split(path.sep).includes("evidence")) candidates.push(f);
      }
    }
  }
  const order = linkOrder(indexPath, candidates);
  return candidates.sort((a, b) => {
    const oa = order.has(a) ? order.get(a) : Infinity;
    const ob = order.has(b) ? order.get(b) : Infinity;
    if (oa !== ob) return oa - ob;
    return a.localeCompare(b, "en", { numeric: true });
  });
}

const rootIndex = path.join(DOCS, "README.md");

// parent map
function parentOf(p) {
  if (p === rootIndex) return null;
  if (isIndex(p)) {
    const parentDir = path.dirname(path.dirname(p));
    return indexOfDir(parentDir);
  }
  return indexOfDir(path.dirname(p));
}

// depth-first pre-order linear sequence
const linear = [];
(function visit(p) {
  linear.push(p);
  if (isIndex(p)) for (const c of childrenOf(p)) visit(c);
})(rootIndex);

// sanity: every md file reachable exactly once
const seen = new Set(linear);
const missing = allMd.filter((p) => !seen.has(p));
if (missing.length) {
  console.error("WARNING: pages not reachable from root index:\n  " + missing.join("\n  "));
}
if (linear.length !== new Set(linear).size) console.error("WARNING: duplicate pages in linear order");

const rel = (from, to) => {
  let r = path.relative(path.dirname(from), to).split(path.sep).join("/");
  if (!r.startsWith(".")) r = "./" + r;
  return r;
};
const link = (from, to) => `[${titleOf(to)}](${rel(from, to)})`;

function navBlock(p) {
  const idx = linear.indexOf(p);
  const up = parentOf(p);
  const prev = idx > 0 ? linear[idx - 1] : null;
  const next = idx < linear.length - 1 ? linear[idx + 1] : null;
  const kids = isIndex(p) ? childrenOf(p) : [];

  const segs = [];
  if (up) segs.push(`**↑ Up:** ${link(p, up)}`);
  if (prev) segs.push(`**← Prev:** ${link(p, prev)}`);
  if (next) segs.push(`**Next →:** ${link(p, next)}`);

  const lines = [START, "", "---", ""];
  if (segs.length) lines.push(segs.join(" · "), "");
  if (kids.length) lines.push("**Children:** " + kids.map((k) => link(p, k)).join(" · "), "");
  lines.push(END);
  return lines.join("\n");
}

let changed = 0;
const stripRe = new RegExp(`\\n*${START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n*`, "g");

for (const p of linear) {
  const orig = fs.readFileSync(p, "utf8");
  const body = orig.replace(stripRe, "\n").replace(/\s+$/, "");
  const next = body + "\n\n" + navBlock(p) + "\n";
  if (next !== orig) {
    changed++;
    if (!DRY) fs.writeFileSync(p, next);
  }
}

if (DRY) {
  console.log("READING ORDER (" + linear.length + " pages):");
  linear.forEach((p, i) => {
    const depth = path.relative(DOCS, p).split(path.sep).length - 1;
    console.log(`${String(i).padStart(2)}  ${"  ".repeat(depth)}${path.relative(DOCS, p)}`);
  });
  console.log(`\nDRY RUN — would update ${changed}/${linear.length} files. No files written.`);
} else {
  console.log(`Updated ${changed}/${linear.length} files.`);
}
