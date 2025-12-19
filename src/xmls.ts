import * as assets from './assets.ts';

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

}
