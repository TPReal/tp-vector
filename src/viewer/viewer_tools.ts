import {generateId} from "../ids.ts";
import {assert, Sheet} from "../index.ts";

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
  runsController.style.alignItems = "center";
  const blinkTimers: number[] = [];
  for (const g of svg.querySelectorAll(":scope > g[id]")) {
    const id = assert(g.getAttribute("id"));
    const span = document.createElement("span");
    runsController.appendChild(span);
    const checkbox = document.createElement("input");
    span.appendChild(checkbox);
    checkbox.setAttribute("type", "checkbox");
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

type OrPromise<T> = T | Promise<T>;
type OrFuncPromise<T> = OrPromise<T> | (() => OrPromise<T>);

async function unwrap<T>(obj: OrFuncPromise<T>): Promise<T> {
  const awaitable = typeof obj === "function" ? (obj as () => OrPromise<T>)() : obj;
  return await awaitable;
}

type SectionDef = OrFuncPromise<{
  name: string,
  element: HTMLElement,
}>;

export const ALL_SECTIONS = "*";

export class Viewer {

  protected constructor(private readonly sections: readonly SectionDef[]) {
  }

  static create() {
    return new Viewer([]);
  }

  private addSect(sect: SectionDef) {
    return new Viewer([...this.sections, sect]);
  }

  add(element: OrFuncPromise<Sheet>): Viewer;
  /**
   * Adds a section with the specified element. The name of the section is taken from
   * `element.dataset.name` (taken from the `data-name` attribute).
   */
  add(element: OrFuncPromise<HTMLElement>): Viewer;
  add(name: string, element: OrFuncPromise<HTMLElement>): Viewer;
  add(...args:
    | [OrFuncPromise<Sheet>]
    | [OrFuncPromise<HTMLElement>]
    | [string, OrFuncPromise<HTMLElement>]) {
    const [name, item] = args.length === 2 ? args : [undefined, args[0]];
    return this.addSect(async () => {
      const unwrapped = await unwrap(item);
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

  async show({
    parent = document.body,
    section = new URLSearchParams(location.search).get("section") || ALL_SECTIONS,
  }: {
    parent?: HTMLElement,
    section?: string,
  } = {}) {
    // TODO: Consider improving the Viewer page.
    const container = document.createElement("div");
    parent.appendChild(container);
    container.style.display = "flex";
    container.style.gap = "4px";
    const resizableArea = document.createElement("div");
    container.appendChild(resizableArea);
    resizableArea.style.flex = "0 1 auto";
    resizableArea.style.minWidth = "300px";
    const resizeWidth = localStorage.getItem("width");
    resizableArea.style.width = resizeWidth ? `${resizeWidth}px` : "100%";
    const resizeHandle = document.createElement("div");
    container.appendChild(resizeHandle);
    resizeHandle.style.flex = "0 0 8px";
    resizeHandle.style.backgroundColor = "grey";
    resizeHandle.style.boxSizing = "border-box";
    resizeHandle.style.border = "2px solid white";
    resizeHandle.style.cursor = "ew-resize";

    const handleRect = resizeHandle.getBoundingClientRect();
    const resizeOffset = handleRect.left + handleRect.width / 2 - resizableArea.getBoundingClientRect().width;
    let resizeHandleGrabbed = false;
    resizeHandle.addEventListener("mousedown", () => {resizeHandleGrabbed = true;});
    document.addEventListener("mouseup", () => {resizeHandleGrabbed = false;});
    document.addEventListener("mousemove", e => {
      if (resizeHandleGrabbed) {
        const width = e.clientX - resizeOffset;
        resizableArea.style.width = `${width}px`;
        if (resizableArea.clientWidth >= width)
          localStorage.setItem("width", String(width));
        else {
          resizableArea.style.width = "100%";
          localStorage.removeItem("width");
        }
        e.preventDefault();
      }
    });

    const sectionSelectContainer = document.createElement("div");
    resizableArea.appendChild(sectionSelectContainer);
    const sectionSelect = document.createElement("select");
    sectionSelectContainer.appendChild(sectionSelect);
    sectionSelect.style.marginBottom = "2em";
    sectionSelect.addEventListener("change", () => {
      switchToSection(sectionSelect.value);
    });
    const sectionsContainer = document.createElement("div");
    resizableArea.appendChild(sectionsContainer);
    sectionsContainer.style.display = "flex";
    sectionsContainer.style.flexDirection = "column";
    sectionsContainer.style.gap = "2em";

    function switchToSection(id: string | undefined) {
      const url = new URL(location.href);
      if (id)
        url.searchParams.set("section", id);
      else
        url.searchParams.delete("section");
      history.pushState({section: id}, "", url.toString());
      showSection(id);
    }

    function showSection(id: string | undefined) {
      sectionSelect.value = id || "";
      for (const section of document.querySelectorAll<HTMLElement>(".section"))
        section.style.display = id === "*" || section.id === id ? "unset" : "none";
    }

    function addOption(name: string) {
      const option = document.createElement("option");
      option.text = name;
      option.setAttribute("value", name);
      sectionSelect.appendChild(option);
    }

    function addSection(name: string) {
      const section = document.createElement("div");
      sectionsContainer.appendChild(section);
      section.style.display = "none";
      section.classList.add("section");
      section.setAttribute("id", name);
      addOption(name);
      const title = document.createElement("div");
      section.appendChild(title);
      title.textContent = name;
      title.style.fontSize = "1.5em";
      title.style.cursor = "pointer";
      title.addEventListener("click", () => {
        switchToSection(name);
      });
      return section;
    }

    addOption("*");
    for (const {name, element} of await Promise.all(this.sections.map(unwrap)))
      addSection(name).appendChild(element);

    showSection(section);
    addEventListener("popstate", event => {
      showSection(event.state?.section || ALL_SECTIONS);
    });

    return container;
  }

}

export const RELOAD = () => {
  location.reload();
}

/**
 * Installs the live reload provided by esbuild.
 * @see https://esbuild.github.io/api/#live-reload
 */
export function installLiveReload(handler = RELOAD) {
  new EventSource('/esbuild').addEventListener('change', handler);
}
