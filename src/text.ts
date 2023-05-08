import {AttributesDefTool, SimpleAttributesDefTool} from './def_tool.ts';
import {Attributes, AttributesBuilder} from './elements.ts';
import {attributesFromFontAttributes, Font, FontAttributes} from './fonts.ts';
import {Defs, Piece} from './pieces.ts';

interface PathForTextArgs {
  path: Piece;
  textPathAttributes?: Attributes;
  textAttributes?: Attributes;
  align?: "start" | "center" | "end";
  id?: string;
}

export class PathForText extends SimpleAttributesDefTool {

  protected constructor(
    defs: Defs,
    attributes: Attributes,
    private readonly textDefTool: AttributesDefTool,
  ) {
    super(defs, attributes);
  }

  static create(params: PathForTextArgs): PathForText;
  static create(...params: Parameters<typeof SimpleAttributesDefTool.create>): never;
  static create(...params: unknown[]) {
    const [{
      path,
      textPathAttributes,
      textAttributes,
      align,
      id,
    }] = params as [PathForTextArgs];
    const tpAttributes: AttributesBuilder = {...textPathAttributes};
    const tAttributes: AttributesBuilder = {...textAttributes};
    if (align)
      [tpAttributes.startOffset, tAttributes.textAnchor] =
        align === "start" ? ["0%", "start"] :
          align === "center" ? ["50%", "middle"] :
            ["100%", "end"];
    const pathDefTool = path.asDefTool(id).useByHref();
    return new PathForText(
      pathDefTool,
      {...pathDefTool.asAttributes(), ...tpAttributes},
      SimpleAttributesDefTool.create(Piece.EMPTY, tAttributes),
    );
  }

  getTextDefTool() {
    return this.textDefTool;
  }

}

/** Creates a Piece containing a `<text>` SVG element. */
export function createText(text: string, {
  font,
  size = 1,
  fontAttributes,
  textPath,
  attributes = {},
}: {
  font?: Font | string,
  size?: string | number,
  fontAttributes?: FontAttributes,
  textPath?: PathForText | PathForTextArgs,
  attributes?: Attributes,
} = {}) {
  const fontDefTool = typeof font === "string" ? Font.system(font) : font;
  let textChild;
  let pathDefTool: PathForText | undefined;
  if (textPath) {
    pathDefTool = textPath instanceof PathForText ? textPath : PathForText.create(textPath);
    textChild = Piece.createElement({
      tagName: "textPath",
      children: [text],
    }).useDefTool(pathDefTool);
  } else
    textChild = text;
  let piece = Piece.createElement({
    tagName: "text",
    attributes: {
      fontSize: size,
      ...fontAttributes && attributesFromFontAttributes(fontAttributes),
      ...attributes,
    },
    children: [textChild],
  });
  if (fontDefTool)
    piece = piece.useDefTool(fontDefTool);
  if (pathDefTool)
    piece = piece.useDefTool(pathDefTool.getTextDefTool());
  return piece;
}
