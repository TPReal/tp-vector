import * as assets from './assets.ts';
import * as dataURIConv from './data_uri_conv.ts';
import {AttributesDefTool} from './def_tool.ts';
import {Attributes, createElement, withUtilSVG} from './elements.ts';
import {Defs, Piece} from './pieces.ts';
import {assert, assertNumber, sleep} from './util.ts';

export type FontType = "woff" | "woff2" | "otf" | "ttf";

export const DEFAULT_FONT_TYPE: FontType = "woff2";

function mimeType(type: FontType) {
  return dataURIConv.mimeTypeFromExt(type);
}

export const FONT_WEIGHT_VALUES = {
  thin: 100,
  regular: 400,
  bold: 700,
};

export type FontWeight = number | keyof typeof FONT_WEIGHT_VALUES;

export function fontWeightValue(weight: FontWeight) {
  return typeof weight === "string" ? FONT_WEIGHT_VALUES[weight] : weight;
}

export interface FontAttributes {
  readonly italic?: boolean;
  readonly bold?: boolean;
  readonly weight?: FontWeight;
  readonly attributes?: Attributes;
}

function getFontWeight(fontAttributes?: FontAttributes) {
  if (fontAttributes?.weight !== undefined)
    return fontWeightValue(fontAttributes.weight);
  if (fontAttributes?.bold !== undefined)
    return FONT_WEIGHT_VALUES[fontAttributes.bold ? "bold" : "regular"];
}

export function attributesFromFontAttributes(
  {italic, bold, weight, attributes}: FontAttributes): Attributes {
  const attr = {...attributes};
  if (italic !== undefined)
    attr.fontStyle = italic ? "italic" : "normal";
  attr.fontWeight = getFontWeight({bold, weight});
  return attr;
}

export class Font extends AttributesDefTool {

  protected constructor(
    readonly name: string,
    fontAttributes: FontAttributes | undefined,
    defs: Defs,
  ) {
    super(defs, {
      fontFamily: name,
      ...fontAttributes && attributesFromFontAttributes(fontAttributes),
    });
  }

  static async fromBinary({name, type = DEFAULT_FONT_TYPE, binData, fontAttributes}: {
    name: string,
    type?: FontType,
    binData: string,
    fontAttributes?: FontAttributes,
  }) {
    return await Font.fromURL({
      name,
      url: dataURIConv.fromBinary({mimeType: mimeType(type), binData}),
      fontAttributes,
    });
  }

  static async fromBase64({name, type = DEFAULT_FONT_TYPE, base64Data, fontAttributes}: {
    name: string,
    type?: FontType,
    base64Data: string,
    fontAttributes?: FontAttributes,
  }) {
    return await Font.fromURL({
      name,
      url: dataURIConv.fromBase64({mimeType: mimeType(type), base64Data}),
      fontAttributes,
    });
  }

  /**
   * Loads font from a URL.
   * If it's an external URL, the font is fetched and encoded as data URI instead.
   */
  static async fromURL({name, url, fontAttributes}: {
    name: string,
    url: string,
    fontAttributes?: FontAttributes,
  }) {
    return await Font.fromStyle({
      name,
      styleContent: `@font-face {
  font-family: ${JSON.stringify(name)};
  src: url(${JSON.stringify(url)});
}`,
      fontAttributes,
    });
  }

  static async fromAsset({name, urlAsset, fontAttributes}: {
    name: string,
    urlAsset: assets.ModuleImport<string>,
    fontAttributes?: FontAttributes,
  }) {
    return await Font.fromURL({
      name,
      url: await assets.url(urlAsset),
      fontAttributes,
    });
  }

  private static async fromStyle({name, styleContent, fontAttributes}: {
    name: string,
    styleContent: string,
    fontAttributes?: FontAttributes,
  }) {
    return new Font(
      name,
      fontAttributes,
      Piece.createDefs(await loadStyle(styleContent)),
    );
  }

  /** Returns a font assumed to be available on the system. */
  static system(name: string, fontAttributes?: FontAttributes) {
    return new Font(name, fontAttributes, Piece.EMPTY);
  }

  /**
   * Creates a font from [Google Fonts](https://fonts.google.com/).
   * The font is fetched and encoded as data URI.
   *
   * If the font is not available on Google Fonts with the specified attributes,
   * the fetch will fail. It is still possible to use
   * [faux attributes](https://fonts.google.com/knowledge/glossary/faux_fake_pseudo_synthesized),
   * with:
   *
   *     Font.googleFonts(name).setFontAttributes(fontAttributes)
   */
  static async googleFonts(name: string, fontAttributes?: FontAttributes) {
    const keys = [];
    const vals = [];
    if (fontAttributes?.italic) {
      keys.push("ital");
      vals.push(1);
    }
    const weight = getFontWeight(fontAttributes)
    if (weight !== undefined) {
      keys.push("wght");
      vals.push(weight);
    }
    return await Font.fromStyle({
      name,
      styleContent: `@import url(${JSON.stringify(
        `http://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}` +
        (keys.length ? `:${keys.join(",")}@${vals.join(",")}` : "")
      )});`,
      fontAttributes,
    });
  }

  setFontAttributes(fontAttributes: FontAttributes) {
    return new Font(
      this.name,
      {...this.setFontAttributes, ...fontAttributes},
      this.defs,
    );
  }

}

const URL_REGEXP = /(?<import>@import\s+)?\burl\((?<q>['"]?)(?<url>.+?)\k<q>\)(?<semi>;)?/g;

/** Converts the URLs in the style content to data URIs. */
async function changeToDataURIs(styleContent: string): Promise<string> {
  const urls = [...styleContent.matchAll(URL_REGEXP)].map(async (mat) => {
    const blob = await (await fetch(assert(mat.groups).url)).blob();
    if (blob.type === "text/css" && mat.groups?.import)
      return {mat, text: await changeToDataURIs(await blob.text()) + "\n"};
    const dataURI = blob.type.startsWith("text/") ?
      dataURIConv.fromBinary({
        mimeType: blob.type,
        binData: await changeToDataURIs(await blob.text()),
      }) :
      await dataURIConv.fromBlob(blob);
    return {mat, text: `url(${JSON.stringify(dataURI)})${mat.groups?.semi || ""}`};
  });
  const out = []
  let ind = 0;
  for (const {mat, text} of await Promise.all(urls)) {
    out.push(styleContent.slice(ind, mat.index));
    out.push(text);
    ind = assertNumber(mat.index) + mat[0].length;
  }
  out.push(styleContent.slice(ind));
  return out.join("");
}

const MAX_LOAD_STYLE_TIME_MILLIS = 5000;
const STYLE_TIME_MILLIS_STEP = 100;

async function loadStyle(styleContent: string) {
  const style = createElement({
    tagName: "style",
    children: await changeToDataURIs(styleContent),
  });
  // TODO: Make waiting for load more reliable.
  await withUtilSVG(async svg => {
    svg.appendChild(style);
    for (let t = 0; t < MAX_LOAD_STYLE_TIME_MILLIS; t += STYLE_TIME_MILLIS_STEP) {
      if (style.sheet)
        return;
      await sleep(t);
    }
    if (!style.sheet)
      console.warn(`Failed waiting for style to load`, style);
  });
  await sleep(STYLE_TIME_MILLIS_STEP);
  await document.fonts.ready;
  return style;
}
