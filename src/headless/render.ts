/// <reference lib="deno.ns" />

import {parseArgs} from "node:util";
import type {DiffReport, RenderRequest, RunReport, SheetReport} from '../viewer/headless.ts';
import {Chrome} from './chrome.ts';

const DEFAULT_LONG_EDGE = 1600;
const DEFAULT_TIMEOUT_SECONDS = 30;

const USAGE = `Renders sections of the Viewer to PNG, laser SVG and JSON geometry reports.

Usage: cmds/render [options] <section>...

A section is specified by its name, or a unique part of it (case insensitive).

Options:
  --list              List the sections and exit.
  --all               Render all the sections with sheets.
  --runs <a,b>        Show only the specified runs in the PNG.
  --crop <x,y,w,h>    Show only this area in the PNG, in sheet units.
  --grid <step>       Draw a labelled grid over the PNG, with the step in sheet units.
  --px <n>            The length of the longer edge of the PNG (default: ${DEFAULT_LONG_EDGE}).
  --timeout <s>       The limit for creating the sheets of a section, and for rendering each sheet.
                      Exceeding it stops the whole command (default: ${DEFAULT_TIMEOUT_SECONDS}).
  --preset <name>     Use this global options preset of the Viewer.
  --entry <file>      The Viewer entry point (default: the one used by cmds/viewer).
  --out <dir>         The output directory (default: .render).
  --baseline <dir>    Compare to the render in this directory, instead of the previous one in
                      the output directory, and finish with a summary of the changed sheets.

Each sheet produces <out>/<section slug>/<sheet index>.{png,svg,json}, and the PNG name includes
also --runs, --crop and --grid. If the sheet was already rendered, the PNG and the JSON report are
compared to the earlier ones. Differences in the PNG are shown in a .diff.png file in the output
directory, and the JSON report also catches the changes too small to be visible.

Math.random is seeded at the start of each section, so that the renders can be compared.

The TP_VECTOR_CHROME environment variable overrides the path of the browser.`;

const TOOLS_DIR = ".tools";
const CHROME_PATH = `${TOOLS_DIR}/chrome-headless-shell-linux64/chrome-headless-shell`;
const DEFAULT_ENTRY = "src/viewer/viewer.ts";
const PROJECTS_VIEWER = "cmds/projects-viewer";
const API = "globalThis.tpVectorHeadless";
const SIGNALS = ["SIGINT", "SIGTERM"] as const;
const SEED_RANDOM = "tpVectorSeedRandom";
const RANDOM_SEED = 1;

/**
 * Replaces `Math.random` with the mulberry32 generator. It needs to run before the bundle, because
 * the modules can use it while they are loading.
 */
const SEEDED_RANDOM_SCRIPT = `{
  let state = ${RANDOM_SEED};
  globalThis.${SEED_RANDOM} = seed => {
    state = seed;
  };
  Math.random = () => {
    state = state + 0x6D2B79F5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 2 ** 32;
  };
}`;

type Report = Omit<SheetReport, "png" | "laserSVG">;

/** The sheets found when comparing to the baseline, as `<section slug>/<sheet index>`. */
interface Comparison {
  unchanged: number;
  readonly changed: string[];
  readonly added: string[];
  readonly removed: string[];
}

function readTextIfExists(path: string) {
  try {
    return Deno.readTextFileSync(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound)
      return undefined;
    throw e;
  }
}

function findEntry() {
  const script = readTextIfExists(PROJECTS_VIEWER);
  if (script === undefined)
    return DEFAULT_ENTRY;
  const entry = (readTextIfExists(script.trim()) ?? script).match(/^\s*(\S+viewer\.ts)\b/m)?.[1];
  if (!entry)
    throw new Error(`Cannot find the entry point in ${PROJECTS_VIEWER}, specify --entry.`);
  return entry;
}

async function bundle(entry: string) {
  const dir = await Deno.makeTempDir({prefix: "tp-vector-render-"});
  try {
    const {success} = await new Deno.Command("esbuild", {
      args: [
        entry,
        "--bundle",
        "--format=iife",
        "--alias:tp-vector=./src",
        `--outfile=${dir}/bundle.js`,
        "--charset=utf8",
        "--log-level=warning",
        ...["jpg", "png", "svg", "otf", "ttf", "woff", "woff2"].map(ext => `--loader:.${ext}=dataurl`),
      ],
      stdout: "inherit",
      stderr: "inherit",
    }).output();
    if (!success)
      throw new Error(`Failed to bundle ${entry}`);
    await Deno.writeTextFile(`${dir}/index.html`,
      `<!doctype html><meta charset="utf-8"><body>` +
      `<script>${SEEDED_RANDOM_SCRIPT}</script><script src="bundle.js"></script>`);
    return dir;
  } catch (e) {
    await Deno.remove(dir, {recursive: true});
    throw e;
  }
}

async function waitForAPI(chrome: Chrome) {
  for (let i = 0; i < 200; i++) {
    if (await chrome.evaluate(`typeof ${API} === "object"`))
      return;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`The Viewer did not start:\n${chrome.takeLogs().join("\n")}`);
}

function resolveSection(query: string, sections: readonly string[]) {
  const lower = query.toLowerCase();
  const exact = sections.filter(name => name.toLowerCase() === lower);
  const matches = exact.length ? exact : sections.filter(name => name.toLowerCase().includes(lower));
  if (matches.length !== 1) {
    const list = JSON.stringify(matches);
    throw new Error(`Section ${JSON.stringify(query)} matches ${matches.length} sections: ${list}`);
  }
  return matches[0];
}

function slug(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}

function parseNumbers(text: string, count: number, name: string) {
  const numbers = text.split(",").map(value => value.trim() ? Number(value) : NaN);
  if (numbers.length !== count || !numbers.every(Number.isFinite))
    throw new Error(`Expected ${count} numbers in ${name}, got ${JSON.stringify(text)}`);
  return numbers;
}

function parsePositive(text: string, name: string) {
  const [value] = parseNumbers(text, 1, name);
  if (value <= 0)
    throw new Error(`Expected a positive number in ${name}, got ${value}`);
  return value;
}

function dataURIToBytes(dataURI: string) {
  return Uint8Array.from(atob(dataURI.split(",")[1]), char => char.charCodeAt(0));
}

function bytesToDataURI(bytes: Uint8Array) {
  return `data:image/png;base64,${bytes.toBase64()}`;
}

async function readIfExists(path: string) {
  try {
    return await Deno.readFile(path);
  } catch (e) {
    if (e instanceof Deno.errors.NotFound)
      return undefined;
    throw e;
  }
}

function describeRun({id, type, side, cutsThrough, length, loops, others}: RunReport) {
  const closed = loops.filter(loop => loop.closed).length;
  const counts = [
    `${closed} closed`,
    `${loops.length - closed} open`,
    ...others.length ? [`${others.length} other`] : [],
  ];
  const kind = [type, side, ...cutsThrough ? ["through"] : []].join(", ");
  return `run ${JSON.stringify(id)} (${kind}): ${counts.join(", ")}, length ${length}`;
}

function getWarnings({runs, unusedLayers, fontsNotEmbedded}: SheetReport) {
  const warnings = [];
  if (unusedLayers.length)
    warnings.push(`layers not in any run: ${unusedLayers.join(", ")}`);
  if (fontsNotEmbedded.length)
    warnings.push(`fonts not embedded (system fonts, or failed to load): ${fontsNotEmbedded.join(", ")}`);
  for (const {id, nearMissGaps, duplicates, outOfSheet} of runs) {
    if (nearMissGaps.length) {
      const examples = nearMissGaps.slice(0, 4).map(({at: [x, y], size}) => `${size} at (${x}, ${y})`);
      warnings.push(`run ${id}: ${nearMissGaps.length} near-miss gaps, e.g. ${examples.join(", ")}`);
    }
    if (duplicates.length)
      warnings.push(`run ${id}: ${duplicates.length} duplicated strokes (double cuts)`);
    if (outOfSheet)
      warnings.push(`run ${id}: ${outOfSheet} elements stick out of the sheet`);
  }
  return warnings;
}

function describeDiff({sizeChanged, changedPixels, totalPixels}: DiffReport, path: string) {
  if (sizeChanged)
    return `diff: the image size changed`;
  if (!changedPixels)
    return `diff: no change`;
  const percent = (changedPixels / totalPixels * 100).toFixed(2);
  return `diff: ${changedPixels} pixels changed (${percent}%), see ${path}`;
}

function getReportParts({runs, ...rest}: Report): Record<string, unknown> {
  return {...rest, ...Object.fromEntries(runs.map(run => [`run ${run.id}`, run]))};
}

function getReportChanges(baseline: Report, report: Report) {
  const [before, after] = [getReportParts(baseline), getReportParts(report)];
  return [...new Set([...Object.keys(before), ...Object.keys(after)])]
    .filter(key => JSON.stringify(before[key]) !== JSON.stringify(after[key]));
}

async function compareToBaseline(chrome: Chrome, {
  baselinePNGPath,
  baselineReportPath,
  diffPath,
  png,
  report,
}: {
  baselinePNGPath: string,
  baselineReportPath: string,
  diffPath: string,
  png: string,
  report: Report,
}) {
  await Deno.remove(diffPath).catch(() => {});
  const baselinePNG = await readIfExists(baselinePNGPath);
  if (!baselinePNG)
    return undefined;
  const diff = await chrome.evaluate<DiffReport>(
    `${API}.diffPNGs(${JSON.stringify(bytesToDataURI(baselinePNG))}, ${JSON.stringify(png)})`);
  if (diff.dataURI)
    await Deno.writeFile(diffPath, dataURIToBytes(diff.dataURI));
  const baselineReport = readTextIfExists(baselineReportPath);
  const reportChanges =
    baselineReport === undefined ? [] : getReportChanges(JSON.parse(baselineReport), report);
  return {
    changed: diff.sizeChanged || !!diff.changedPixels || !!reportChanges.length,
    description: [
      describeDiff(diff, diffPath),
      ...reportChanges.length ? [`report changed: ${reportChanges.join(", ")}`] : [],
    ],
  };
}

function printComparison({unchanged, changed, added, removed}: Comparison, baseline: string) {
  console.log(`Compared to ${baseline}: ${unchanged} unchanged, ${changed.length} changed, ` +
    `${added.length} new, ${removed.length} removed.`);
  for (const [label, sheets] of [["changed", changed], ["new", added], ["removed", removed]] as const)
    if (sheets.length)
      console.log(`${label}: ${sheets.join(" ")}`);
}

async function renderSection(chrome: Chrome, section: string, {
  request,
  out,
  baseline,
  pngSuffix,
  comparison,
}: {
  request: RenderRequest,
  out: string,
  baseline: string,
  pngSuffix: string,
  comparison: Comparison,
}) {
  const sectionSlug = slug(section);
  const dir = `${out}/${sectionSlug}`;
  await chrome.evaluate(`${SEED_RANDOM}(${RANDOM_SEED})`);
  const sheetsCount = await chrome.evaluate<number>(`${API}.loadSection(${JSON.stringify(section)})`);
  await Deno.mkdir(dir, {recursive: true});
  const runIds = new Set<string>();
  for (let index = 0; index < sheetsCount; index++) {
    const {png, laserSVG, ...report} = await chrome.evaluate<SheetReport>(
      `${API}.renderSheet(${index}, ${JSON.stringify(request)})`);
    const pngPath = `${dir}/${index}${pngSuffix}.png`;
    const sheetId = `${sectionSlug}/${index}`;
    const result = await compareToBaseline(chrome, {
      baselinePNGPath: `${baseline}/${sheetId}${pngSuffix}.png`,
      baselineReportPath: `${baseline}/${sheetId}.json`,
      diffPath: pngPath.replace(/\.png$/, ".diff.png"),
      png: png.dataURI,
      report,
    });
    if (!result)
      comparison.added.push(sheetId);
    else if (result.changed)
      comparison.changed.push(sheetId);
    else
      comparison.unchanged++;
    await Deno.writeFile(pngPath, dataURIToBytes(png.dataURI));
    await Deno.writeTextFile(`${dir}/${index}.svg`, laserSVG);
    await Deno.writeTextFile(`${dir}/${index}.json`, JSON.stringify(report, undefined, 1));
    const {minX, minY, width, height} = report.viewBox;
    console.log(`${index}: ${report.name ?? "(unnamed)"}, ${report.size}, ` +
      `view box ${minX} ${minY} ${width} ${height}, ` +
      `${report.millimetersPerUnit ?? "unknown"} mm per unit`);
    console.log(`  ${pngPath} (${png.width}×${png.height}), ${dir}/${index}.{svg,json}`);
    for (const run of report.runs) {
      runIds.add(run.id);
      console.log(`  ${describeRun(run)}`);
    }
    for (const warning of getWarnings({png, laserSVG, ...report}))
      console.log(`  warning: ${warning}`);
    for (const line of result?.description ?? [])
      console.log(`  ${line}`);
  }
  if (!sheetsCount)
    console.log(`No sheets.`);
  for (let i = sheetsCount; await readIfExists(`${baseline}/${sectionSlug}/${i}${pngSuffix}.png`); i++)
    comparison.removed.push(`${sectionSlug}/${i}`);
  for (const run of request.runs ?? [])
    if (!runIds.has(run))
      console.log(`warning: no sheet has run ${JSON.stringify(run)}`);
}

async function main() {
  const {values, positionals} = parseArgs({
    allowPositionals: true,
    options: {
      help: {type: "boolean"},
      list: {type: "boolean"},
      all: {type: "boolean"},
      runs: {type: "string"},
      crop: {type: "string"},
      grid: {type: "string"},
      px: {type: "string"},
      timeout: {type: "string"},
      preset: {type: "string"},
      entry: {type: "string"},
      out: {type: "string", default: ".render"},
      baseline: {type: "string"},
    },
  });
  if (values.help || (!values.list && !values.all && !positionals.length)) {
    console.log(USAGE);
    return;
  }
  if (values.all && positionals.length)
    throw new Error(`Specify either --all or the sections.`);
  const crop = values.crop ? parseNumbers(values.crop, 4, "--crop") : undefined;
  if (crop && (crop[2] <= 0 || crop[3] <= 0))
    throw new Error(`Expected a positive size in --crop, got ${crop[2]}×${crop[3]}`);
  const timeoutSeconds =
    values.timeout ? parsePositive(values.timeout, "--timeout") : DEFAULT_TIMEOUT_SECONDS;
  const request: RenderRequest = {
    longEdge: values.px ? parsePositive(values.px, "--px") : DEFAULT_LONG_EDGE,
    runs: values.runs?.split(","),
    crop: crop && {minX: crop[0], minY: crop[1], width: crop[2], height: crop[3]},
    grid: values.grid ? parsePositive(values.grid, "--grid") : undefined,
  };
  const pngSuffix = [
    ...values.runs ? [`.runs-${slug(values.runs)}`] : [],
    ...values.crop ? [`.crop-${values.crop.replaceAll(",", "_")}`] : [],
    ...values.grid ? [`.grid-${values.grid}`] : [],
  ].join("");
  if (values.baseline !== undefined && !(await Deno.stat(values.baseline).catch(() => undefined)))
    throw new Error(`Baseline not found: ${values.baseline}`);
  const executable = Deno.env.get("TP_VECTOR_CHROME") ?? CHROME_PATH;
  if (!(await Deno.stat(executable).catch(() => undefined)))
    throw new Error(`Browser not found: ${executable}. Run cmds/render-setup first.`);

  const bundleDir = await bundle(values.entry ?? findEntry());
  const launching = Chrome.launch(executable, {timeoutMillis: timeoutSeconds * 1000});
  let cleanedUp: Promise<void> | undefined;
  const cleanUp = () => cleanedUp ??= (async () => {
    try {
      await (await launching).close();
    } finally {
      await Deno.remove(bundleDir, {recursive: true});
    }
  })();
  const onSignal = () => cleanUp().finally(() => Deno.exit(1));
  for (const signal of SIGNALS)
    Deno.addSignalListener(signal, onSignal);
  const comparison: Comparison = {unchanged: 0, changed: [], added: [], removed: []};
  let failures = 0;
  try {
    const chrome = await launching;
    const query = new URLSearchParams({headless: ""});
    if (values.preset !== undefined)
      query.set("global_options_preset", values.preset);
    await chrome.navigate(`file://${bundleDir}/index.html?${query}`);
    await waitForAPI(chrome);
    if (values.preset !== undefined) {
      const presets = await chrome.evaluate<readonly string[]>(`${API}.listPresets()`);
      if (!presets.includes(values.preset))
        throw new Error(`No preset ${JSON.stringify(values.preset)} in ${JSON.stringify(presets)}`);
    }
    const sections = await chrome.evaluate<readonly {name: string, hasSheets: boolean}[]>(
      `${API}.listSections()`);
    const names = sections.map(({name}) => name);
    if (values.list) {
      console.log(names.join("\n"));
      return;
    }
    const selected = values.all ?
      sections.filter(({hasSheets}) => hasSheets).map(({name}) => name) :
      positionals.map(query => resolveSection(query, names));
    for (const section of selected) {
      console.log(`# ${section}`);
      try {
        await renderSection(chrome, section, {
          request,
          out: values.out,
          baseline: values.baseline ?? values.out,
          pngSuffix,
          comparison,
        });
      } catch (e) {
        if (!chrome.connected)
          throw e;
        failures++;
        console.log(`FAILED: ${e instanceof Error ? e.message : e}`);
      }
      for (const log of chrome.takeLogs())
        console.log(`  console: ${log}`);
    }
    if (values.baseline !== undefined) {
      if (values.all) {
        const rendered = new Set(selected.map(slug));
        for await (const {name, isDirectory} of Deno.readDir(values.baseline))
          if (isDirectory && !rendered.has(name))
            comparison.removed.push(`${name}/`);
      }
      printComparison(comparison, values.baseline);
    }
  } finally {
    await cleanUp();
    for (const signal of SIGNALS)
      Deno.removeSignalListener(signal, onSignal);
  }
  if (failures)
    throw new Error(`Failed to render ${failures} of the sections.`);
}

try {
  await main();
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  Deno.exit(1);
}
