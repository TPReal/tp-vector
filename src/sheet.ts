import {Attributes, createElement, createSVG, setAttributes} from './elements.ts';
import * as figures from './figures.ts';
import {Image} from './images.ts';
import {getNameSizeSuffix, getSizeString, getSuffixedFileName} from './name.ts';
import {Medium, PartialRunOptions, PartialSheetOptions, RunOptions, SheetOptions, Side, runOptionsFromPartial, sheetOptionsFromPartial} from './options.ts';
import {BasicPiece, Piece, gather} from './pieces.ts';
import {getPNGDataURI} from './svg_converter.ts';
import {saveSVG, saveSVGAsPNG} from './svg_saver.ts';
import {createText} from './text.ts';
import {OrArray, flatten, flattenFilter} from './util.ts';
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
type PartialRunsSelector = PartialRunsSelectorInterface | string[];
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

export class Sheet {

  private readonly runHandles?: ReadonlyMap<string, SVGGElement>;

  protected constructor(
    readonly options: SheetOptions,
    private readonly pieces: Piece,
    readonly viewBox: ViewBox,
    private readonly runOptions: ReadonlyMap<string, RunOptions>,
    private readonly emptyRuns: ReadonlySet<string>,
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
  }: {
    options?: PartialSheetOptions,
    pieces: OrArray<BasicPiece | undefined>,
    margin?: PartialViewBoxMargin,
    viewBox?: PartialViewBox | "auto",
    runs?: OrArray<PartialRunOptions>,
  }) {
    const sheetOptions = sheetOptionsFromPartial(options);
    const fullPieces = gather(flattenFilter(pieces));
    const fullMargin = viewBoxMarginFromPartial(margin);
    const box = viewBox === "auto" ? fullPieces.getBoundingBox(fullMargin) :
      extendViewBox(viewBoxFromPartial(viewBox), margin);
    const allRuns = flatten(runs || DEFAULT_RUNS);
    const runOptionsMap = new Map<string, RunOptions>();
    const emptyRuns = new Set<string>();
    for (const opts of allRuns) {
      const runOptions = runOptionsFromPartial(opts, sheetOptions);
      if (runOptionsMap.has(runOptions.id))
        throw new Error(`Duplicate run id: ${JSON.stringify(runOptions.id)}`);
      runOptionsMap.set(runOptions.id, runOptions);
      if (!fullPieces.selectLayers(...runOptions.layers).getElements().length)
        emptyRuns.add(runOptions.id);
    }
    return new Sheet(
      sheetOptions,
      fullPieces,
      box,
      runOptionsMap,
      emptyRuns,
    );
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
        pieces = gather(pieces, this.getCornersMarkerRawPiece());
    }
    return pieces.asG({
      id: runOptions.id,
      ...runOptions.styleAttributes[medium],
    });
  }

  private getCornersMarkerRawPiece() {
    const {minX, minY, width, height} = this.viewBox;
    if (this.options.cornersMarker.type === "circles")
      return gather(
        figures.circle({center: [minX + width, minY + height], radius: 0}),
        figures.circle({center: [minX, minY], radius: 0}),
      );
    if (this.options.cornersMarker.type === "lines")
      return gather(
        figures.line([minX, minY], [minX + 1e-9, minY]),
        figures.line([minX + width, minY + height], [minX + width - 1e-9, minY + height]),
      );
    return this.options.cornersMarker.type satisfies never;
  }

  private getCornersMarker(medium: Medium) {
    const {id} = this.options.cornersMarker;
    return {
      id,
      group: this.getCornersMarkerRawPiece().asG(
        {id, ...this.options.cornersMarker.styleAttributes[medium]}),
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

  private getNonEmptyRunIds() {
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
    const defs = this.pieces.getDefsElement();
    const runsData: {
      id: string,
      group: SVGGElement,
      extraAttributes?: Attributes,
      sibling?: SVGElement,
    }[] = [];
    for (const id of this.runsOrAll(runs)) {
      const runOptions = this.getRunOptions(id);
      let group;
      if (runOptions.type === "print" && printsAsImages)
        // TODO: Consider converting pieces to PNG separately, at declared levels.
        group = (await Image.fromURL({
          url: await getPNGDataURI(
            await this.getRawSVG({
              medium,
              printsAsImages: false,
              runsSelector: {
                runs: [id],
                cornersMarker,
                reversingFrame,
              },
            }), this.options.resolution),
          scaling: {
            width: this.viewBox.width,
            height: this.viewBox.height,
          },
        }))
          .translate(this.viewBox.minX, this.viewBox.minY)
          .asG({id: runOptions.id});
      else
        group = this.getRunPiece({runOptions, medium});
      runsData.push({id, group});
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
      children: [...defs ? [defs] : [], ...groups],
    })
  }

  private createHandles(): ReadonlyMap<string, SVGGElement> | undefined {
    const {handles} = this.options.laserRunsOptions;
    if (!handles)
      return undefined;
    const ids = this.getAllRunIdsInNaturalOrder();
    const wid = this.viewBox.width / ids.length;
    const baseWid = 100;
    const handleViewBox = extendViewBox(viewBoxFromPartial({
      width: baseWid,
      height: 15,
      ...handles === "above" ? {maxY: 0} : handles === "below" ? {minY: 0} : handles satisfies never,
    }), -2);
    return new Map(ids.map((id, index) => [
      id,
      gather(
        figures.rectangle(handleViewBox).setAttributes({
          stroke: "none",
          fill: this.options.laserRunsOptions.colorCodes ? undefined : "black",
        }),
        createText(id, {
          size: 5,
          font: "monospace",
        }).normalise({
          target: handleViewBox,
          align: {y: "center"},
        }, {margin: 1}).setAttributes({fill: "white"}),
      ).setAttributes({stroke: "none"})
        .moveRight(index * baseWid)
        .scale(wid / baseWid)
        .translate(this.viewBox.minX, this.viewBox.minY)
        .moveDown(handles === "below" ? this.viewBox.height : 0)
        .asG({id: `${id}-handle`}),
    ]));
  }

  private getAllRunIdsInNaturalOrder() {
    const idsSet = new Set<string>();
    for (const partialRunsSelector of this.getRunsInNaturalOrder()) {
      const runsSelector = this.runsSelectorFromPartial({
        medium: "laser",
        runsSelector: partialRunsSelector,
      });
      if (runsSelector.runs !== "all") {
        if (runsSelector.runs.length)
          for (const run of runsSelector.runs)
            idsSet.add(run);
        else if (runsSelector.reversingFrame)
          idsSet.add(this.options.reversingFrame.id);
      }
    }
    for (const runId of this.runOptions.keys())
      idsSet.add(runId);
    return [...idsSet];
  }

  /**
   * Generates an `<svg>` element with the preview of this Sheet.
   * If the runs selector is specified, the SVG will only contain the specified runs.
   */
  async getPreviewSVG({
    runsSelector,
    saveOnClick = true,
    border = true,
    hoverTitle = true,
  }: {
    runsSelector?: PartialRunsSelector,
    saveOnClick?: boolean,
    border?: SVGBorderStyle,
    hoverTitle?: boolean,
  } = {}) {
    const fullRunsSelector = this.runsSelectorFromPartial({medium: "preview", runsSelector});
    const svg = await this.getRawSVG({medium: "preview", runsSelector: fullRunsSelector});
    addBorder(svg, border);
    if (hoverTitle) {
      const titleElement = createElement({tagName: "title"});
      titleElement.textContent = this.getPreviewHoverTitle({runsSelector: fullRunsSelector});
      svg.insertAdjacentElement("afterbegin", titleElement);
    }
    if (saveOnClick)
      svg.addEventListener("click", () => {
        this.saveLaserSVG({runsSelector});
      });
    return svg;
  }

  private getPreviewHoverTitle({runsSelector: {runs, reversingFrame}}: {
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
    text.push(" (", getSizeString(this.viewBox.width, this.options.millimetersPerUnit),
      "×", getSizeString(this.viewBox.height, this.options.millimetersPerUnit), ")");
    return text.join("");
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

  private getSVGName({
    runsSelector: {runs, reversingFrame},
    printsAsImages,
  }: {
    runsSelector: RunsSelector,
    printsAsImages: boolean,
  }) {
    const fileName = [
      this.options.fileName,
      ...runs === "all" ? [] : [...runs, reversingFrame && this.options.reversingFrame.id],
      printsAsImages && "p_img",
    ].filter(Boolean).join("__");
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
    const name = this.getSVGName({
      runsSelector: this.runsSelectorFromPartial({medium: "laser", runsSelector}),
      printsAsImages,
    });
    if (format === "SVG")
      saveSVG({name, svg});
    else if (format === "PNG")
      await saveSVGAsPNG({
        name,
        svg,
        conversionParams: this.options.resolution,
      });
    else {
      return format satisfies never;
    }
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
  getLaserSVGSaveButton({params = {}, label, hintSuffix}: {
    params?: PartialLaserSVGParams,
    label?: string,
    hintSuffix?: string,
  } = {}) {
    const {format, printsAsImages, runsSelector} = this.laserSVGParamsFromPartial(params);
    let hint = this.getSVGName({runsSelector, printsAsImages});
    if (hintSuffix)
      hint += " " + hintSuffix;
    return createSaveButton({
      label: label || this.getSaveButtonLabel({format, runsSelector}),
      hint,
      save: () => {
        this.saveLaserSVG({format, printsAsImages, runsSelector});
      },
    });
  }

  /**
   * Returns all the runs defined in this Sheet in their natural order. The order is:
   *  - prints on the back side,
   *  - cuts on the back side (this type of run is rare),
   *  - the reversing frame - if there were any runs on the back,
   *  - prints on the front,
   *  - cuts on the front.
   */
  getRunsInNaturalOrder(): PartialRunsSelector[] {
    const allOptions = [...this.runOptions.values()];
    const hasReverseSide = allOptions.some(({side}) => side === "back");
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
    container.style.display = "flex";
    container.style.flexWrap = "wrap";
    function addItems(items: OrArray<HTMLElement>) {
      const span = document.createElement("span");
      span.style.margin = "2px";
      let first = true;
      for (const item of flatten(items)) {
        if (first)
          first = false;
        else
          item.style.marginLeft = "-1px";
        item.style.minHeight = "2.2em";
        span.appendChild(item);
      }
      container.appendChild(span);
    }
    function addSep() {
      const sep = document.createElement("hr");
      sep.style.margin = "2px";
      container.appendChild(sep);
    }
    if (runsSelectors === "all") {
      const naturalOrder = this.getRunsInNaturalOrder();
      runsSelectors = [{runs: "all"}];
      if (naturalOrder.length > 1)
        runsSelectors.push("separator", ...naturalOrder);
    }
    for (const runsSelector of runsSelectors) {
      if (runsSelector === "separator")
        addSep();
      else {
        const buttons = [];
        const fullRunsSelector = this.runsSelectorFromPartial({medium: "laser", runsSelector});
        const {cut, print} = this.getRunsTypes(fullRunsSelector);
        const fullFormat = print && !cut ? printsFormat : format;
        const mainFormat = fullFormat === "both" ? "SVG" : fullFormat;
        buttons.push(this.getLaserSVGSaveButton({
          params: {format: mainFormat, runsSelector},
        }));
        if (includePrintsAsImages && print && mainFormat === "SVG")
          buttons.push(this.getLaserSVGSaveButton({
            params: {format: "SVG", printsAsImages: true, runsSelector},
            label: "[PNG prints]",
            hintSuffix: "(print layers embedded as PNG images)",
          }));
        if (fullFormat === "both")
          buttons.push(this.getLaserSVGSaveButton({
            params: {format: "PNG", runsSelector},
            label: this.getFormatLabel("PNG"),
            hintSuffix: "(raster image)",
          }));
        addItems(buttons);
      }
    }
    return container;
  }

  toString() {
    return `Sheet[${this.name}, options = ${JSON.stringify(this.options)}, ${this.pieces}, ` +
      `viewBox = "${viewBoxToString(this.viewBox)}", runs = ${JSON.stringify(this.runOptions)}]`;
  }

}
