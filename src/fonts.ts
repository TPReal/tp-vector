import * as dataURIConv from './data_uri_conv.ts';
import {AttributesDefTool} from './def_tool.ts';
import {Attributes} from './elements.ts';
import {Defs, Piece} from './pieces.ts';

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

  static fromBinary({name, type = DEFAULT_FONT_TYPE, binData, fontAttributes}: {
    name: string,
    type?: FontType,
    binData: string,
    fontAttributes?: FontAttributes,
  }) {
    return Font.fromDataURI({
      name,
      dataURI: dataURIConv.fromBinary({mimeType: mimeType(type), binData}),
      fontAttributes,
    });
  }

  static fromBase64({name, type = DEFAULT_FONT_TYPE, base64Data, fontAttributes}: {
    name: string,
    type?: FontType,
    base64Data: string,
    fontAttributes?: FontAttributes,
  }) {
    return Font.fromDataURI({
      name,
      dataURI: dataURIConv.fromBase64({mimeType: mimeType(type), base64Data}),
      fontAttributes,
    });
  }

  static fromEncoded({name, type, base64Data}: {
    name: string,
    type: FontType,
    base64Data: string,
  }, fontAttributes?: FontAttributes) {
    return Font.fromBase64({
      name: `${name.replaceAll(".", "_")}__encoded`,
      type,
      base64Data,
      fontAttributes,
    });
  }

  static fromDataURI({name, dataURI, fontAttributes}: {
    name: string,
    dataURI: string,
    fontAttributes?: FontAttributes,
  }) {
    return Font.fromStyleSync({
      name,
      styleContent: styleContentFromFontURL(name, dataURI),
      fontAttributes,
    });
  }

  static async fromURL({name, url, fontAttributes}: {
    name: string,
    url: string,
    fontAttributes?: FontAttributes,
  }) {
    return await Font.fromStyleAsync({
      name,
      styleContent: styleContentFromFontURL(name, url),
      fontAttributes,
    });
  }

  private static fromStyleSync({name, styleContent, fontAttributes}: {
    name: string,
    styleContent: string,
    fontAttributes?: FontAttributes,
  }) {
    return new Font(
      name,
      fontAttributes,
      Piece.createElement({
        tagName: "style",
        children: styleContent,
      }).asDefs());
  }

  private static async fromStyleAsync({name, styleContent, fontAttributes}: {
    name: string,
    styleContent: string,
    fontAttributes?: FontAttributes,
  }) {
    const style = document.createElement("style");
    style.textContent = styleContent;
    await new Promise((resolve, reject) => {
      style.addEventListener("load", resolve, false);
      style.addEventListener("error", reject, false);
      document.body.appendChild(style);
    });
    await new Promise(resolve => setTimeout(resolve, 10));
    await document.fonts.ready;
    return Font.fromStyleSync({name, styleContent, fontAttributes});
  }

  static system(name: string, fontAttributes?: FontAttributes) {
    return new Font(name, fontAttributes, Piece.EMPTY);
  }

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
    return await Font.fromStyleAsync({
      name,
      styleContent: `@import url(${JSON.stringify(
        `http://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}`
      )});`,
      fontAttributes,
    });
  }

}
