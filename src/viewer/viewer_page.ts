import {generateId} from '../ids.ts';
import {SectionDef, unwrap} from './types.ts';

// TODO: Consider improving the Viewer page.

const ALL_SECTIONS_SYMBOL = `🞹`;
const UP_SYMBOL = `⮝`;

export async function showViewer({
  sectionDefs,
  parent = document.body,
  section = new URLSearchParams(location.search).get("section") || undefined,
}: {
  sectionDefs: readonly SectionDef[],
  parent?: HTMLElement,
  section?: string,
}) {
  const ERROR_SECTION_START = `/// `;
  const header = document.createElement("header");
  parent.append(header);
  header.style.position = "fixed";
  header.style.top = "0";
  header.style.width = "100%";
  header.style.background = "white";
  header.style.padding = "0.5em";
  header.style.display = "flex";
  header.style.gap = "0.5em";
  const headerPlaceholder = document.createElement("div");
  parent.append(headerPlaceholder);
  headerPlaceholder.style.height = "2em";
  const sectionSelect = document.createElement("select");
  header.append(sectionSelect);
  sectionSelect.title = "Select section";
  sectionSelect.style.minWidth = "15em";
  sectionSelect.addEventListener("change", () => {
    showSection(sectionSelect.value);
  });
  const clearSectionButton = document.createElement("button");
  header.append(clearSectionButton);
  clearSectionButton.textContent = "⮝";
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

  const container = document.createElement("div");
  parent.append(container);
  container.style.display = "flex";
  container.style.gap = "4px";
  const resizableArea = document.createElement("div");
  container.append(resizableArea);
  resizableArea.style.flex = "0 1 auto";
  resizableArea.style.minWidth = "100px";
  const resizeWidth =
    localStorage.getItem("width") || new URLSearchParams(location.search).get("width");
  resizableArea.style.width = resizeWidth ? `${resizeWidth}px` : "100%";
  const resizeHandle = document.createElement("div");
  container.append(resizeHandle);
  resizeHandle.style.flex = "0 0 6px";
  resizeHandle.style.backgroundColor = "#444";
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
      e.preventDefault();
      const anchorSection = [...sectionsContainer.children]
        .find(el => el.getBoundingClientRect().top >= 0) || sectionsContainer.firstElementChild;
      const anchorScroll = anchorSection?.getBoundingClientRect().top ?? 0;
      const width = e.clientX - resizeOffset;
      resizableArea.style.width = `${width}px`;
      if (resizableArea.clientWidth >= width)
        localStorage.setItem("width", String(width));
      else {
        resizableArea.style.width = "100%";
        localStorage.removeItem("width");
      }
      if (anchorSection)
        window.scrollBy({top: anchorSection.getBoundingClientRect().top - anchorScroll});
    }
  });

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
    if (updateURL) {
      const url = new URL(location.href);
      if (stringId)
        url.searchParams.set("section", stringId);
      else
        url.searchParams.delete("section");
      history.pushState({section: stringId}, "", url.toString());
    }
    [clearSectionButton.textContent, clearSectionButton.title] = stringId ?
      [ALL_SECTIONS_SYMBOL, `Show all sections`] :
      [UP_SYMBOL, `Back to top`];
    sectionSelect.value = stringId || "";
    const funcId = typeof id === "function" ? id : (sectId: string) => sectId === id;
    for (const section of document.querySelectorAll<HTMLElement>(".section"))
      section.style.display = funcId(section.id) ? "unset" : "none";
    (parent === document.body ? document.documentElement : parent).scrollTop = 0;
  }

  function addOption(name: string | undefined) {
    const option = document.createElement("option");
    option.text = name || `${ALL_SECTIONS_SYMBOL} all sections`;
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
