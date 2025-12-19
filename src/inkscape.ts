import * as assets from './assets.ts';
import {Path} from './path.ts';
import {ExternalXML} from './xmls.ts';

/**
 * A class representing an imported Inkscape SVG file.
 *
 * Usage:
 *
 *     const inkscapeFile = await InkscapeImporter.fromAsset(import("" + "./path/to/file.svg"));
 *     const path = inkscapeFile.pathFromD("Group Label", "Path Label");
 */
export class InkscapeImporter extends ExternalXML {

  static async fromAsset(urlAsset: assets.ModuleImport<string>) {
    return new InkscapeImporter((await ExternalXML.fromAsset(urlAsset)).doc);
  }

  pathFromD(label0: string, ...labelsRest: string[]) {
    const labels = [label0, ...labelsRest];
    const gLabels = labels.slice(0, -1);
    const pathLabel = labels.at(-1)!;
    function withLabel(l: string) {
      return `[@inkscape:label=${JSON.stringify(l)}]`;
    }
    const xpath = `string(/svg:svg` +
      gLabels.map(l => `//svg:g${withLabel(l)}`).join("") +
      `//svg:path${withLabel(pathLabel)}/@d)`;
    const d = this.xpath(xpath).stringValue || undefined;
    if (!d)
      throw new Error(`Expected path ${JSON.stringify(pathLabel)} to exist, but not found (xpath: ${JSON.stringify(xpath)})`);
    return Path.fromD(d);
  }

}
