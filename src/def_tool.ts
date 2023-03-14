import {Attributes, AttributesBuilder} from './elements.ts';
import {Defs} from './pieces.ts';
import {OrArray, flatten} from './util.ts';

class IdHelper {

  readonly href;
  readonly url;

  constructor(readonly id: string) {
    this.href = `#${this.id}`;
    this.url = `url(${this.href})`;
  }

}

export type RefBy = "id" | "url" | "href";

export function getRef(id: string, refBy: RefBy = "url") {
  return new IdHelper(id)[refBy];
}

export class DefTool extends IdHelper implements Defs {

  protected constructor(
    private readonly defs: Defs,
    id: string,
  ) {
    super(id);
  }

  static create(defs: Defs, id: string) {
    return new DefTool(defs, id);
  }

  getDefs() {
    return this.defs.getDefs();
  }

  useByHref() {
    return this.useByAttributes({href: this.href});
  }

  useByAttribute(attributeName: OrArray<string>, refBy?: RefBy) {
    const ref = getRef(this.id, refBy);
    const attributes: AttributesBuilder = {};
    for (const attrName of flatten(attributeName))
      attributes[attrName] = ref;
    return this.useByAttributes(attributes);
  }

  useByAttributes(attributes: Attributes) {
    return AttributesDefTool.create(this.defs, attributes);
  }

}

export class AttributesDefTool implements Defs {

  protected constructor(
    private readonly defs: Defs,
    private readonly attributes: Attributes,
  ) {
  }

  static create(defs: Defs, attributes: Attributes) {
    return new AttributesDefTool(defs, attributes);
  }

  getDefs() {
    return this.defs.getDefs();
  }

  asAttributes() {
    return this.attributes;
  }

  addAttributes(attributes: Attributes) {
    return new AttributesDefTool(this.defs, {...this.attributes, ...attributes});
  }

}
