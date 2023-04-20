import {generateId} from '../ids.ts';
import {assert, Sheet} from '../index.ts';
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
  div.appendChild(svgContainer);
  const svg = await sheet.getPreviewSVG();
  svgContainer.appendChild(svg)
  const unusedLayersWarning = sheet.getUnusedLayersWarning();
  if (unusedLayersWarning)
    div.appendChild(unusedLayersWarning);
  div.appendChild(getSVGRunsControllerCheckboxes(svg));
  div.appendChild(sheet.getSaveLaserSVGButtons());
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
  const checkboxesInfo = document.createTextNode(`Show runs:`);
  runsController.appendChild(checkboxesInfo);
  for (const g of svg.querySelectorAll(":scope > g[id]")) {
    const id = assert(g.getAttribute("id"));
    const span = document.createElement("span");
    runsController.appendChild(span);
    span.title = `Right-click to blink`;
    span.style.whiteSpace = "nowrap";
    const checkbox = document.createElement("input");
    span.appendChild(checkbox);
    checkbox.type = "checkbox";
    checkbox.checked = true;
    const label = document.createElement("label");
    span.appendChild(label);
    label.appendChild(document.createTextNode(id));
    label.addEventListener("click", () => {
      checkbox.click();
    });
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

  protected constructor(private readonly sections: readonly SectionDef[]) {}

  static create() {
    return new Viewer([]);
  }

  private addSect(sect: SectionDef) {
    return new Viewer([...this.sections, sect]);
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
        name: unwrapped.dataset.name || generateId("section"),
        element: unwrapped,
      };
    });
  }

  addAll(other: Viewer) {
    return new Viewer([...this.sections, ...other.sections]);
  }

  async show({parent, section}: {
    parent?: HTMLElement,
    section?: string,
  } = {}) {
    return await showViewer({
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
