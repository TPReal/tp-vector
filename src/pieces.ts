import {PartialBoxAlignment} from './alignment.ts';
import {AttributesDefTool, DefTool, RefBy} from './def_tool.ts';
import {Attributes, cloneElement, createElement, getElementsBoundingBox, setAttributes, uniqueElements} from './elements.ts';
import * as figures from './figures.ts';
import {generateId} from './ids.ts';
import {Layerable, NO_LAYER, OptionalLayerName, inLayerString} from './layers.ts';
import {NormaliseArgs, getNormaliseTransform} from './normalise_transform.ts';
import {parseSVG} from './parse_svg.ts';
import {Tf, Transform, transformedToString} from './transform.ts';
import {AbstractTransformableTo} from './transformable.ts';
import {OrArray, OrArrayRest, flatten, flattenFilter} from './util.ts';
import {PartialViewBox, PartialViewBoxMargin, ViewBox, extendViewBox, multiplyMargin, viewBoxMarginFromPartial} from './view_box.ts';

export interface Defs {

  getDefs(): SVGElement[];

}

export interface BasicPiece extends Layerable<BasicPiece>, Partial<Defs> {

  getElements(): SVGElement[];
  getBoundingBoxElements?(): SVGElement[];

}

function hasMethods<T>(object: unknown, methods: (keyof T)[]) {
  return !!object && methods.every(m => typeof (object as T)[m] === "function");
}

function isDefs(arg: unknown): arg is Defs {
  return hasMethods<Defs>(arg, ["getDefs"]);
}

function isBasicPiece(arg: unknown): arg is BasicPiece {
  return hasMethods<BasicPiece>(arg, ["getElements", "setLayer", "selectLayers"]);
}

class SVGElementWrapperPiece implements BasicPiece {

  protected constructor(
    private readonly element: SVGElement,
    private readonly layer: OptionalLayerName,
  ) {
  }

  static create(element: SVGElement, layer: OptionalLayerName = NO_LAYER) {
    return new SVGElementWrapperPiece(element, layer);
  }

  getElements() {
    return [cloneElement(this.element)];
  }

  setLayer(layer: OptionalLayerName) {
    return SVGElementWrapperPiece.create(this.element, layer);
  }

  selectLayers(...layers: OrArrayRest<OptionalLayerName>) {
    return flatten(layers).includes(this.layer) ? this : Piece.EMPTY;
  }

}

class DefsWrapperPiece implements BasicPiece {

  protected constructor(private readonly defs: Defs) {
  }

  static create(defs: Defs) {
    return new DefsWrapperPiece(defs);
  }

  getElements() {
    return [];
  }

  getDefs() {
    return this.defs.getDefs();
  }

  setLayer() {
    return this;
  }

  selectLayers() {
    return this;
  }

}

export type PiecePartArg = SVGElement | BasicPiece | Defs;
export type RestPieceCreateArgs = OrArrayRest<PiecePartArg | undefined>;

export type OptMargin = {
  margin?: PartialViewBoxMargin,
};

export interface PieceFunc<Args extends unknown[] = []> {
  (piece: Piece, ...args: Args): Piece;
}

export class Piece extends AbstractTransformableTo<Piece>
  implements BasicPiece, Layerable<Piece> {

  protected boundingBox?: ViewBox;

  protected constructor(
    protected readonly parts: readonly BasicPiece[],
    protected readonly tf: Transform,
    protected readonly layer: OptionalLayerName,
    protected readonly defs: readonly SVGElement[],
    protected readonly attributes: Attributes,
    protected readonly boundingBoxPiece: Piece | undefined,
  ) {
    super();
  }

  static readonly EMPTY = Piece.create();

  static create(...parts: RestPieceCreateArgs): Piece {
    return new Piece(
      flattenFilter(parts).map(part =>
        part instanceof SVGElement ? SVGElementWrapperPiece.create(part) :
          isBasicPiece(part) ? part : DefsWrapperPiece.create(part),
      ),
      Tf, NO_LAYER, [], {}, undefined);
  }

  static parse(svgElements: string) {
    return Piece.create(parseSVG(svgElements));
  }

  static createElement({
    tagName,
    attributes = {},
    children = [],
  }: {
    tagName: keyof SVGElementTagNameMap,
    attributes?: Attributes,
    children?: OrArray<PiecePartArg | string | undefined>,
  }) {
    const childPieces = [];
    const defs = [];
    for (const child of flatten(children))
      if (isBasicPiece(child)) {
        childPieces.push(...child.getElements());
        if (child.getDefs)
          defs.push(...child.getDefs());
      } else if (isDefs(child))
        defs.push(...child.getDefs());
      else
        childPieces.push(child);
    return Piece.create(createElement({
      tagName,
      attributes,
      children: childPieces,
    })).addDefs(defs);
  }

  static createDefs(...defs: RestPieceCreateArgs): Defs {
    return Piece.EMPTY.addDefs(...defs);
  }

  add(...parts: RestPieceCreateArgs) {
    const flatParts = flattenFilter(parts)
    if (!flatParts.length)
      return this;
    return Piece.create(this, flatParts);
  }

  addDefs(...defs: RestPieceCreateArgs) {
    const flatDefs = flattenFilter(defs);
    if (!flatDefs.length)
      return this;
    const defsPiece = Piece.create(flatDefs);
    return new Piece(
      this.parts, this.tf, this.layer, [
      ...this.defs,
      ...defsPiece.getDefs(),
      ...defsPiece.getElements(),
    ], this.attributes, this.boundingBoxPiece);
  }

  setAttributes(attributes: Attributes) {
    if (!Object.keys(attributes).length)
      return this;
    return new Piece(
      this.parts, this.tf, this.layer, this.defs, {...this.attributes, ...attributes},
      this.boundingBoxPiece);
  }

  transform(tf: Transform) {
    return new Piece(
      this.parts, this.tf.transform(tf), this.layer, this.defs, this.attributes,
      this.boundingBoxPiece);
  }

  then<Args extends unknown[]>(func: PieceFunc<Args>, ...args: Args) {
    return func(this, ...args);
  }

  asDefs() {
    return Piece.createDefs(this);
  }

  asDefTool(id = generateId()) {
    return DefTool.create(this.setAttributes({id}).asDefs(), id);
  }

  useDefTool(defTool: DefTool, attributeName: OrArray<string>, refBy?: RefBy): Piece;
  useDefTool(defTool: AttributesDefTool): Piece;
  useDefTool(...args: [DefTool, OrArray<string>, RefBy?] | [AttributesDefTool]) {
    let attrDefTools;
    if (args.length === 1)
      [attrDefTools] = args;
    else {
      const [defTools, attributeName, refBy] = args;
      attrDefTools = defTools.useByAttribute(attributeName, refBy);
    }
    return this.setAttributes(attrDefTools.asAttributes()).addDefs(attrDefTools);
  }

  setLayer(layer: OptionalLayerName) {
    return new Piece(this.parts, this.tf, layer, this.defs, this.attributes,
      this.boundingBoxPiece);
  }

  selectLayers(...layers: OrArrayRest<OptionalLayerName>): Piece {
    if (this.layer === NO_LAYER)
      return new Piece(
        this.parts.map(part => part.selectLayers(...layers)),
        this.tf, NO_LAYER, [], this.attributes,
        this.boundingBoxPiece);
    if (flatten(layers).includes(this.layer))
      return this;
    return Piece.EMPTY;
  }

  getElements() {
    return this.withTransformAndAttributes(this.parts.flatMap(part => part.getElements()));
  }

  getBoundingBoxElements(): SVGElement[] {
    return this.withTransformAndAttributes(this.boundingBoxPiece ?
      this.boundingBoxPiece.getBoundingBoxElements() :
      this.parts.flatMap(part =>
        part.getBoundingBoxElements ? part.getBoundingBoxElements() : part.getElements()));
  }

  private withTransformAndAttributes(children: SVGElement[]): SVGElement[] {
    if (!children.length)
      return [];
    const attributes = {
      ...this.attributes,
      ...this.tf.asAttributes(),
    };
    if (Object.values(attributes).every(value => value === undefined))
      return children;
    if (children.length === 1) {
      const [child] = children;
      const childAttributeNames = new Set(child.getAttributeNames());
      if (Object.keys(attributes).every(key => !childAttributeNames.has(key))) {
        const childClone = cloneElement(child);
        setAttributes(childClone, attributes);
        return [childClone];
      }
    }
    return [createElement({
      tagName: 'g',
      attributes,
      children,
    })];
  }

  getDefs() {
    return [
      ...this.defs,
      ...this.parts.flatMap(part => part.getDefs ? part.getDefs() : []),
    ]
  }

  getDefsElement() {
    const defs = this.getDefs();
    if (!defs.length)
      return undefined;
    return createElement({
      tagName: "defs",
      children: uniqueElements(defs).map(cloneElement),
    });
  }

  asG(attributes: Attributes = {}) {
    return createElement({
      tagName: "g",
      attributes,
      children: this.getElements(),
    });
  }

  wrapInG(attributes: Attributes = {}) {
    return Piece.create(this.asG(attributes)).addDefs(this.getDefs());
  }

  getBoundingBox(margin?: PartialViewBoxMargin): ViewBox {
    if (!this.boundingBox) {
      const defs = this.getDefsElement();
      this.boundingBox =
        getElementsBoundingBox([...defs ? [defs] : [], ...this.getBoundingBoxElements()]);
    }
    return extendViewBox(this.boundingBox, margin);
  }

  setBoundingBox(boundingBox: SVGElement | BasicPiece | PartialViewBox): Piece {
    if (!this.tf.svgTransform)
      return new Piece(this.parts, this.tf, this.layer, this.defs, this.attributes,
        (boundingBox instanceof SVGElement) || isBasicPiece(boundingBox) ?
          Piece.create(boundingBox) :
          figures.rectangle(boundingBox));
    return Piece.create(this).setBoundingBox(boundingBox);
  }

  mirrorX() {
    return gather(this, this.flipX());
  }

  mirrorY() {
    return gather(this, this.flipY());
  }

  mirrorXY() {
    return this.mirrorX().mirrorY();
  }

  normalise(params: NormaliseArgs, {margin}: OptMargin = {}) {
    return this.transform(getNormaliseTransform(this.getBoundingBox(margin), params));
  }

  center() {
    return this.normalise("center");
  }

  centerIn(target: PartialViewBox, marginParams?: OptMargin) {
    return this.normalise({target, align: "center"}, marginParams)
  }

  centerAndFitTo1By1(marginParams?: OptMargin) {
    return this.centerIn({centered: true}, marginParams);
  }

  pad(padding: PartialViewBoxMargin, align?: PartialBoxAlignment) {
    return this.normalise({
      target: extendViewBox(
        this.getBoundingBox(),
        multiplyMargin(viewBoxMarginFromPartial(padding), -1),
      ),
      align,
    });
  }

  toString() {
    return transformedToString(
      `[${this.parts.join(", ")}]` + inLayerString(this.layer), this.tf);
  }

}

export function gather(...parts: RestPieceCreateArgs) {
  return Piece.create(...parts);
}
