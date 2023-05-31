import {generateId} from '../ids.ts';
import {SectionDef, unwrap} from './types.ts';
import * as globalOptions from '../global_options.ts';
import {assert} from '../util.ts';

// TODO: Consider improving the Viewer page.

const SYMBOLS = {
  mobile: {
    allSections: `*`,
    up: `↑`,
  },
  desktop: {
    allSections: `🞹`,
    up: `⮝`,
  },
};

function isMobile() {
  return matchMedia(
    "only screen and (hover: none) and (pointer: coarse) and (max-width: 1000px)"
  ).matches;
}

const GLOBAL_OPTIONS_PRESET_KEY = "global_options_preset";
const WIDTH_KEY = "width";
const SECTION_KEY = "section";

const ERROR_SECTION_START = `/// `;

export async function showViewer({
  globalOptsMap,
  sectionDefs,
  parent = document.body,
  section = new URLSearchParams(location.search).get(SECTION_KEY) || undefined,
}: {
  globalOptsMap: ReadonlyMap<string, globalOptions.GlobalOptionsInput> | undefined,
  sectionDefs: readonly SectionDef[],
  parent?: HTMLElement,
  section?: string,
}) {
  const mobile = isMobile();
  const symbols = SYMBOLS[mobile ? "mobile" : "desktop"];

  let globalOptsPreset: string | undefined;
  if (globalOptsMap) {
    globalOptions.reset();
    globalOptsPreset =
      new URLSearchParams(location.search).get(GLOBAL_OPTIONS_PRESET_KEY) ?? undefined;
    if (globalOptsPreset === undefined || !globalOptsMap.has(globalOptsPreset))
      globalOptsPreset = globalOptsMap.has("") ? "" : [...globalOptsMap.keys()].at(0);
    if (globalOptsPreset !== undefined)
      globalOptions.modify(assert(globalOptsMap.get(globalOptsPreset)));
  }

  const header = document.createElement("header");
  parent.append(header);
  header.style.position = "fixed";
  header.style.top = "0";
  header.style.width = "100%";
  header.style.background = "white";
  header.style.padding = "0.5em 0";
  header.style.display = "flex";
  header.style.flexWrap = "wrap";
  header.style.gap = "0.5em";
  const headerPlaceholder = document.createElement("div");
  parent.append(headerPlaceholder);
  headerPlaceholder.style.height = "2em";
  const sectionSelect = document.createElement("select");
  header.append(sectionSelect);
  sectionSelect.title = `Select section`;
  sectionSelect.style.minWidth = "15em";
  sectionSelect.addEventListener("change", () => {
    showSection(sectionSelect.value);
  });
  const clearSectionButton = document.createElement("button");
  header.append(clearSectionButton);
  clearSectionButton.textContent = symbols.up;
  clearSectionButton.addEventListener("click", () => {
    showSection(undefined);
  });
  const errorsInfo = document.createElement("a");
  header.append(errorsInfo);
  errorsInfo.href = "#";
  errorsInfo.style.alignSelf = "center";
  errorsInfo.style.color = "red";
  errorsInfo.addEventListener("click", e => {
    e.preventDefault();
    showSection(id => id.startsWith(ERROR_SECTION_START));
  });
  if (globalOptsMap && (globalOptsMap.size > 1 || globalOptsPreset)) {
    const filler = document.createElement("div");
    header.append(filler);
    filler.style.flex = "1 0 0";
    const globalOptsSelect = document.createElement("select");
    header.append(globalOptsSelect);
    globalOptsSelect.title = `Select global options preset`;
    globalOptsSelect.style.minWidth = "5em";
    globalOptsSelect.style.marginRight = "1em";
    for (const preset of globalOptsMap.keys()) {
      const option = document.createElement("option");
      globalOptsSelect.insertAdjacentElement(preset ? "beforeend" : "afterbegin", option);
      option.text = preset || `(default)`;
      option.value = preset;
    }
    globalOptsSelect.value = globalOptsPreset || "";
    globalOptsSelect.addEventListener("change", () => {
      location.assign(setSearchParam(
        location.href, GLOBAL_OPTIONS_PRESET_KEY, globalOptsSelect.value || undefined));
    });
  }

  const container = document.createElement("div");
  parent.append(container);
  container.style.display = "flex";
  container.style.gap = "4px";
  const resizableArea = document.createElement("div");
  container.append(resizableArea);
  resizableArea.style.flex = "0 1 auto";
  resizableArea.style.minWidth = "100px";
  const resizeWidth = !mobile &&
    (localStorage.getItem(WIDTH_KEY) || new URLSearchParams(location.search).get(WIDTH_KEY));
  resizableArea.style.width = resizeWidth ? `${resizeWidth}px` : "100%";
  if (!mobile) {
    const resizeHandle = document.createElement("div");
    container.append(resizeHandle);
    resizeHandle.style.flex = "0 0 6px";
    resizeHandle.style.backgroundColor = "#444";
    resizeHandle.style.boxSizing = "border-box";
    resizeHandle.style.border = "2px solid white";
    resizeHandle.style.cursor = "ew-resize";
    const handleRect = resizeHandle.getBoundingClientRect();
    const resizeOffset = handleRect.left + handleRect.width / 2 -
      resizableArea.getBoundingClientRect().width;
    let resizeHandleGrabbed = false;
    resizeHandle.addEventListener("mousedown", () => {resizeHandleGrabbed = true;});
    document.addEventListener("mouseup", () => {resizeHandleGrabbed = false;});
    document.addEventListener("mousemove", e => {
      if (resizeHandleGrabbed) {
        e.preventDefault();
        const anchorSection = [...sectionsContainer.children]
          .find(el => el.getBoundingClientRect().top >= 0) || sectionsContainer.firstElementChild;
        const anchorScroll = anchorSection?.getBoundingClientRect().top ?? 0;
        const width = e.clientX - resizeOffset;
        resizableArea.style.width = `${width}px`;
        if (resizableArea.clientWidth >= width)
          localStorage.setItem(WIDTH_KEY, String(width));
        else {
          resizableArea.style.width = "100%";
          localStorage.removeItem(WIDTH_KEY);
        }
        if (anchorSection)
          window.scrollBy({top: anchorSection.getBoundingClientRect().top - anchorScroll});
      }
    });
  }

  const sectionsContainer = document.createElement("div");
  resizableArea.append(sectionsContainer);
  sectionsContainer.style.display = "flex";
  sectionsContainer.style.flexDirection = "column";
  sectionsContainer.style.gap = "2em";

  function showSection(
    id: undefined | string | ((id: string) => boolean),
    {updateURL = true} = {},
  ) {
    id ||= () => true;
    const stringId = typeof id === "string" && !id.startsWith(ERROR_SECTION_START) ?
      id : undefined;
    if (updateURL)
      history.pushState({section: stringId}, "",
        setSearchParam(location.href, SECTION_KEY, stringId));
    [clearSectionButton.textContent, clearSectionButton.title] = stringId ?
      [symbols.allSections, `Show all sections`] :
      [symbols.up, `Back to top`];
    sectionSelect.value = stringId || "";
    const funcId = typeof id === "function" ? id : (sectId: string) => sectId === id;
    let count = 0;
    for (const section of document.querySelectorAll<HTMLElement>(".section")) {
      const show = funcId(section.id);
      section.style.display = show ? "unset" : "none";
      if (show)
        count++;
    }
    if (typeof id === "string" && !count)
      showSection(undefined, {updateURL});
    else
      (parent === document.body ? document.documentElement : parent).scrollTop = 0;
  }

  function addOption(name: string | undefined) {
    const option = document.createElement("option");
    option.text = name || `${symbols.allSections} all sections`;
    if (!name)
      option.style.fontWeight = "bold";
    option.value = name || "";
    sectionSelect.append(option);
  }

  function addSection(name: string) {
    const section = document.createElement("div");
    sectionsContainer.append(section);
    section.style.display = "none";
    section.classList.add("section");
    section.id = name;
    addOption(name);
    const title = document.createElement("div");
    section.append(title);
    title.style.fontSize = "1.5em";
    title.style.cursor = "pointer";
    const dot = document.createElement("span");
    title.append(dot);
    dot.style.fontWeight = "bold";
    dot.textContent = `•`;
    title.append(` ${name}`);
    title.addEventListener("click", () => {
      showSection(name);
    });
    return section;
  }

  addOption(undefined);
  sectionSelect.append(document.createElement("hr"));

  const progress = document.createElement("progress");
  sectionsContainer.append(progress);
  progress.style.width = "100%";
  const results = await Promise.allSettled(sectionDefs.map(sect => unwrap(sect, [])));
  progress.remove();
  let numFailed = 0;
  for (const result of results)
    if (result.status === "fulfilled") {
      const {name, element} = result.value;
      addSection(name).append(element);
    } else {
      numFailed++;
      const pre = document.createElement("pre");
      pre.style.color = "red";
      pre.textContent = result.reason?.stack || String(result.reason);
      addSection(ERROR_SECTION_START + generateId("section_error")).append(pre);
    }
  if (numFailed)
    errorsInfo.textContent = `Failed sections: ${numFailed}`;

  showSection(section, {updateURL: false});
  addEventListener("popstate", event => {
    showSection(event.state?.section, {updateURL: false});
  });

  return container;
}

function setSearchParam(href: string, param: string, value: string | undefined) {
  const url = new URL(href);
  if (value === undefined)
    url.searchParams.delete(param);
  else
    url.searchParams.set(param, value);
  if (url.host === "htmlpreview.github.io") {
    const [k1, v1] = [...url.searchParams.entries()][0];
    if (k1.startsWith("https://github.com/") && !v1) {
      url.searchParams.delete(k1);
      url.search = `?${k1}&${url.searchParams.toString()}`;
    }
  }
  return url.toString();
}
