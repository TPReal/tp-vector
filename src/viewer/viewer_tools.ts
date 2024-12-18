import {GlobalOptionsInput} from '../global_options.ts';
import {Sheet} from '../sheet.ts';
import {OrArray, assert} from '../util.ts';
import {OrFuncPromise, OrPromise, SectionDef, SectionItemDef, unwrap} from './types.ts';
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
  const sheetNameInfo = document.createElement("div");
  div.append(sheetNameInfo);
  sheetNameInfo.append("Sheet: ");
  const sheetName = document.createElement("span");
  sheetNameInfo.append(sheetName);
  if (sheet.name) {
    sheetName.style.textDecoration = "underline";
    sheetName.append(sheet.name);
  } else
    sheetName.append("(unnamed)");
  const sheetSize = document.createElement("span");
  sheetNameInfo.append(" ", sheetSize);
  sheetSize.append(`(${sheet.getSizeString()})`);
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
  const runCheckboxes: HTMLInputElement[] = [];
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
    runCheckboxes.push(checkbox);
    checkbox.type = "checkbox";
    checkbox.checked = true;
    label.append(id);
    checkbox.addEventListener("change", () => {
      (g as HTMLElement).style.display = checkbox.checked ? "" : "none";
    });
    // Don't trigger on label, only on checkbox.
    checkbox.addEventListener("dblclick", e => {
      e.preventDefault();
      const isOnly = runCheckboxes.every(ch => ch === checkbox || !ch.checked);
      for (const ch of runCheckboxes)
        if (ch.checked !== isOnly)
          ch.click()
      if (!isOnly)
        checkbox.click();
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
 * A Project with a name and a collection of Sheet's.
 *
 * A module exporting `name` and `getSheets`, regular or async, implements this interface.
 * Exporting a function is the preferred way for a module to produce Sheet's. Creating a Sheet
 * object at the file level is not recommended because it might execute before setting  the global
 * options. See _src/global_options.ts_.
 */
export interface Project<Args extends unknown[] = []> {
  name: string;
  getSheets(...args: Args): OrPromise<OrArray<Sheet>>;
}

export interface StaticSection<Args extends unknown[] = []> {
  name: string;
  element: OrFuncPromise<HTMLElement, Args>;
}

async function getProjectSheets<Args extends unknown[]>(
  project: Project<Args>, ...args: Args): Promise<Sheet[]> {
  const sheets = await unwrap(project.getSheets, ...args);
  return Array.isArray(sheets) ? sheets : [sheets];
}

export class Viewer {

  protected constructor(
    private readonly liveReload: boolean,
    private readonly globalOptsMap: ReadonlyMap<string, GlobalOptionsInput> | undefined,
    private readonly sectionItems: readonly SectionItemDef[],
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
    return new Viewer(this.liveReload, this.globalOptsMap, [...this.sectionItems, sect]);
  }

  add<Args extends unknown[]>(project: Project<Args>, ...args: Args): Viewer;
  add<Args extends unknown[]>(staticSection: StaticSection<Args>, ...args: Args): Viewer;
  add<Args extends unknown[]>(content: Project<Args> | StaticSection<Args>, ...args: Args) {
    function isProject(content: Project<Args> | StaticSection<Args>): content is Project<Args> {
      return Object.hasOwn(content, "getSheets") &&
        typeof (content as Project<Args>).getSheets === "function";
    }
    const element = isProject(content) ? async () => {
      const div = document.createElement("div");
      div.style.display = "flex";
      div.style.flexDirection = "column";
      div.style.gap = "1em";
      const sheets = await getProjectSheets(content, ...args);
      for (const sheet of sheets)
        div.append(await getSheetPreview(sheet));
      return div;
    } : content.element;
    return this.addSect({name: content.name, element});
  }

  addAll(other: Viewer) {
    return new Viewer(this.liveReload, this.globalOptsMap, [...this.sectionItems, ...other.sectionItems]);
  }

  addSeparator() {
    return new Viewer(this.liveReload, this.globalOptsMap, [...this.sectionItems, "separator"]);
  }

  show({parent, tableOfContents, section}: {
    parent?: HTMLElement,
    tableOfContents?: boolean,
    section?: string,
  } = {}) {
    if (this.liveReload)
      installLiveReload();
    return showViewer({
      globalOptsMap: this.globalOptsMap,
      sectionItems: this.sectionItems,
      parent,
      tableOfContents,
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
  new EventSource("/esbuild").addEventListener("change", handler);
}
