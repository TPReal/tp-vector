import {createElement} from '../elements.ts';
import {RunOptions} from '../options.ts';
import {Sheet} from '../sheet.ts';
import {getPNGDataURI} from '../svg_converter.ts';
import {assert} from '../util.ts';
import {SectionItemDef} from './types.ts';

/** Presence of this URL param makes the Viewer expose {@link HeadlessAPI} instead of its UI. */
const HEADLESS_KEY = "headless";

export function isHeadless() {
  return new URLSearchParams(location.search).has(HEADLESS_KEY);
}

export interface Box {
  readonly minX: number;
  readonly minY: number;
  readonly width: number;
  readonly height: number;
}

export interface RenderRequest {
  /** The length of the longer edge of the PNG, in pixels. */
  readonly longEdge: number;
  /** The runs to show in the PNG. All runs by default. */
  readonly runs?: readonly string[];
  /** The area to show in the PNG, in Sheet units. The whole Sheet by default. */
  readonly crop?: Box;
  /** The spacing of the labelled grid drawn over the PNG, in Sheet units. */
  readonly grid?: number;
}

/**
 * A connected chain of strokes. Its bounding box is in Sheet coordinates, and it is exact unless
 * the chain is rotated, and then it is based on sampled points, so it can miss a sharp corner.
 */
export interface Loop {
  readonly box: Box;
  /** Approximate if the loop is scaled differently along each axis. */
  readonly length: number;
  readonly closed: boolean;
  readonly strokes: number;
}

export interface RunReport {
  readonly id: string;
  readonly type: RunOptions["type"];
  readonly side: RunOptions["side"];
  readonly cutsThrough: boolean;
  readonly length: number;
  readonly loops: readonly Loop[];
  /** Elements which have a bounding box, but no stroke geometry. */
  readonly others: readonly {readonly tag: string, readonly box: Box}[];
  /** Ends of strokes not connected to any other stroke. Reported for cuts through only. */
  readonly danglingEnds: readonly (readonly [number, number])[];
  /**
   * Tiny gaps which would close an outline, so they are likely a mistake. Every open end of the
   * chains they join has exactly one other end nearby, and the gaps are small compared to those
   * chains, which tells them apart from loose ends which just happen to be close to each other.
   */
  readonly nearMissGaps: readonly {readonly at: readonly [number, number], readonly size: number}[];
  /** Strokes with the same geometry as another one, up to direction. Reported for cuts only. */
  readonly duplicates: readonly Box[];
  /** The number of elements sticking out of the Sheet's view box. */
  readonly outOfSheet: number;
}

export interface SheetReport {
  readonly name: string | undefined;
  readonly size: string;
  readonly fileName: string;
  readonly millimetersPerUnit: number | undefined;
  readonly viewBox: Box;
  readonly unusedLayers: readonly string[];
  /** The first-choice fonts of text elements which are not embedded in the SVG. */
  readonly fontsNotEmbedded: readonly string[];
  readonly runs: readonly RunReport[];
  readonly png: {readonly dataURI: string, readonly width: number, readonly height: number};
  readonly laserSVG: string;
}

export interface DiffReport {
  readonly sizeChanged: boolean;
  readonly changedPixels: number;
  readonly totalPixels: number;
  /** Removed content is red, added is green, unchanged is faded. Set if anything changed. */
  readonly dataURI?: string;
}

export interface HeadlessAPI {
  listSections(): readonly {readonly name: string, readonly hasSheets: boolean}[];
  listPresets(): readonly string[];
  /** Creates the Sheets of the section for {@link renderSheet}, and returns their number. */
  loadSection(name: string): Promise<number>;
  renderSheet(index: number, request: RenderRequest): Promise<SheetReport>;
  diffPNGs(before: string, after: string): Promise<DiffReport>;
}

export function installHeadlessAPI(
  sectionItems: readonly SectionItemDef[], presets: readonly string[]) {
  const sections = sectionItems.filter(item => item !== "separator");
  let sheets: readonly Sheet[] = [];
  const api: HeadlessAPI = {
    listSections: () => sections.map(({name, getSheets}) => ({name, hasSheets: !!getSheets})),
    listPresets: () => presets,
    async loadSection(name) {
      const section = sections.find(section => section.name === name);
      if (!section)
        throw new Error(`No such section: ${JSON.stringify(name)}`);
      if (!section.getSheets)
        throw new Error(`Section has no sheets: ${JSON.stringify(name)}`);
      sheets = await section.getSheets();
      return sheets.length;
    },
    renderSheet: (index, request) => reportSheet(sheets[index], request),
    diffPNGs,
  };
  Object.assign(globalThis, {tpVectorHeadless: api});
}

async function reportSheet(sheet: Sheet, request: RenderRequest): Promise<SheetReport> {
  const svg = await sheet.getPreviewSVG({border: false});
  svg.style.position = "fixed";
  svg.style.visibility = "hidden";
  document.body.append(svg);
  try {
    // The layout makes the browser start loading the fonts of the text.
    svg.getBBox();
    await document.fonts.ready;
    return {
      name: sheet.name,
      size: sheet.getSizeString(),
      fileName: sheet.getFileName(),
      millimetersPerUnit: sheet.options.millimetersPerUnit,
      viewBox: roundBox(sheet.viewBox),
      unusedLayers: sheet.getUnusedLayers().map(layer => layer ?? "NO_LAYER"),
      fontsNotEmbedded: getFontsNotEmbedded(svg),
      runs: sheet.getRunsOptions()
        .filter(({id}) => sheet.getNonEmptyRunIds().includes(id))
        .map(options => reportRun(svg, options, sheet)),
      png: await getPNG(sheet, request),
      laserSVG: new XMLSerializer().serializeToString(await sheet.getLaserSVG()),
    };
  } finally {
    svg.remove();
  }
}

/** Returned by a canvas which is empty, or too large to encode. */
const EMPTY_DATA_URI = "data:,";

async function getPNG(sheet: Sheet, {longEdge, runs, crop, grid}: RenderRequest) {
  const svg = await sheet.getPreviewSVG({
    border: false,
    runsSelector: runs && {runs: runs.filter(run => sheet.getRunIds().includes(run))},
  });
  if (crop)
    svg.setAttribute("viewBox", `${crop.minX} ${crop.minY} ${crop.width} ${crop.height}`);
  if (grid)
    svg.append(createGrid(svg.viewBox.baseVal, grid));
  const {width, height} = svg.viewBox.baseVal;
  const pixelsPerUnit = longEdge / Math.max(width, height);
  const dataURI = await getPNGDataURI(svg, {pixelsPerUnit, allowTransparency: false});
  if (dataURI === EMPTY_DATA_URI)
    throw new Error(`Cannot create a PNG of ${width}×${height} at ${pixelsPerUnit} pixels per unit`);
  return {
    dataURI,
    width: Math.floor(width * pixelsPerUnit),
    height: Math.floor(height * pixelsPerUnit),
  };
}

function createGrid({x, y, width, height}: DOMRect, step: number) {
  const size = Math.max(width, height);
  const stroke = "#0088ff";
  const fontSize = size / 70;
  const positions = (min: number, length: number) => {
    const result = [];
    for (let v = Math.ceil(min / step) * step; v <= min + length; v += step)
      result.push(round(v));
    return result;
  };
  const label = (text: number, labelX: number, labelY: number) => createElement({
    tagName: "text",
    attributes: {x: labelX, y: labelY, fill: stroke, stroke: "none", "font-size": fontSize},
    children: String(text),
  });
  const xs = positions(x, width);
  const ys = positions(y, height);
  return createElement({
    tagName: "g",
    attributes: {stroke, "stroke-width": size / 2500, "font-family": "sans-serif"},
    children: [
      ...xs.flatMap(lineX => [
        createElement({
          tagName: "line",
          attributes: {x1: lineX, x2: lineX, y1: y, y2: y + height},
        }),
        label(lineX, lineX + fontSize / 4, y + fontSize),
      ]),
      ...ys.flatMap(lineY => [
        createElement({
          tagName: "line",
          attributes: {x1: x, x2: x + width, y1: lineY, y2: lineY},
        }),
        label(lineY, x + fontSize / 4, lineY - fontSize / 4),
      ]),
    ],
  });
}

function getFontsNotEmbedded(svg: SVGSVGElement) {
  const embedded = new Set<string>();
  for (const style of svg.querySelectorAll("style"))
    for (const [, name] of style.textContent.matchAll(/@font-face\s*{[^}]*?font-family:\s*([^;}]+)/g))
      embedded.add(unquote(name));
  const missing = new Set<string>();
  for (const text of svg.querySelectorAll("text")) {
    const first = unquote(getComputedStyle(text).fontFamily.split(",")[0]);
    if (!embedded.has(first))
      missing.add(first);
  }
  return [...missing];
}

function unquote(text: string) {
  return text.trim().replace(/^["']|["']$/g, "");
}

const GEOMETRY_ELEMENTS = "path, circle, ellipse, rect, line, polygon, polyline";
const OTHER_ELEMENTS = "text, image, use";
const NOT_RENDERED_ELEMENTS = "defs, clipPath, mask, pattern, symbol, marker";
const CLOSED_TAGS = new Set(["circle", "ellipse", "rect", "polygon"]);

interface Stroke {
  readonly start: DOMPoint;
  readonly middle: DOMPoint;
  readonly end: DOMPoint;
  readonly closed: boolean;
  readonly length: number;
  readonly box: Box;
}

function reportRun(svg: SVGSVGElement, options: RunOptions, sheet: Sheet): RunReport {
  const {id, type, side} = options;
  const cutsThrough = type === "cut" && options.cutsThrough;
  const group = assert(svg.querySelector(`:scope > g[id="${CSS.escape(id)}"]`));
  const rootInverse = assert(svg.getScreenCTM()).inverse();
  const toSheet = (element: SVGGraphicsElement) =>
    rootInverse.multiply(assert(element.getScreenCTM()));
  const rendered = <E extends SVGGraphicsElement>(selector: string) =>
    [...group.querySelectorAll<E>(selector)].filter(el => !el.closest(NOT_RENDERED_ELEMENTS));

  const probe = createElement({tagName: "path"});
  svg.append(probe);
  const strokes = rendered<SVGGeometryElement>(GEOMETRY_ELEMENTS)
    .flatMap(element => measureElement(element, toSheet(element), probe));
  probe.remove();

  const others = rendered(OTHER_ELEMENTS).map(element => ({
    tag: element.tagName,
    box: roundBox(transformedBox(element, toSheet(element))),
  }));
  const sheetSize = Math.max(sheet.viewBox.width, sheet.viewBox.height);
  const tolerance = 1e-4 * sheetSize;
  const {loops, openEnds} = chainIntoLoops(strokes, tolerance);
  return {
    id,
    type,
    side,
    cutsThrough,
    length: round(strokes.reduce((sum, {length}) => sum + length, 0)),
    loops: loops.map(loop => ({...loop, box: roundBox(loop.box), length: round(loop.length)})),
    others,
    danglingEnds: cutsThrough ? openEnds.map(({point: {x, y}}) => [round(x), round(y)]) : [],
    nearMissGaps: cutsThrough ? findNearMissGaps(openEnds, NEAR_MISS_GAP * sheetSize) : [],
    duplicates: type === "cut" ? findDuplicates(strokes) : [],
    outOfSheet: [...strokes.map(({box}) => box), ...others.map(({box}) => box)]
      .filter(box => !boxContains(sheet.viewBox, box, tolerance)).length,
  };
}

function measureElement(element: SVGGeometryElement, toSheet: DOMMatrix, probe: SVGPathElement) {
  if (element.tagName !== "path")
    return element.getTotalLength() ?
      [measureGeometry(element, toSheet, CLOSED_TAGS.has(element.tagName))] : [];
  const strokes: Stroke[] = [];
  let current = {x: 0, y: 0};
  for (const [subpath] of (element.getAttribute("d") ?? "").matchAll(/[Mm][^Mm]*/g)) {
    probe.setAttribute("d", absoluteSubpath(subpath, current));
    const start = probe.getPointAtLength(0);
    const end = probe.getPointAtLength(probe.getTotalLength());
    const closed = /[Zz]\s*$/.test(subpath);
    current = closed ? start : end;
    if (probe.getTotalLength() > 0)
      strokes.push(measureGeometry(probe, toSheet, closed));
  }
  return strokes;
}

const NUMBER = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`;
const RELATIVE_MOVE = new RegExp(String.raw`^m\s*(${NUMBER})[\s,]*(${NUMBER})[\s,]*(.*)$`, "s");

/** Converts a subpath so that it does not depend on the point where the previous one ended. */
function absoluteSubpath(subpath: string, current: {x: number, y: number}) {
  const match = subpath.match(RELATIVE_MOVE);
  if (!match)
    return subpath;
  const [, dx, dy, rest] = match;
  const implicitLine = /^[-+.\d]/.test(rest) ? "l" : "";
  return `M${current.x + Number(dx)},${current.y + Number(dy)} ${implicitLine}${rest}`;
}

function measureGeometry(element: SVGGeometryElement, toSheet: DOMMatrix, closed: boolean): Stroke {
  const length = element.getTotalLength();
  const scale = Math.sqrt(Math.abs(toSheet.a * toSheet.d - toSheet.b * toSheet.c));
  return {
    start: element.getPointAtLength(0).matrixTransform(toSheet),
    middle: element.getPointAtLength(length / 2).matrixTransform(toSheet),
    end: element.getPointAtLength(length).matrixTransform(toSheet),
    closed,
    length: length * scale,
    box: transformedBox(element, toSheet),
  };
}

const ROTATED_BOX_SAMPLES = 256;
/** The largest gap considered a near miss, relative to the size of the Sheet. */
const NEAR_MISS_GAP = 0.0025;
/** How many times a near miss gap must be shorter than the chains it joins. */
const NEAR_MISS_MIN_CHAIN_RATIO = 10;

/** The box is exact unless the element is rotated, and then it is based on sampled points. */
function transformedBox(element: SVGGraphicsElement, toSheet: DOMMatrix): Box {
  const {a, b, c, d} = toSheet;
  const isZero = (v: number) => Math.abs(v) < 1e-9;
  const axisAligned = (isZero(b) && isZero(c)) || (isZero(a) && isZero(d));
  let points;
  if (axisAligned || !(element instanceof SVGGeometryElement)) {
    const {x, y, width, height} = element.getBBox();
    points = [[x, y], [x + width, y], [x, y + height], [x + width, y + height]]
      .map(([px, py]) => new DOMPoint(px, py).matrixTransform(toSheet));
  } else {
    const length = element.getTotalLength();
    points = Array.from({length: ROTATED_BOX_SAMPLES + 1}, (_, i) =>
      element.getPointAtLength(i / ROTATED_BOX_SAMPLES * length).matrixTransform(toSheet));
  }
  const xs = points.map(({x}) => x);
  const ys = points.map(({y}) => y);
  const [minX, minY] = [Math.min(...xs), Math.min(...ys)];
  return {minX, minY, width: Math.max(...xs) - minX, height: Math.max(...ys) - minY};
}

function createDisjointSets(size: number) {
  const parents = Array.from({length: size}, (_, i) => i);
  const findRoot = (i: number) => {
    while (parents[i] !== i)
      i = parents[i] = parents[parents[i]];
    return i;
  };
  return {findRoot, join: (a: number, b: number) => void (parents[findRoot(a)] = findRoot(b))};
}

/** An end of a stroke not connected to anything, in a chain of strokes, identified by a number. */
interface OpenEnd {
  readonly point: DOMPoint;
  readonly chain: number;
  readonly chainLength: number;
}

function chainIntoLoops(strokes: readonly Stroke[], tolerance: number) {
  const {findRoot, join} = createDisjointSets(strokes.length);
  const ends = new Map<string, {point: DOMPoint, stroke: number, count: number}>();
  const cell = (v: number, offset: number) => Math.round(v / tolerance) + offset;
  const findEnd = ({x, y}: DOMPoint) => {
    for (const dx of [-1, 0, 1])
      for (const dy of [-1, 0, 1]) {
        const end = ends.get(`${cell(x, dx)},${cell(y, dy)}`);
        if (end)
          return end;
      }
    return undefined;
  };
  strokes.forEach(({start, end, closed}, stroke) => {
    if (closed)
      return;
    for (const point of [start, end]) {
      const found = findEnd(point);
      if (found) {
        found.count++;
        join(stroke, found.stroke);
      } else
        ends.set(`${cell(point.x, 0)},${cell(point.y, 0)}`, {point, stroke, count: 1});
    }
  });
  const groups = new Map<number, Stroke[]>();
  strokes.forEach((stroke, i) => {
    const root = findRoot(i);
    groups.set(root, [...groups.get(root) ?? [], stroke]);
  });
  const totalLength = (chain: readonly Stroke[]) => chain.reduce((sum, {length}) => sum + length, 0);
  const openEnds = [...ends.values()].filter(({count}) => count === 1).map(({point, stroke}) => {
    const chain = findRoot(stroke);
    return {point, chain, chainLength: totalLength(assert(groups.get(chain)))};
  });
  const openChains = new Set(openEnds.map(({chain}) => chain));
  const loops = [...groups].map(([root, group]) => ({
    box: boundingBox(group.map(({box}) => box)),
    length: totalLength(group),
    closed: !openChains.has(root),
    strokes: group.length,
  }));
  return {
    loops: loops.sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height),
    openEnds,
  };
}

function findNearMissGaps(ends: readonly OpenEnd[], maxSize: number) {
  const gaps = ends.flatMap((end, i) => ends.slice(i + 1).flatMap(other => {
    const size = Math.hypot(other.point.x - end.point.x, other.point.y - end.point.y);
    return size <= maxSize ? [{end, other, size}] : [];
  }));
  const {findRoot, join} = createDisjointSets(1 + Math.max(-1, ...ends.map(({chain}) => chain)));
  for (const {end, other} of gaps)
    join(end.chain, other.chain);
  const nearbyEnds = new Map<OpenEnd, number>();
  for (const end of gaps.flatMap(({end, other}) => [end, other]))
    nearbyEnds.set(end, (nearbyEnds.get(end) ?? 0) + 1);
  const unmatched = new Set(ends.filter(end => nearbyEnds.get(end) !== 1).map(({chain}) => findRoot(chain)));
  const lengths = new Map<number, number>();
  for (const {chain, chainLength} of new Map(ends.map(end => [end.chain, end])).values())
    lengths.set(findRoot(chain), (lengths.get(findRoot(chain)) ?? 0) + chainLength);
  return gaps
    .filter(({end, size}) => {
      const root = findRoot(end.chain);
      return !unmatched.has(root) && size * NEAR_MISS_MIN_CHAIN_RATIO <= assert(lengths.get(root));
    })
    .map(({end: {point: {x, y}}, size}) => ({at: [round(x), round(y)] as const, size: round(size)}));
}

function findDuplicates(strokes: readonly Stroke[]) {
  const seen = new Set<string>();
  const duplicates = [];
  for (const {box, length, closed, start, middle, end} of strokes) {
    // A closed stroke can start anywhere, so it is identified without these points.
    const points = closed ? [] : [start, middle, end].map(({x, y}) => [round(x), round(y)]).sort();
    const key = JSON.stringify([roundBox(box), round(length), points]);
    if (seen.has(key))
      duplicates.push(roundBox(box));
    seen.add(key);
  }
  return duplicates;
}

function boundingBox(boxes: readonly Box[]): Box {
  const minX = Math.min(...boxes.map(box => box.minX));
  const minY = Math.min(...boxes.map(box => box.minY));
  return {
    minX,
    minY,
    width: Math.max(...boxes.map(box => box.minX + box.width)) - minX,
    height: Math.max(...boxes.map(box => box.minY + box.height)) - minY,
  };
}

function boxContains(outer: Box, inner: Box, tolerance = 0) {
  return inner.minX >= outer.minX - tolerance && inner.minY >= outer.minY - tolerance &&
    inner.minX + inner.width <= outer.minX + outer.width + tolerance &&
    inner.minY + inner.height <= outer.minY + outer.height + tolerance;
}

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function roundBox({minX, minY, width, height}: Box): Box {
  return {minX: round(minX), minY: round(minY), width: round(width), height: round(height)};
}

async function getPixels(dataURI: string) {
  const image = new Image();
  image.src = dataURI;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = assert(canvas.getContext("2d", {willReadFrequently: true}));
  context.drawImage(image, 0, 0);
  return {canvas, context, image: context.getImageData(0, 0, canvas.width, canvas.height)};
}

async function diffPNGs(before: string, after: string): Promise<DiffReport> {
  const old = await getPixels(before);
  const {canvas, context, image} = await getPixels(after);
  const totalPixels = image.width * image.height;
  if (old.image.width !== image.width || old.image.height !== image.height)
    return {sizeChanged: true, changedPixels: totalPixels, totalPixels};
  const brightness = (data: Uint8ClampedArray, i: number) => data[i] + data[i + 1] + data[i + 2];
  const oldData = old.image.data;
  const {data} = image;
  let changedPixels = 0;
  for (let i = 0; i < data.length; i += 4) {
    const changed = [0, 1, 2].some(c => oldData[i + c] !== data[i + c]);
    if (changed) {
      changedPixels++;
      const removed = brightness(data, i) > brightness(oldData, i);
      data.set(removed ? [255, 0, 0] : [0, 170, 0], i);
    } else
      for (let c = 0; c < 3; c++)
        data[i + c] = 255 - (255 - data[i + c]) / 5;
  }
  if (!changedPixels)
    return {sizeChanged: false, changedPixels, totalPixels};
  context.putImageData(image, 0, 0);
  return {sizeChanged: false, changedPixels, totalPixels, dataURI: canvas.toDataURL()};
}
