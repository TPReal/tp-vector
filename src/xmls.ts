import * as assets from './assets.ts';
import {Path} from './path.ts';

interface XPathParams {
  readonly contextNode?: Node;
  readonly resolver?: XPathNSResolver | null;
  readonly type?: number;
}

export class ExternalXML {

  protected constructor(readonly doc: XMLDocument) {}

  static async fromAsset(urlAsset: assets.ModuleImport<string>) {
    const parser = new DOMParser();
    const text = await (await fetch(await assets.url(urlAsset))).text();
    const doc = parser.parseFromString(text, "text/xml");
    const error = doc.querySelector("parsererror");
    if (error) {
      console.error(`XML parsing error:`, error, `Parsed string:`, text);
      throw new Error(`XML parsing error: ${[...error.children].map(ch => ch.textContent).join("\n")}`);
    }
    return new ExternalXML(doc);
  }

  xpath(xpath: string, {contextNode = this.doc, resolver = this, type}: XPathParams = {}) {
    return this.doc.evaluate(xpath, contextNode, resolver, type);
  }

  xpathAll(xpath: string, {contextNode, resolver, type}: XPathParams = {}) {
    const res = this.xpath(xpath, {contextNode, resolver, type});
    const result: Node[] = [];
    let next = res.iterateNext();
    while (next) {
      result.push(next);
      next = res.iterateNext();
    }
    return result;
  }

  lookupNamespaceURI(prefix: string | null) {
    return prefix ? this.doc.documentElement.getAttribute(prefix === "xmlns" ? "xmlns" : `xmlns:${prefix}`) : null;
  }

  readonly inkscape = {

    pathFromD: (label0: string, ...labelsRest: string[]) => {
      const labels = [label0, ...labelsRest];
      const gLabels = labels.slice(0, -1);
      const pathLabel = labels.at(-1);
      const xpath = `string(/svg:svg${gLabels.map(l => `//svg:g[@inkscape:label=${JSON.stringify(l)}]`).join("")
        }//svg:path[@inkscape:label=${JSON.stringify(pathLabel)}]/@d)`;
      const d = this.xpath(xpath).stringValue || undefined;
      if (!d)
        throw new Error(`Expected path ${JSON.stringify(pathLabel)} to exist, but not found (xpath: ${JSON.stringify(xpath)})`);
      return Path.fromD(d);
    },

  }

}
