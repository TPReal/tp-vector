import {GlobalOptionsInput} from '../global_options.ts';
import {RunOptions} from '../options.ts';
import {saveBlobDownload} from '../saver.ts';
import {PartialLaserSVGParams, Sheet} from '../sheet.ts';
import {ButtonsRow} from '../ui.ts';
import {OrArray, assert} from '../util.ts';
import {newJSZip} from '../zip.ts';
import {getPreviewClickHandler} from './preview_click_handler.ts';
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
  svg.addEventListener("dblclick", getPreviewClickHandler(sheet.viewBox));
  const unusedLayersWarning = sheet.getUnusedLayersWarning();
  if (unusedLayersWarning)
    div.append(unusedLayersWarning);
  div.append(getSVGRunsControllerCheckboxes(svg, sheet));
  div.append(sheet.getSaveLaserSVGButtons());
  const artifactButtons = sheet.getSaveArtifactsButtons();
  if (artifactButtons)
    div.append(artifactButtons);
  return div;
}

type SheetViewType = "all" | "cut" | "front" | "back";

const SHEET_VIEWS: readonly {view: SheetViewType, label: string, hint: string, dualSidedOnly?: boolean, withPrintsOnly?: boolean}[] = [
  {view: "all", label: `All`, hint: `Show all runs`},
  {view: "cut", label: `Cut`, hint: `Show only the cut runs`, withPrintsOnly: true},
  {view: "front", label: `Front`, hint: `Show the front side`, dualSidedOnly: true},
  {view: "back", label: `Back`, hint: `Show the back side (with the front cuts, which go all the way through)`, dualSidedOnly: true},
];

// TODO: Consider a way for a run to declare whether it goes all the way through,
// e.g. an etch cut run on the front.
/**
 * Determines whether a run is visible in the given view, assuming that the front cuts go all
 * the way through (and are thus visible from both sides), while the back cuts are just etches
 * (visible only from the back).
 */
function isRunInView(view: SheetViewType, {type, side}: RunOptions) {
  if (view === "all")
    return true;
  if (view === "cut")
    return type === "cut";
  if (view === "front")
    return side === "front";
  if (view === "back")
    return side === "back" || type === "cut";
  return view satisfies never;
}

/**
 * Returns a `<div>` with checkboxes controlling visibility of particular runs in the
 * `<svg>` element.
 * If the Sheet is specified, the controller also contains buttons selecting predefined views
 * (see {@link SheetViewType}), and for a dual-sided Sheet, an _Un-mirror_ checkbox flipping
 * the whole preview, to look at the sheet from the back.
 */
export function getSVGRunsControllerCheckboxes(svg: SVGSVGElement, sheet?: Sheet) {
  const runsController = document.createElement("div");
  runsController.style.display = "flex";
  runsController.style.gap = ".5em";
  runsController.style.flexWrap = "wrap";
  runsController.style.alignItems = "center";
  const blinkTimers: number[] = [];
  runsController.append(`Show runs:`);
  const runCheckboxes: HTMLInputElement[] = [];
  const runIds: string[] = [];
  for (const g of svg.querySelectorAll(":scope > g[id]")) {
    const id = assert(g.getAttribute("id"));
    runIds.push(id);
    const span = document.createElement("span");
    runsController.append(span);
    span.title = `Right-click to blink`;
    span.style.whiteSpace = "nowrap";
    const label = document.createElement("label");
    span.append(label);
    label.style.userSelect = "none";
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
  if (sheet) {
    const runsOptions = new Map(sheet.getRunsOptions().map(runOptions => [runOptions.id, runOptions]));
    const isDualSided = runIds.some(id => runsOptions.get(id)?.side === "back");
    const hasPrints = runIds.some(id => runsOptions.get(id)?.type === "print");
    let unMirrorCheckbox: HTMLInputElement | undefined;
    function applyView(view: SheetViewType) {
      for (let i = 0; i < runIds.length; i++) {
        const runOptions = runsOptions.get(runIds[i]);
        const visible = runOptions ? isRunInView(view, runOptions) : view === "all";
        if (runCheckboxes[i].checked !== visible)
          runCheckboxes[i].click();
      }
      if (unMirrorCheckbox && unMirrorCheckbox.checked !== (view === "back"))
        unMirrorCheckbox.click();
    }
    const buttonsRow = ButtonsRow.create().addItems(SHEET_VIEWS
      .filter(({dualSidedOnly, withPrintsOnly}) => (isDualSided || !dualSidedOnly) && (hasPrints || !withPrintsOnly))
      .map(({view, label, hint}) => {
        const button = document.createElement("button");
        button.textContent = label;
        button.title = hint;
        button.addEventListener("click", () => {
          applyView(view);
        });
        return button;
      }));
    runsController.append(buttonsRow.elem);
    if (isDualSided) {
      const label = document.createElement("label");
      runsController.append(label);
      label.style.userSelect = "none";
      label.title = `Flip the whole preview, to look at the sheet from the back`;
      unMirrorCheckbox = document.createElement("input");
      label.append(unMirrorCheckbox);
      unMirrorCheckbox.type = "checkbox";
      label.append(`Un-mirror`);
      unMirrorCheckbox.addEventListener("change", () => {
        svg.style.transform = unMirrorCheckbox?.checked ? "scale(-1, 1)" : "";
      });
    }
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
  project: Project<Args>, ...args: Args): Promise<readonly Sheet[]> {
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
    globalOptsPresets?: Readonly<Record<string, GlobalOptionsInput>>,
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
      if (sheets.length > 1) {
        function getFileName(params?: PartialLaserSVGParams) {
          return `${content.name}${params?.printsAsImages ? ` prerendered` : ``} (all sheets)`;
        }
        async function saveAll(name: string, params?: PartialLaserSVGParams) {
          const zip = await newJSZip();
          for (const sheet of sheets)
            zip.file(
              `${sheet.getFileName(params)}.svg`,
              new XMLSerializer().serializeToString(await sheet.getLaserSVG(params)),
            );
          const blob: Blob = await zip.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: {level: 9},
          });
          saveBlobDownload({name, blob});
        }
        const buttonsRow = ButtonsRow.create();
        div.append(buttonsRow.elem);
        const saveAllButton = document.createElement("button");
        const buttons = [saveAllButton];
        saveAllButton.textContent = `Save SVG files from all sheets (${sheets.length}) as ZIP`;
        const sheetsList = `Sheets:\n${sheets.map(sheet => `  ${sheet.name}`).join("\n")}`;
        const saveAllFileName = getFileName();
        saveAllButton.title = `${JSON.stringify(saveAllFileName)}\n${sheetsList}`;
        saveAllButton.style.fontWeight = "bold";
        saveAllButton.addEventListener("click", async () => {
          await saveAll(saveAllFileName);
        });
        const sheetsWithPrintRuns = sheets.filter(sheet => sheet.hasPrintRuns());
        if (sheetsWithPrintRuns.length) {
          const preParams: PartialLaserSVGParams = {printsAsImages: true};
          const saveAllPreButton = document.createElement("button");
          buttons.push(saveAllPreButton);
          saveAllPreButton.textContent = `(pre)`;
          const saveAllPreFileName = getFileName(preParams);
          saveAllPreButton.title = `${JSON.stringify(saveAllPreFileName)}\n` +
            `With pre-rendered print runs where applicable\n${sheetsList}`;
          saveAllPreButton.style.fontWeight = "bold";
          saveAllPreButton.addEventListener("click", () => {
            saveAll(saveAllPreFileName, preParams);
          });
        }
        buttonsRow.addItems(buttons);
      }
      for (const sheet of sheets)
        div.append(await getSheetPreview(sheet));
      if (!sheets.length)
        div.append(document.createTextNode(`No sheets.`));
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
