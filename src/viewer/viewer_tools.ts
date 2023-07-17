import {GlobalOptionsInput} from '../global_options.ts';
import {generateId} from '../ids.ts';
import {Sheet} from '../sheet.ts';
import {assert} from '../util.ts';
import {OrFuncPromise, OrPromise, SectionDef, unwrap} from './types.ts';
import {showViewer} from './viewer_page.ts';

/**
 * Returns a `<div>` containing a preview of the Sheet, including checkboxes to control runs
 * visibility and buttons to save runs to files.
 */
export async function getSheetPreview(sheet: Sheet) {
  const div = document.createElement("div");
  div.style.display = "flex";
  div.style.flexDirection = "column";
  div.style.gap = "0.2em";
  const svgContainer = document.createElement("div");
  div.append(svgContainer);
  const svg = await sheet.getPreviewSVG();
  svgContainer.append(svg)
  const unusedLayersWarning = sheet.getUnusedLayersWarning();
  if (unusedLayersWarning)
    div.append(unusedLayersWarning);
  div.append(getSVGRunsControllerCheckboxes(svg));
  div.append(sheet.getSaveLaserSVGButtons());
  return div;
}

/**
 * Returns a `<div>` with checkboxes controlling visibility of particular runs in the
 * `<svg>` element.
 */
export function getSVGRunsControllerCheckboxes(svg: SVGSVGElement) {
  const runsController = document.createElement("div");
  runsController.style.display = "flex";
  runsController.style.gap = ".5em";
  runsController.style.flexWrap = "wrap";
  runsController.style.alignItems = "center";
  const blinkTimers: number[] = [];
  runsController.append(`Show runs:`);
  for (const g of svg.querySelectorAll(":scope > g[id]")) {
    const id = assert(g.getAttribute("id"));
    const span = document.createElement("span");
    runsController.append(span);
    span.title = `Right-click to blink`;
    span.style.whiteSpace = "nowrap";
    const label = document.createElement("label");
    span.append(label);
    const checkbox = document.createElement("input");
    label.append(checkbox);
    checkbox.type = "checkbox";
    checkbox.checked = true;
    label.append(id);
    checkbox.addEventListener("click", () => {
      (g as HTMLElement).style.display = checkbox.checked ? "" : "none";
    });
    for (const el of [label, checkbox])
      el.addEventListener("contextmenu", e => {
        e.preventDefault();
        for (const timer of blinkTimers)
          clearTimeout(timer);
        blinkTimers.length = 0;
        for (let i = 0; i < 5; i++)
          blinkTimers.push(setTimeout(() => {
            checkbox.click();
            setTimeout(() => {
              checkbox.click();
            }, 120);
          }, i * 240));
      });
  }
  return runsController;
}

/**
 * Interface for a module with exported `getSheet` function, regular or async,
 * with or without parameters, returning a Sheet.
 *
 * Exporting a function is the preferred way for a module to produce a Sheet. Creating the Sheet
 * object at the file level is not recommended because it might execute before setting  the global
 * options. See _src/global_options.ts_.
 */
export interface SheetModule<Args extends unknown[] = []> {
  getSheet(...args: Args): OrPromise<Sheet>;
}

export class Viewer {

  protected constructor(
    private readonly liveReload: boolean,
    private readonly globalOptsMap: ReadonlyMap<string, GlobalOptionsInput> | undefined,
    private readonly sections: readonly SectionDef[],
  ) {}

  static create({liveReload = true, globalOpts, globalOptsPresets}: {
    liveReload?: boolean,
    globalOpts?: GlobalOptionsInput,
    globalOptsPresets?: Record<string, GlobalOptionsInput>,
  } = {}) {
    let globalOptsMap: Map<string, GlobalOptionsInput> | undefined;
    if (globalOpts || globalOptsPresets) {
      globalOptsMap = new Map();
      if (globalOptsPresets)
        for (const [preset, item] of Object.entries(globalOptsPresets))
          globalOptsMap.set(preset, item);
      if (globalOpts)
        globalOptsMap.set("", globalOpts);
    }
    return new Viewer(liveReload, globalOptsMap, []);
  }

  private addSect(sect: SectionDef) {
    return new Viewer(this.liveReload, this.globalOptsMap, [...this.sections, sect]);
  }

  add<Args extends unknown[]>(module: SheetModule<Args>, ...args: Args): Viewer;
  add<Args extends unknown[]>(element: OrFuncPromise<Sheet, Args>, ...args: Args): Viewer;
  /**
   * Adds a section with the specified element. The name of the section is taken from
   * `element.dataset.name` (taken from the `data-name` attribute).
   */
  add<Args extends unknown[]>(element: OrFuncPromise<HTMLElement, Args>, ...args: Args): Viewer;
  add<Args extends unknown[]>(
    name: string,
    element: OrFuncPromise<HTMLElement, Args>,
    ...args: Args
  ): Viewer;
  add<Args extends unknown[]>(...params:
    | [SheetModule<Args>, ...Args]
    | [OrFuncPromise<Sheet, Args>, ...Args]
    | [OrFuncPromise<HTMLElement, Args>, ...Args]
    | [string, OrFuncPromise<HTMLElement, Args>, ...Args]) {
    function isModule(params: unknown[]): params is [SheetModule<Args>, ...Args] {
      const param0 = params[0];
      if (param0 && typeof param0 === "object" && Object.hasOwn(param0, "getSheet")) {
        const getSheet = (param0 as SheetModule<Args>).getSheet;
        if (typeof getSheet === "function")
          return true;
      }
      return false;
    }
    if (isModule(params))
      params = [params[0].getSheet, ...params.slice(1) as Args];
    function hasName(params: unknown[]):
      params is [string, OrFuncPromise<HTMLElement, Args>, ...Args] {
      return typeof params[0] === "string";
    }
    const [name, item, ...args] = hasName(params) ? params : [undefined, ...params];
    return this.addSect(async () => {
      const unwrapped = await unwrap(item, args);
      if (unwrapped instanceof Sheet)
        return {
          name: name || unwrapped.name || generateId("sheet"),
          element: await getSheetPreview(unwrapped),
        };
      return {
        name: name || unwrapped.dataset.name || generateId("section"),
        element: unwrapped,
      };
    });
  }

  addAll(other: Viewer) {
    return new Viewer(
      this.liveReload, this.globalOptsMap, [...this.sections, ...other.sections]);
  }

  async show({parent, section}: {
    parent?: HTMLElement,
    section?: string,
  } = {}) {
    if (this.liveReload)
      installLiveReload();
    return await showViewer({
      globalOptsMap: this.globalOptsMap,
      sectionDefs: this.sections,
      parent,
      section,
    });
  }

}

export const RELOAD = () => {
  location.reload();
}

/**
 * Installs the live reload provided by esbuild.
 * @see https://esbuild.github.io/api/#live-reload
 */
export function installLiveReload(handler: () => void = RELOAD) {
  new EventSource('/esbuild').addEventListener('change', handler);
}
