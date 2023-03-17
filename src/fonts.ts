import * as assets from "./assets.ts";
import * as dataURIConv from './data_uri_conv.ts';
import {AttributesDefTool} from './def_tool.ts';
import {Attributes, createElement, withUtilSVG} from './elements.ts';
import {Defs, Piece} from './pieces.ts';
import {sleep} from "./util.ts";

export type FontType = "woff" | "woff2" | "otf" | "ttf";

export const DEFAULT_FONT_TYPE: FontType = "woff2";

function mimeType(type: FontType) {
  return `font/${type}`;
}

export const FONT_WEIGHT_NAMES = {
  thin: 100,
  regular: 400,
  bold: 700,
};

export type FontWeight = number | keyof typeof FONT_WEIGHT_NAMES;

export function fontWeightValue(weight: FontWeight) {
  return typeof weight === "string" ? FONT_WEIGHT_NAMES[weight] : weight;
}

export interface FontAttributes {
  readonly italic?: boolean;
  readonly weight?: FontWeight;
  readonly attributes?: Attributes;
}

export function attributesFromFontAttributes(
  {italic, weight, attributes}: FontAttributes): Attributes {
  return {
    ...attributes,
    ...italic && {fontStyle: "italic"},
    ...weight && {fontWeight: fontWeightValue(weight)},
  };
}

function styleContentFromFontURL(name: string, url: string) {
  return `@font-face {
  font-family: ${JSON.stringify(name)};
  src: url(${JSON.stringify(url)});
}`;
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

  static async fromURL({name, url, fontAttributes}: {
    name: string,
    url: string,
    fontAttributes?: FontAttributes,
  }) {
    return await Font.fromStyle({
      name,
      styleContent: styleContentFromFontURL(name, url),
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
   * Waits for the font to be loaded.
   */
  static async googleFonts(name: string, fontAttributes?: FontAttributes) {
    const keys = [];
    const vals = [];
    if (fontAttributes?.italic) {
      keys.push("ital");
      vals.push(1);
    }
    if (fontAttributes?.weight !== undefined) {
      keys.push("wght");
      vals.push(fontWeightValue(fontAttributes.weight));
    }
    let family = name;
    if (keys.length)
      family += `:${keys.join(",")}@${vals.join(",")}`;
    return await Font.fromStyle({
      name,
      styleContent: `@import url(${JSON.stringify(
        `http://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}`
      )});`,
      fontAttributes,
    });
  }

}

const MAX_LOAD_STYLE_TIME_MILLIS = 5000;
const STYLE_TIME_MILLIS_STEP = 100;

async function loadStyle(styleContent: string) {
  const style = createElement({tagName: "style", children: styleContent});
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
  await document.fonts.ready;
  return style;
}
