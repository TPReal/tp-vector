import {Attributes, AttributesBuilder} from './elements.ts';
import {Defs} from './pieces.ts';
import {OrArray, flatten} from './util.ts';

export class IdHelper {

  readonly href;
  readonly url;

  constructor(readonly id: string) {
    this.href = `#${this.id}`;
    this.url = `url(${this.href})`;
  }

}

/** A way to reference a Defs element. Different elements need to be referenced differently. */
export type RefBy = "id" | "url" | "href";

export function getRef(id: string, refBy: RefBy = "url") {
  return new IdHelper(id)[refBy];
}

/**
 * A GenericDefTool is a tool that can be used on a piece to change its properties by setting
 * some (not yet known) attributes and attaching a Defs to it. It is typically used for things like
 * gradient or pattern, which can then be used as fill or stroke.
 */
export class GenericDefTool extends IdHelper implements Defs {

  protected constructor(
    protected readonly defs: Defs,
    id: string,
  ) {
    super(id);
  }

  static create(defs: Defs, id: string) {
    return new GenericDefTool(defs, id);
  }

  getDefs() {
    return this.defs.getDefs();
  }

  /** Creates an AttributesDefTool that references the tool by href. */
  useByHref() {
    return this.useByAttribute("href", "href");
  }

  /**
   * Creates an AttributesDefTool that references the tool by the specified attribute
   * or attributes.
   */
  useByAttribute(attributeName: OrArray<string>, refBy?: RefBy) {
    const ref = getRef(this.id, refBy);
    const attributes: AttributesBuilder = {};
    for (const attrName of flatten(attributeName))
      attributes[attrName] = ref;
    return SimpleAttributesDefTool.create(this.defs, attributes);
  }

}

/**
 * An AttributesDefTool is a tool that can be used on a piece to change its properties by setting
 * particular attributes and attaching a Defs to it. It is typically used for things like clip path,
 * mask or font.
 */
export interface AttributesDefTool extends Defs {

  asAttributes(): Attributes;

}

export class SimpleAttributesDefTool implements AttributesDefTool {

  protected constructor(
    protected readonly defs: Defs,
    protected readonly attributes: Attributes,
  ) {
  }

  static create(defs: Defs, attributes: Attributes) {
    return new SimpleAttributesDefTool(defs, attributes);
  }

  getDefs() {
    return this.defs.getDefs();
  }

  asAttributes() {
    return this.attributes;
  }

}
