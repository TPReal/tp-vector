import {flatten, OrArray} from './util.ts';

export class ButtonsRow {

  readonly elem;

  protected constructor() {
    this.elem = document.createElement("div");
    this.elem.style.display = "flex";
    this.elem.style.flexWrap = "wrap";
    this.elem.style.gap = "0.2em";
  }

  static create() {
    return new ButtonsRow();
  }

  addItems(items: OrArray<HTMLElement>) {
    const span = document.createElement("span");
    let first = true;
    for (const item of flatten(items)) {
      if (first)
        first = false;
      else
        item.style.marginLeft = "-1px";
      item.style.minHeight = "2.2em";
      span.append(item);
    }
    this.elem.append(span);
    return this;
  }

  addSeparator() {
    const sep = document.createElement("hr");
    sep.style.margin = "2px";
    this.elem.append(sep);
    return this;
  }

}
