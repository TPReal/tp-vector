import * as globalOptions from '../global_options.ts';
import {assert} from '../util.ts';
import {SectionDef, SectionItemDef, unwrap} from './types.ts';

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

export function showViewer({
  globalOptsMap,
  sectionItems,
  parent = document.body,
  tableOfContents = false,
  section = new URLSearchParams(location.search).get(SECTION_KEY) || undefined,
}: {
  globalOptsMap: ReadonlyMap<string, globalOptions.GlobalOptionsInput> | undefined,
  sectionItems: readonly SectionItemDef[],
  parent?: HTMLElement,
  tableOfContents?: boolean,
  section?: string,
}) {
  const sectionDefs = sectionItems.filter((item): item is SectionDef => item !== "separator");

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

  const main = document.createElement("div");
  parent.append(main);
  if (parent === document.body) {
    parent.style.margin = "0";
    main.style.width = "100vw";
    main.style.height = "100vh";
  } else {
    main.style.width = "100%";
    main.style.height = "100%";
  }
  main.style.display = "flex";
  main.style.flexDirection = "column";
  main.style.alignItems = "stretch";
  const header = document.createElement("header");
  main.append(header);
  header.style.background = "white";
  header.style.padding = "0.5em";
  header.style.display = "flex";
  header.style.flexWrap = "wrap";
  header.style.alignItems = "stretch";
  header.style.gap = "0.5em";
  header.style.borderBottom = "1px solid #ccc";
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
    if (sectionSelect.value)
      showSection(undefined);
    else
      scrollToTop();
  });
  const globalProgress = document.createElement("progress");
  header.append(globalProgress);
  globalProgress.style.alignSelf = "center";
  globalProgress.style.flex = "1 0 0";
  globalProgress.style.visibility = "hidden";
  if (globalOptsMap && (globalOptsMap.size > 1 || globalOptsPreset)) {
    const globalOptsSelect = document.createElement("select");
    header.append(globalOptsSelect);
    globalOptsSelect.title = `Select global options preset`;
    globalOptsSelect.style.minWidth = "5em";
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

  const scrollContainer = document.createElement("div");
  main.append(scrollContainer);
  scrollContainer.style.overflowY = "auto";
  const container = document.createElement("div");
  scrollContainer.append(container);
  container.style.margin = "0.5em";
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
          scrollContainer.scrollBy({top: anchorSection.getBoundingClientRect().top - anchorScroll});
      }
    });
  }

  const sectionsContainer = document.createElement("div");
  resizableArea.append(sectionsContainer);
  sectionsContainer.style.display = "flex";
  sectionsContainer.style.flexDirection = "column";
  sectionsContainer.style.gap = "2em";

  function clearSections() {
    while (sectionsContainer.firstChild)
      sectionsContainer.firstChild.remove();
  }

  function createSectionTitle(name: string) {
    const title = document.createElement("a");
    title.style.fontSize = "1.5em";
    title.style.cursor = "pointer";
    title.style.display = "flex";
    title.style.gap = "0.2em";
    const dot = document.createElement("span");
    title.append(dot);
    dot.style.fontWeight = "bold";
    dot.textContent = `•`;
    title.append(name);
    title.addEventListener("click", () => {
      showSection(name);
    });
    return title;
  }

  async function loadSections(sections: readonly SectionDef[]) {
    globalProgress.value = 0;
    globalProgress.max = sections.length;
    globalProgress.style.visibility = "visible";
    clearSections();
    await new Promise(resolve => {
      setTimeout(resolve, 0);
    });
    await Promise.all(sections.map(async ({name, element}) => {
      const section = document.createElement("div");
      sectionsContainer.append(section);
      section.classList.add("section");
      section.append(createSectionTitle(name));
      const progress = document.createElement("progress");
      section.append(progress);
      progress.style.width = "100%";
      let content;
      try {
        content = await unwrap(element);
      } catch (e) {
        console.warn(`Error rendering section ${JSON.stringify(name)}:`, e);
        content = document.createElement("pre");
        content.style.color = "red";
        content.textContent = (e instanceof Error ? e.stack : undefined) || String(e);
      } finally {
        progress.remove();
        if (content)
          section.append(content);
        globalProgress.value++;
      }
    }));
    globalProgress.style.visibility = "hidden";
  }

  function scrollToTop() {
    scrollContainer.scrollTo({top: 0, behavior: "smooth"});
  }

  function showSection(id: undefined | string, {updateURL = true} = {}) {
    if (id !== undefined && !sectionDefs.some(({name}) => name === id)) {
      id = undefined;
      updateURL = true;
    }
    const idString = id ?? "";
    if (updateURL)
      history.pushState({section: id}, "", setSearchParam(location.href, SECTION_KEY, id));
    [clearSectionButton.textContent, clearSectionButton.title] = id === undefined ?
      [symbols.up, `Back to top`] :
      [symbols.allSections, `Show all sections`];
    sectionSelect.value = idString;
    loadSections(id === undefined ? sectionDefs : sectionDefs.filter(({name}) => name === id));
    scrollToTop();
  }

  function showTableOfContents() {
    clearSections();
    const toc = document.createElement("div");
    toc.style.display = "flex";
    toc.style.flexDirection = "column";
    toc.style.alignItems = "start";
    sectionsContainer.append(toc);
    for (const sect of sectionItems)
      if (sect === "separator") {
        const hr = document.createElement("hr");
        toc.append(hr);
        hr.style.width = "100%";
      } else
        toc.append(createSectionTitle(sect.name));
  }

  function addOption(name: string | undefined) {
    const option = document.createElement("option");
    option.text = name || `${symbols.allSections} All sections`;
    if (!name)
      option.style.fontWeight = "bold";
    option.value = name || "";
    sectionSelect.append(option);
  }

  addOption(undefined);
  sectionSelect.append(document.createElement("hr"));
  for (const sect of sectionItems)
    if (sect === "separator")
      sectionSelect.append(document.createElement("hr"));
    else
      addOption(sect.name);

  if (section || !tableOfContents)
    showSection(section, {updateURL: false});
  else
    showTableOfContents();
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
