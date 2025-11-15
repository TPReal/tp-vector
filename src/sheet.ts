import {ArtifactData, PartialArtifactData, artifactDataFromPartial, saveArtifact} from './artifacts.ts';
import {Attributes, createElement, createSVG, setAttributes} from './elements.ts';
import * as figures from './figures.ts';
import {Font} from './fonts.ts';
import {Image} from './images.ts';
import {NO_LAYER} from './layers.ts';
import * as layouts from './layouts.ts';
import {getNameSizeSuffix, getSizeString, getSuffixedFileName} from './name.ts';
import {Medium, PartialRunOptions, PartialSheetOptions, RunOptions, SheetOptions, Side, runOptionsFromPartial, sheetOptionsFromPartial} from './options.ts';
import {BasicPiece, Defs, Piece, gather} from './pieces.ts';
import {Point, pointDebugString} from './point.ts';
import {getPNGDataURI} from './svg_converter.ts';
import {saveSVG, saveSVGAsPNG} from './svg_saver.ts';
import {createText} from './text.ts';
import {ButtonsRow} from './ui.ts';
import {OrArray, assert, flatten, flattenFilter, roundReasonably} from './util.ts';
import {PartialViewBox, PartialViewBoxMargin, ViewBox, extendViewBox, viewBoxFromPartial, viewBoxMarginFromPartial, viewBoxToString} from './view_box.ts';

const DEFAULT_SVG_BORDER_STYLE = "solid #00f4 1px";

type SVGBorderStyle = string | boolean;

function addBorder(
  element: HTMLElement | SVGSVGElement, border: SVGBorderStyle) {
  if (border)
    element.style.border = border === true ? DEFAULT_SVG_BORDER_STYLE : border;
}

function createSaveButton({label, hint, save}: {
  label?: string,
  hint?: string,
  save: () => void,
}) {
  const button = document.createElement("button");
  button.textContent = label || `Save`;
  if (hint)
    button.title = hint;
  button.addEventListener("click", save);
  return button;
}

interface PartialRunsSelectorInterface {
  runs?: string[] | "all";
  cornersMarker?: boolean | "auto";
  reversingFrame?: boolean | "auto";
}
export type PartialRunsSelector = PartialRunsSelectorInterface | string[];
export interface RunsSelector {
  runs: string[] | "all";
  cornersMarker: boolean;
  reversingFrame: boolean;
}

export type SaveFormat = "SVG" | "PNG";

export interface PartialLaserSVGParams {
  format?: SaveFormat;
  printsAsImages?: boolean;
  runsSelector?: PartialRunsSelector;
}
export interface LaserSVGParams {
  format: SaveFormat;
  printsAsImages: boolean;
  runsSelector: RunsSelector;
}

export type ButtonSaveFormat = SaveFormat | "both";

const DEFAULT_RUNS: PartialRunOptions[] = [{type: "print"}, {type: "cut"}];

export interface BasicSheetParams {
  options?: PartialSheetOptions;
  margin?: PartialViewBoxMargin;
  viewBox?: PartialViewBox | "auto";
  runs?: PartialRunOptions[];
  preserveRunsOrder?: boolean;
  artifacts?: (sheet: Sheet) => PartialArtifactData[];
}

export interface SheetParams extends BasicSheetParams {
  pieces: OrArray<BasicPiece | undefined>;
}

export function mergeSheetParams<S extends BasicSheetParams | undefined>(basic: OrArray<BasicSheetParams | undefined>, params: S):
  S extends SheetParams ? SheetParams : BasicSheetParams {
  let result: BasicSheetParams = {};
  function merge<S extends BasicSheetParams>(result: BasicSheetParams, params: S): S {
    return {
      ...result,
      ...params,
      options: {...result.options, ...params.options},
      artifacts: (sheet) => [...result.artifacts?.(sheet) || [], ...params.artifacts?.(sheet) || []],
    };
  }
  for (const basicParams of flatten(basic))
    if (basicParams)
      result = merge(result, basicParams);
  return (params ? merge(result, params) : result) as S extends SheetParams ? SheetParams : BasicSheetParams;
}

export class Sheet {

  private readonly runHandles?: ReadonlyMap<string, SVGGElement>;

  protected constructor(
    readonly options: SheetOptions,
    private readonly pieces: Piece,
    readonly viewBox: ViewBox,
    private readonly runOptions: ReadonlyMap<string, RunOptions>,
    private readonly emptyRuns: ReadonlySet<string>,
    private readonly preserveRunsOrder: boolean,
    private readonly artifacts: readonly ArtifactData[],
  ) {
    this.runHandles = this.createHandles();
  }

  get name() {return this.options.name;}

  static create({
    options = {},
    pieces,
    margin = 1,
    viewBox = "auto",
    runs,
    preserveRunsOrder = false,
    artifacts,
  }: SheetParams) {
    const sheetOptions = sheetOptionsFromPartial(options);
    const fullPieces = gather(flattenFilter(pieces));
    const fullMargin = viewBoxMarginFromPartial(margin);
    const box = viewBox === "auto" ? fullPieces.getBoundingBox(fullMargin) :
      extendViewBox(viewBoxFromPartial(viewBox), margin);
    const allRuns = flatten(runs || DEFAULT_RUNS);
    const runOptionsMap = new Map<string, RunOptions>();
    const emptyRuns = new Set<string>();
    for (const opts of allRuns) {
      const runOptions = runOptionsFromPartial(sheetOptions, opts);
      if (runOptionsMap.has(runOptions.id))
        throw new Error(`Duplicate run id: ${JSON.stringify(runOptions.id)}`);
      runOptionsMap.set(runOptions.id, runOptions);
      if (!fullPieces.selectLayers(...runOptions.layers).getElements().length)
        emptyRuns.add(runOptions.id);
    }
    const artifactsData: ArtifactData[] = [];
    const sheet = new Sheet(
      sheetOptions,
      fullPieces,
      box,
      runOptionsMap,
      emptyRuns,
      preserveRunsOrder,
      artifactsData,
    );
    if (artifacts)
      artifactsData.push(...artifacts(sheet).map(artifactDataFromPartial));
    return sheet;
  }

  private getRunOptions(id: string) {
    const runOptions = this.runOptions.get(id);
    if (!runOptions)
      throw new Error(`No run with id ${JSON.stringify(id)}`);
    return runOptions;
  }

  private getRunPiece({runOptions, medium}: {
    runOptions: RunOptions,
    medium: Medium,
  }) {
    let pieces = this.pieces.selectLayers(...runOptions.layers);
    if (medium === "laser") {
      if (runOptions.posCorrectionMillimeters && this.options.millimetersPerUnit !== undefined) {
        const [dxMm, dyMm] = runOptions.posCorrectionMillimeters;
        pieces = pieces.translate(
          -dxMm / this.options.millimetersPerUnit, -dyMm / this.options.millimetersPerUnit);
      }
      if (runOptions.side === "back")
        pieces = pieces.flipX(this.viewBox.minX + this.viewBox.width / 2);
      if (this.options.cornersMarker.enable && runOptions.includeCornersMarker)
        pieces = gather(pieces, this.getCornersMarkerRawPiece(medium));
    }
    return {
      defs: pieces,
      runGroup: pieces.asG({
        id: runOptions.id,
        ...runOptions.styleAttributes[medium],
      }),
    };
  }

  private getCornersMarkerRawPiece(medium: Medium) {
    const {minX, minY, width, height} = this.viewBox;
    let cornersMarker;
    if (this.options.cornersMarker.type === "circles")
      cornersMarker = gather(
        figures.circle({center: [minX + width, minY + height], radius: 0}),
        figures.circle({center: [minX, minY], radius: 0}),
      );
    else if (this.options.cornersMarker.type === "lines")
      cornersMarker = gather(
        figures.line([minX, minY], [minX + 1e-9, minY]),
        figures.line([minX + width, minY + height], [minX + width - 1e-9, minY + height]),
      );
    else
      cornersMarker = this.options.cornersMarker.type satisfies never;
    return cornersMarker.asG({
      class: this.options.cornersMarker.id,
      ...this.options.cornersMarker.styleAttributes[medium],
    });
  }

  private getCornersMarker(medium: Medium) {
    const {id} = this.options.cornersMarker;
    return {
      id,
      group: this.getCornersMarkerRawPiece(medium),
    };
  }

  private getReversingFrame(medium: Medium) {
    const {id} = this.options.reversingFrame;
    return {
      id,
      group: figures.rectangle(this.viewBox).asG(
        {id, ...this.options.reversingFrame.styleAttributes[medium]}),
    };
  }

  getRunIds() {
    return [...this.runOptions.keys()];
  }

  getNonEmptyRunIds() {
    return this.getRunIds().filter(id => !this.emptyRuns.has(id));
  }

  private runsSelectorFromPartial({
    medium,
    runsSelector = {},
  }: {
    medium?: Medium,
    runsSelector?: PartialRunsSelector,
  } = {}): RunsSelector {
    let runsSelectorInterface: PartialRunsSelectorInterface;
    if (Array.isArray(runsSelector))
      runsSelectorInterface = {runs: runsSelector};
    else
      runsSelectorInterface = runsSelector;
    const {
      runs = "all",
      cornersMarker = "auto",
      reversingFrame = "auto",
    } = runsSelectorInterface;
    const fullRuns = this.runsOrAll(runs);
    function assertMedium() {
      if (!medium)
        throw new Error(`Specifying medium is required when using "auto"`);
      return medium;
    }
    if (reversingFrame === true && !this.options.reversingFrame.enable)
      throw new Error(`Cannot specify reversingFrame:true when ` +
        `reversing frame is not enabled in sheet options`);
    if (cornersMarker === true && !this.options.cornersMarker.enable)
      throw new Error(`Cannot specify cornersMarker:true when ` +
        `corners marker is not enabled in sheet options`);
    const fullReversingFrame = reversingFrame === "auto" ?
      this.options.reversingFrame.enable && assertMedium() === "laser" &&
      fullRuns.some(id => this.getRunOptions(id).side === "back") :
      reversingFrame;
    const fullCornersMarker = cornersMarker === "auto" ?
      this.options.cornersMarker.enable && !fullReversingFrame && assertMedium() === "laser" &&
      !fullRuns.some(id => this.getRunOptions(id).includeCornersMarker) :
      cornersMarker;
    return {
      runs: runs === "all" ? "all" : fullRuns,
      cornersMarker: fullCornersMarker,
      reversingFrame: fullReversingFrame,
    };
  }

  private runsOrAll(runs: RunsSelector["runs"]) {
    return runs === "all" ? this.getNonEmptyRunIds() : [...new Set(runs)];
  }

  private getRunsTypes({runs, reversingFrame}: RunsSelector): {cut: boolean, print: boolean} {
    const result = {cut: false, print: false};
    for (const run of this.runsOrAll(runs))
      result[this.getRunOptions(run).type] = true;
    if (reversingFrame)
      result.cut = true;
    return result;
  }

  laserSVGParamsFromPartial({
    format = "SVG",
    printsAsImages = false,
    runsSelector,
  }: PartialLaserSVGParams = {}): LaserSVGParams {
    return {
      format,
      printsAsImages,
      runsSelector: this.runsSelectorFromPartial({medium: "laser", runsSelector}),
    };
  }

  private async getRawSVG({
    medium,
    printsAsImages = false,
    runsSelector = {},
  }: {
    medium: Medium,
    printsAsImages?: boolean,
    runsSelector?: PartialRunsSelector,
  }): Promise<SVGSVGElement> {
    const {runs, cornersMarker, reversingFrame} =
      this.runsSelectorFromPartial({medium, runsSelector});
    const runsData: {
      id: string,
      defs?: Defs,
      group: SVGGElement,
      extraAttributes?: Attributes,
      sibling?: SVGElement,
    }[] = [];
    for (const id of this.runsOrAll(runs)) {
      const runOptions = this.getRunOptions(id);
      let defs;
      let group;
      if (runOptions.type === "print" && printsAsImages) {
        // TODO: Consider converting pieces to PNG separately, at declared levels.
        group = (await Image.fromURL(await getPNGDataURI(
          await this.getRawSVG({
            medium,
            printsAsImages: false,
            runsSelector: {
              runs: [id],
              cornersMarker,
              reversingFrame,
            },
          }), this.options.resolution),
          {
            scaling: {
              width: this.viewBox.width,
              height: this.viewBox.height,
            },
          }))
          .translate(this.viewBox.minX, this.viewBox.minY)
          .asG({id: runOptions.id});
      } else
        ({defs, runGroup: group} = this.getRunPiece({runOptions, medium}));
      runsData.push({id, defs, group});
    }
    if (cornersMarker)
      runsData.push(this.getCornersMarker(medium));
    if (reversingFrame)
      runsData.push(this.getReversingFrame(medium));
    const {laserRunsOptions} = this.options;
    if (medium === "laser") {
      if (laserRunsOptions.colorCodes)
        for (const runData of runsData)
          runData.extraAttributes = {
            fill: laserRunsOptions.colorCodes.get(runData.id),
          };
      if (this.runHandles)
        for (const runData of runsData)
          runData.sibling = this.runHandles.get(runData.id);
    }
    const defsElement = gather(runsData.map(({defs}) => defs)).getDefsElement();
    const groups = runsData.map(({id, group, extraAttributes, sibling}) => {
      if (extraAttributes || sibling) {
        setAttributes(group, {id: undefined});
        return createElement({
          tagName: "g",
          attributes: {
            ...extraAttributes,
            id,
          },
          children: [sibling, group],
        });
      }
      return group;
    });
    return createSVG({
      viewBox: this.viewBox,
      millimetersPerUnit: medium === "laser" ? this.options.millimetersPerUnit : undefined,
      children: [defsElement, ...groups],
    })
  }

  private createHandles(): ReadonlyMap<string, SVGGElement> | undefined {
    const {handles} = this.options.laserRunsOptions;
    if (!handles)
      return undefined;
    const ids = this.getHandleRuns();
    if (ids.length < 2)
      return undefined;
    const wid = this.viewBox.width / ids.length;
    const baseWid = 100;
    const margin = 2;
    const handleBox = extendViewBox(viewBoxFromPartial({
      width: baseWid,
      height: 15,
      ...handles.pos === "above" ? {maxY: 0} :
        handles.pos === "below" ? {minY: 0} :
          handles.pos satisfies never,
    }), -margin);
    return new Map(ids.map(({runId, type, hint}, index) => {
      const grabAreaSize = handleBox.height - 4;
      const grabAreaGaps = 0.5;
      const grabArea = layouts.layout({
        count: grabAreaSize / grabAreaGaps + 1,
        pieceFunc: i => figures.line([grabAreaSize, 0]).moveDown(i * grabAreaGaps),
      }).translate(handleBox.minX + margin, handleBox.minY + margin);
      const typeText = createText(type, {
        font: "monospace",
        size: 5,
      }).normalise({
        target: handleBox,
        align: {x: "right", y: "center"},
      }, {margin: 1});
      const defFont = Font.system("Arial").addFallback(Font.system("monospace"));
      const idText = createText(runId, {
        font: defFont,
        size: 5,
      }).normalise({
        target: extendViewBox(handleBox, {
          left: -grabAreaSize - margin,
          right: -typeText.getBoundingBox().width - 3 * margin,
        }),
        align: {y: "center"},
      }, {margin: 1});
      const hintText = hint && handles.showHints ? createText(hint, {
        font: defFont,
        size: 5,
      }).normalise({
        target: {
          ...handleBox,
          minY: handleBox.minY + handleBox.height * (handles.pos === "above" ? -1 : 1),
        },
        align: {x: "center", y: handles.pos === "above" ? "bottom" : "top"},
      }, {margin: 1}) : Piece.EMPTY;
      return [
        runId,
        gather(
          figures.rectangle(handleBox).setAttributes({
            fill: this.options.laserRunsOptions.colorCodes ? undefined : "black",
          }),
          grabArea.setAttributes({stroke: "black"}),
          gather(
            idText,
            typeText,
            hintText,
          ).setAttributes({fill: "black"}),
        ).setAttributes({stroke: "none"})
          .moveRight(index * baseWid)
          .scale(wid / baseWid)
          .translate(this.viewBox.minX, this.viewBox.minY)
          .moveDown(handles.pos === "below" ? this.viewBox.height : 0)
          .setAttributes({id: `${runId}-handle`})
          .asG(),
      ];
    }));
  }

  private getHandleRuns() {
    const result = [];
    for (const partialRunsSelector of this.getRunsInNaturalOrder()) {
      const runsSelector = this.runsSelectorFromPartial({
        medium: "laser",
        runsSelector: partialRunsSelector,
      });
      if (runsSelector.runs !== "all") {
        if (runsSelector.runs.length)
          for (const run of runsSelector.runs) {
            const runOptions = assert(this.runOptions.get(run));
            result.push({
              runId: run,
              type: (runOptions.side === "back" ? "-" : "") + runOptions.type[0],
              hint: runOptions.hint,
            });
          }
        if (runsSelector.reversingFrame)
          result.push({
            runId: this.options.reversingFrame.id,
            type: "#",
            hint: this.options.reversingFrame.hint,
          });
      }
    }
    return result;
  }

  /**
   * Generates an `<svg>` element with the preview of this Sheet.
   * If the runs selector is specified, the SVG will only contain the specified runs.
   */
  async getPreviewSVG({
    runsSelector,
    showPointOnDblClick = true,
    border = true,
  }: {
    runsSelector?: PartialRunsSelector,
    showPointOnDblClick?: boolean,
    border?: SVGBorderStyle,
  } = {}) {
    const fullRunsSelector = this.runsSelectorFromPartial({medium: "preview", runsSelector});
    const svg = await this.getRawSVG({medium: "preview", runsSelector: fullRunsSelector});
    addBorder(svg, border);
    const titleElement = createElement({
      tagName: "title",
      children: this.name ? `${this.name} (${this.getSizeString()})` : this.getSizeString(),
    });
    svg.insertAdjacentElement("afterbegin", titleElement);
    let prevPoint: Point | undefined;
    let totalDist = 0;
    let totalDistNumPoints = 1;
    if (showPointOnDblClick)
      svg.addEventListener("dblclick", (event) => {
        event.preventDefault();
        document.getSelection()?.empty();
        const elem = event.currentTarget as HTMLElement;
        const point: Point = [
          this.viewBox.minX + event.offsetX / elem.clientWidth * this.viewBox.width,
          this.viewBox.minY + event.offsetY / elem.clientHeight * this.viewBox.height,
        ];
        console.log("Point:", point);
        setTimeout(() => {
          const pointStr = `Point: ${pointDebugString(point)}`;
          if (prevPoint) {
            const distToPrev = Math.hypot(point[0] - prevPoint[0], point[1] - prevPoint[1]);
            totalDist += distToPrev;
            totalDistNumPoints++;
            prevPoint = point;
            if (!confirm(`\
${pointStr}
Previous point: ${pointDebugString(prevPoint)}
Distance from previous point: ${roundReasonably(distToPrev, {significantDigits: 4})}

Total distance (${totalDistNumPoints} points): ${roundReasonably(totalDist, {significantDigits: 4})}
Continue summing up distances?`)) {
              totalDist = 0;
              totalDistNumPoints = 1;
              prevPoint = undefined;
            }
          } else {
            prevPoint = point;
            alert(pointStr);
          }
        });
      });
    return svg;
  }

  getSizeString() {
    return getSizeString(this.viewBox.width, this.options.millimetersPerUnit) + "×" +
      getSizeString(this.viewBox.height, this.options.millimetersPerUnit);
  }

  /**
   * Generates an `<svg>` element suitable for loading in the laser cutter software.
   * If the runs selector is specified, the SVG will only contain the specified runs.
   * If `printsAsImages` is specified, all the print layers are actually pre-rendered images,
   * which is helpful if the laser cutter software doesn't implement all the features of SVG.
   */
  async getLaserSVG({printsAsImages, runsSelector}: {
    printsAsImages?: boolean,
    runsSelector?: PartialRunsSelector,
  } = {}) {
    return await this.getRawSVG({medium: "laser", printsAsImages, runsSelector});
  }

  /** Returns the file name for the laser SVG file with the given params (without extension). */
  getFileName({runsSelector, printsAsImages = false}: PartialLaserSVGParams = {}) {
    const {runs, reversingFrame} = this.runsSelectorFromPartial({medium: "laser", runsSelector});
    const fileName = [
      this.options.fileName,
      runs === "all" ? undefined :
        `(${[...runs, reversingFrame && this.options.reversingFrame.id].filter(Boolean).join(",")})`,
      printsAsImages && this.hasPrintRuns(runs) && "prerendered",
    ].filter(Boolean).join(" ");
    const suffix = this.options.includeSizeInName ?
      getNameSizeSuffix(this.viewBox, this.options.millimetersPerUnit) : undefined;
    return getSuffixedFileName(fileName, suffix);
  }

  /**
   * Saves the laser SVG file as a file.
   * @see {@link Sheet.getLaserSVG}
   */
  async saveLaserSVG(params: PartialLaserSVGParams = {}) {
    const {format, printsAsImages, runsSelector} = this.laserSVGParamsFromPartial(params);
    const svg = await this.getLaserSVG({printsAsImages, runsSelector});
    const name = this.getFileName(params);
    if (format === "SVG")
      saveSVG({name, svg});
    else if (format === "PNG")
      await saveSVGAsPNG({
        name,
        svg,
        conversionParams: this.options.resolution,
      });
    else
      return format satisfies never;
  }

  private getFormatLabel(format: SaveFormat) {
    return `.${format.toLowerCase()}`;
  }

  private getSaveButtonLabel({format, runsSelector: {runs, reversingFrame}}: {
    format: SaveFormat,
    runsSelector: RunsSelector,
  }) {
    const text = [this.options.fileName];
    if (runs !== "all") {
      text.push(" (");
      text.push([
        runs.join(", "),
        reversingFrame && "#",
      ].filter(Boolean).join(" "));
      text.push(")");
    }
    if (format !== "SVG")
      text.push(" ", this.getFormatLabel(format));
    return text.join("");
  }

  /**
   * Returns a `<button>` element which saves the SVG suitable for the laser cutter software
   * on click.
   * @see {@link Sheet.saveLaserSVG}
   */
  getLaserSVGSaveButton({params = {}, label, hintLines = []}: {
    params?: PartialLaserSVGParams,
    label?: string,
    hintLines?: string[],
  } = {}) {
    const {format, runsSelector} = this.laserSVGParamsFromPartial(params);
    return createSaveButton({
      label: label || this.getSaveButtonLabel({format, runsSelector}),
      hint: [
        JSON.stringify(this.getFileName(params)),
        ...hintLines,
      ].join("\n"),
      save: () => {
        this.saveLaserSVG(params);
      },
    });
  }

  getRunsInSpecifiedOrder(): PartialRunsSelector[] {
    let lastSide: Side | undefined;
    const result: PartialRunsSelector[] = [];
    for (const {id, side} of this.runOptions.values()) {
      if (!this.emptyRuns.has(id)) {
        if (lastSide && side !== lastSide)
          result.push({runs: [], reversingFrame: true});
        lastSide = side;
        result.push({runs: [id], reversingFrame: false});
      }
    }
    return result;
  }

  /**
   * If preserveRunsOrder was specified, the natural order is the same as the specified order.
   * Otherwise returns all the runs defined in this Sheet in their natural order. The order is:
   *  - prints on the back side,
   *  - cuts on the back side (for scoring, as the main cut needs to be done on the front side),
   *  - the reversing frame - if there were any runs on the back,
   *  - prints on the front,
   *  - cuts on the front.
   */
  getRunsInNaturalOrder(): PartialRunsSelector[] {
    if (this.preserveRunsOrder)
      return this.getRunsInSpecifiedOrder();
    const allOptions = [...this.runOptions.values()];
    const hasReverseSide = allOptions.some(({id, side}) => !this.emptyRuns.has(id) && side === "back");
    const toSingleRuns = (options: RunOptions[]): PartialRunsSelector[] => {
      return options.filter(({id}) => !this.emptyRuns.has(id))
        .map(({id}) => ({
          runs: [id],
          reversingFrame: false,
        }));
    };
    function runsOnSide(side: Side) {
      return toSingleRuns(["print", "cut"].flatMap(type =>
        allOptions.filter(({type: t, side: s}) => t === type && s === side),
      ));
    }
    if (hasReverseSide)
      return [
        ...runsOnSide("back"),
        {runs: [], reversingFrame: true},
        ...runsOnSide("front"),
      ];
    else
      return runsOnSide("front");
  }

  hasPrintRuns(runs: RunsSelector["runs"] = "all") {
    for (const run of this.runsOrAll(runs))
      if (this.getRunOptions(run).type === "print")
        return true;
    return false;
  }

  /**
   * Returns a `<div>` element with buttons for saving the laser SVG files, one per each
   * runs selector, or a complete set of buttons if `"all"` is specified (the default).
   * @see {@link Sheet.saveLaserSVG}
   */
  getSaveLaserSVGButtons({
    format = "SVG",
    printsFormat = "both",
    includePrintsAsImages = true,
    runsSelectors = "all",
  }: {
    format?: ButtonSaveFormat,
    printsFormat?: ButtonSaveFormat,
    includePrintsAsImages?: boolean,
    runsSelectors?: (PartialRunsSelector | "separator")[] | "all",
  } = {}) {
    const container = document.createElement("div");
    container.textContent = `Files for the laser software:`;
    const buttonsRow = ButtonsRow.create();
    container.append(buttonsRow.elem);
    if (runsSelectors === "all") {
      const naturalOrder = this.getRunsInNaturalOrder();
      runsSelectors = [{runs: "all"}];
      if (naturalOrder.length > 1)
        runsSelectors.push("separator", ...naturalOrder);
    }
    for (const runsSelector of runsSelectors) {
      if (runsSelector === "separator")
        buttonsRow.addSeparator();
      else {
        const buttons = [];
        const fullRunsSelector = this.runsSelectorFromPartial({medium: "laser", runsSelector});
        const {cut, print} = this.getRunsTypes(fullRunsSelector);
        const fullFormat = print && !cut ? printsFormat : format;
        const mainFormat = fullFormat === "both" ? "SVG" : fullFormat;
        const hintLines = [];
        if (fullRunsSelector.runs === "all")
          hintLines.push(`All laser runs`);
        else {
          if (fullRunsSelector.runs.length)
            hintLines.push(`Laser runs: ${fullRunsSelector.runs.map(
              run => {
                const options = this.getRunOptions(run);
                return JSON.stringify(run) + (options.hint ? ` (hint: ${options.hint})` : "");
              }).join(", ")}`);
          if (fullRunsSelector.reversingFrame)
            hintLines.push(`Reversing frame`);
        }
        buttons.push(this.getLaserSVGSaveButton({
          params: {format: mainFormat, runsSelector},
          hintLines: hintLines,
        }));
        if (includePrintsAsImages && print && mainFormat === "SVG")
          buttons.push(this.getLaserSVGSaveButton({
            params: {format: "SVG", printsAsImages: true, runsSelector},
            label: `(pre)`,
            hintLines: [`With pre-rendered print runs`, ...hintLines],
          }));
        if (fullFormat === "both")
          buttons.push(this.getLaserSVGSaveButton({
            params: {format: "PNG", runsSelector},
            label: this.getFormatLabel("PNG"),
            hintLines: [`Raster image`, ...hintLines],
          }));
        if (fullRunsSelector.runs === "all")
          for (const button of buttons)
            button.style.fontWeight = "bold";
        buttonsRow.addItems(buttons);
      }
    }
    return container;
  }

  getSaveArtifactsButtons() {
    if (!this.artifacts.length)
      return undefined;
    const container = document.createElement("div");
    container.textContent = `Artifacts:`;
    const buttonsContainer = document.createElement("div");
    container.append(buttonsContainer);
    buttonsContainer.style.display = "flex";
    buttonsContainer.style.flexWrap = "wrap";
    buttonsContainer.style.gap = "0.2em";
    for (const artifact of this.artifacts)
      buttonsContainer.append(createSaveButton({
        label: artifact.name,
        hint: [artifact.fileName, artifact.desc].filter(Boolean).join("\n"),
        save: () => {
          saveArtifact(artifact);
        },
      }));
    return container;
  }

  getUnusedLayers() {
    const unusedLayers = new Set(this.pieces.getLayers());
    for (const runOptions of this.runOptions.values())
      for (const layer of runOptions.layers)
        unusedLayers.delete(layer);
    return [
      ...unusedLayers.delete(NO_LAYER) ? [NO_LAYER] : [],
      ...[...unusedLayers].sort(),
    ];
  }

  getUnusedLayersWarning() {
    const unusedLayers = this.getUnusedLayers();
    if (!unusedLayers.length)
      return undefined;
    function makeInlinePre(text: string) {
      const span = document.createElement("span");
      span.style.fontFamily = "monospace";
      span.textContent = text;
      return span;
    }
    const span = document.createElement("span");
    span.style.color = "#9202ff";
    span.textContent = `Warning: Some layers are not included in any runs: `;
    let first = true;
    for (const layer of unusedLayers) {
      if (first)
        first = false;
      else
        span.append(`, `);
      span.append(makeInlinePre(layer === undefined ? `NO_LAYER` : JSON.stringify(layer)));
    }
    span.append(`.`);
    return span;
  }

  toString() {
    return `Sheet[${this.name}, options = ${JSON.stringify(this.options)}, ${this.pieces}, ` +
      `viewBox = "${viewBoxToString(this.viewBox)}", runs = ${JSON.stringify(this.runOptions)}]`;
  }

}
