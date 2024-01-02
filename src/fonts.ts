import * as assets from './assets.ts';
import * as dataURIConv from './data_uri_conv.ts';
import {AttributesDefTool} from './def_tool.ts';
import {Attributes, createElement} from './elements.ts';
import {getGlobalOptions} from './global_options.ts';
import {Defs, Piece} from './pieces.ts';
import {OrArrayRest, assert, assertNumber, flatten} from './util.ts';

export type FontType = "woff" | "woff2" | "otf" | "ttf";

export const DEFAULT_FONT_TYPE: FontType = "woff2";

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

const SIMPLE_FONT_NAME_REGEXP = /^[a-zA-Z0-9-]+$/;
const SIMPLE_QUOTABLE_FONT_NAME_REGEXP = /^[\w ]+$/;

function quoteFontName(name: string) {
  if (SIMPLE_FONT_NAME_REGEXP.test(name))
    return name;
  if (SIMPLE_QUOTABLE_FONT_NAME_REGEXP.test(name))
    return `'${name}'`;
  return JSON.stringify(name);
}

export class Font implements AttributesDefTool {

  protected constructor(
    readonly name: string,
    private readonly fontAttributes: FontAttributes | undefined,
    protected readonly defs: Defs,
    protected readonly fallback: Font | undefined,
    private readonly finalFallback: Font | undefined,
  ) {}

  static async fromBlob({name, blob, fontAttributes, finalFallback}: {
    name: string,
    blob: Blob,
    fontAttributes?: FontAttributes,
    finalFallback?: Font | Promise<Font> | false,
  }) {
    return await Font.fromURL({
      name,
      url: await dataURIConv.fromBlob(blob),
      fontAttributes,
      finalFallback,
    });
  }

  /**
   * Loads font from a URL.
   * If it's an external URL, the font is fetched and encoded as a data URI instead.
   */
  static async fromURL({name, url, fontAttributes, finalFallback}: {
    name: string,
    url: string,
    fontAttributes?: FontAttributes,
    finalFallback?: Font | Promise<Font> | false,
  }) {
    return await Font.fromStyle({
      name,
      styleContent: `@font-face {
  font-family: ${JSON.stringify(name)};
  src: url(${JSON.stringify(url)});
}`,
      fontAttributes,
      finalFallback,
    });
  }

  /**
   * Returns a font loaded from an asset.
   *
   * Example:
   *
   *     await Font.fromAsset({
   *       name: "My Font",
   *       urlAsset: import(`./my_font.woff2`),
   *     })
   *
   * See information on assets in _src/assets.ts_.
   */
  static async fromAsset({name, urlAsset, fontAttributes, finalFallback}: {
    name: string,
    urlAsset: assets.ModuleImport<string>,
    fontAttributes?: FontAttributes,
    finalFallback?: Font | Promise<Font> | false,
  }) {
    return await Font.fromURL({
      name,
      url: await assets.url(urlAsset),
      fontAttributes,
      finalFallback,
    });
  }

  private static async fromStyle({
    name,
    styleContent,
    fontAttributes,
    finalFallback = getGlobalOptions().fontFallbackToNotDef ? Font.notDef() : undefined,
  }: {
    name: string,
    styleContent: string,
    fontAttributes?: FontAttributes,
    finalFallback?: Font | Promise<Font> | false,
  }) {
    return new Font(
      name,
      fontAttributes,
      Piece.createDefs(await loadStyle(styleContent)),
      undefined,
      finalFallback ? await finalFallback : undefined,
    );
  }

  /** Returns a font assumed to be available on the system. */
  static system(name: string, {fontAttributes}: {
    fontAttributes?: FontAttributes,
  } = {}) {
    return new Font(name, fontAttributes, Piece.EMPTY, undefined, undefined);
  }

  /**
   * Creates a font from [Google Fonts](https://fonts.google.com/).
   * The font is fetched and encoded as a data URI.
   *
   * If the font is not available on Google Fonts with the specified attributes,
   * the fetch will fail. It is still possible to use
   * [faux attributes](https://fonts.google.com/knowledge/glossary/faux_fake_pseudo_synthesized),
   * with:
   *
   *     Font.googleFonts(name).setFontAttributes(fontAttributes)
   */
  static async googleFonts(name: string, {fontAttributes, text}: {
    fontAttributes?: FontAttributes,
    text?: string,
  } = {}) {
    return await Font.fromStyle({
      name,
      styleContent: `@import url(${JSON.stringify(googleFontsURL(name, {fontAttributes, text}))});`,
      fontAttributes,
    });
  }

  /**
   * Returns a font displaying a tofu character for every single character.
   * To be used as fallback font to detect missing characters.
   * @see https://github.com/adobe-fonts/adobe-notdef
   */
  static async notDef(): Promise<Font> {
    return await Font.fromURL({
      name: "Adobe NotDef",
      url: "https://cdn.jsdelivr.net/gh/adobe-fonts/adobe-notdef/AND-Regular.ttf",
      finalFallback: false,
    });
  }

  getDefs() {
    return this.getStack().reduce((a, f) => a.addDefs(f.defs), Piece.EMPTY).getDefs();
  }

  asAttributes() {
    return {
      fontFamily: this.getStack().map(f => quoteFontName(f.name)).join(", "),
      ...this.fontAttributes && attributesFromFontAttributes(this.fontAttributes),
    };
  }

  getStack() {
    const stack = [];
    let font: Font | undefined = this;
    while (font) {
      stack.push(font);
      font = font.fallback;
    }
    if (this.finalFallback)
      stack.push(this.finalFallback);
    return stack;
  }

  setFallback(fallback: Font | undefined) {
    return new Font(
      this.name,
      this.fontAttributes,
      this.defs,
      fallback,
      this.finalFallback,
    );
  }

  addFallback(...fallback: OrArrayRest<Font>) {
    const fallbackFonts = flatten(fallback);
    function withNextFallback(font: Font | undefined): Font | undefined {
      if (!fallbackFonts.length)
        return font;
      if (font)
        return font.setFallback(withNextFallback(font.fallback));
      return withNextFallback(fallbackFonts.shift());
    }
    return withNextFallback(this);
  }

  setFinalFallback(finalFallback: Font | undefined) {
    return new Font(
      this.name,
      this.fontAttributes,
      this.defs,
      this.fallback,
      finalFallback,
    );
  }

  clearFinalFallback() {
    return this.setFinalFallback(undefined);
  }

  setFontAttributes(fontAttributes: FontAttributes) {
    return new Font(
      this.name,
      {...this.setFontAttributes, ...fontAttributes},
      this.defs,
      this.fallback,
      this.finalFallback,
    );
  }

}

export function googleFontsURL(name: string, {fontAttributes, text}: {
  fontAttributes?: FontAttributes,
  text?: string,
} = {}) {
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
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}` +
    (keys.length ? `:${keys.join(",")}@${vals.join(",")}` : "") +
    (text ? `&text=${encodeURIComponent(text)}` : "");
}

const URL_REGEXP = /(?<import>@import\s+)?\burl\((?<q>['"]?)(?<url>.+?)\k<q>\)(?<semi>;)?/g;

const stylesCache = new Map<string, string>();

/** Converts the URLs in the style content to data URIs. */
async function changeToDataURIs(styleContent: string): Promise<string> {
  const cached = stylesCache.get(styleContent);
  if (cached !== undefined)
    return cached;
  const urls = [...styleContent.matchAll(URL_REGEXP)].map(async (mat) => {
    const {url} = assert(mat.groups);
    let blob;
    try {
      blob = await (await fetch(url)).blob();
    } catch (e) {
      throw new Error(`Failed to fetch: ${url}\n${e}`, {cause: e});
    }
    if (blob.type === "text/css" && mat.groups?.import)
      // If it was an import of another style, just process and paste that style.
      return {mat, text: await changeToDataURIs(await blob.text()) + "\n"};
    const dataURI = await dataURIConv.fromBlob(blob);
    return {mat, text: `url(${JSON.stringify(dataURI)})${mat.groups?.semi ?? ""}`};
  });
  const out = []
  let ind = 0;
  for (const {mat, text} of await Promise.all(urls)) {
    out.push(styleContent.slice(ind, mat.index));
    out.push(text);
    ind = assertNumber(mat.index) + mat[0].length;
  }
  out.push(styleContent.slice(ind));
  const result = out.join("");
  stylesCache.set(styleContent, result);
  return result;
}

async function loadStyle(styleContent: string) {
  // TODO: Find a reliable way of waiting for the font to load. Right now a page reload is
  // sometimes necessary, because text elements are measured before the font is loaded.
  return createElement({
    tagName: "style",
    children: await changeToDataURIs(styleContent),
  });
}
