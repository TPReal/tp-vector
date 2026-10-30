#!/usr/bin/env node
// Rewrites the line counts in the badge SVGs. Run from the repository root, with the
// directory holding the badges as the argument.

import {execFileSync} from "node:child_process";
import {readFileSync, writeFileSync} from "node:fs";

const MARKER = "<!-- LINE_COUNT_HERE -->";
const THIN_SPACE = "&#8201;";

const BADGES = [
  {file: "badge-ts.svg", pathSpecs: ["src/*.ts"]},
];

// Only tracked files are counted, so untracked and ignored files (e.g. custom projects in
// src/proj) are excluded for free.
function countLines(pathSpecs) {
  const files = execFileSync("git", ["ls-files", "-z", ...pathSpecs], {encoding: "utf8"})
    .split("\0")
    .filter(Boolean);
  if (!files.length) {
    throw new Error(`No files match ${pathSpecs.join(" ")}`);
  }
  return files.reduce((lines, file) => lines + readFileSync(file, "utf8").split("\n").length - 1, 0);
}

function groupDigits(count) {
  return String(count).replaceAll(/\B(?=(\d{3})+$)/g, THIN_SPACE);
}

const dir = process.argv[2] ?? "badges";
for (const {file, pathSpecs} of BADGES) {
  const path = `${dir}/${file}`;
  const svg = readFileSync(path, "utf8");
  if (!svg.includes(MARKER)) {
    throw new Error(`No ${MARKER} in ${path}`);
  }
  // Every occurrence is updated, so the count may be repeated in the SVG, e.g. as a shadow.
  writeFileSync(path, svg.replaceAll(new RegExp(`${MARKER}.*`, "g"), MARKER + groupDigits(countLines(pathSpecs))));
  console.log(`${path}: updated`);
}
