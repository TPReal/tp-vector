import {getGlobalOptions} from './global_options.ts';
import {OrArray, flattenFilter, roundReasonably} from './util.ts';
import {ViewBox, extendViewBox, fitsInViewBox, viewBoxFromBBox, viewBoxFromPartial, viewBoxToString} from './view_box.ts';

export type AttributeValue = string | number;
/**
 * A mutable mapping specifying the attributes of an element, helpful for constructing the
 * Attributes object.
 * Hyphenated attribute names can be referenced by camelCase.
 */
export type AttributesBuilder = Partial<Record<string, AttributeValue | undefined>>;
/**
 * Definition of the attributes of an element. Undefined value means that the attribute should
 * be cleared on the element.
 * Hyphenated attribute names can be referenced by camelCase.
 */
export type Attributes = Readonly<AttributesBuilder>;

export const SVG_NAMESPACE_URI = "http://www.w3.org/2000/svg";

const NAMESPACES = new Map([
  ["xlink", "http://www.w3.org/1999/xlink"],
  ["xml", "http://www.w3.org/XML/1998/namespace"],
]);

/**
 * A list of all the hyphenated SVG attributes.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute
 */
const HYPHENATED_ATTRIBUTES = ["accent-height", "alignment-baseline", "arabic-form", "baseline-shift", "cap-height", "clip-path", "clip-rule", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "dominant-baseline", "enable-background", "fill-opacity", "fill-rule", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "glyph-name", "glyph-orientation-horizontal", "glyph-orientation-vertical", "horiz-adv-x", "horiz-origin-x", "image-rendering", "letter-spacing", "lighting-color", "marker-end", "marker-mid", "marker-start", "overline-position", "overline-thickness", "panose-1", "paint-order", "pointer-events", "rendering-intent", "shape-rendering", "stop-color", "stop-opacity", "strikethrough-position", "strikethrough-thickness", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke-width", "text-anchor", "text-decoration", "text-rendering", "transform-origin", "underline-position", "underline-thickness", "unicode-bidi", "unicode-range", "units-per-em", "v-alphabetic", "v-hanging", "v-ideographic", "v-mathematical", "vector-effect", "vert-adv-y", "vert-origin-x", "vert-origin-y", "word-spacing", "writing-mode", "x-height"];
const HYPHENATED_ATTRIBUTES_MAP: ReadonlyMap<string, string> = (() => {
  const result = new Map<string, string>();

  function toCamelCase(hyphenated: string) {
    return hyphenated.split("-").map((p, i) =>
      i ? p[0].toUpperCase() + p.slice(1) : p,
    ).join("");
  }

  for (const attr of HYPHENATED_ATTRIBUTES)
    result.set(toCamelCase(attr), attr);
  return result;
})();

export const COMMON_ATTRIBUTES: Attributes = {vectorEffect: "inherit"};

function valueToString(value: AttributeValue) {
  return typeof value === "number" ? roundReasonably(value) : value;
}

const ATTRIBUTES_ALL = "*";
const ATTRIBUTES_SORT_ORDER = ["id", ATTRIBUTES_ALL, "vector-effect"];
const ALL_SORT_ORDER = ATTRIBUTES_SORT_ORDER.indexOf(ATTRIBUTES_ALL);

function getSortOrder(attribute: string) {
  const index = ATTRIBUTES_SORT_ORDER.indexOf(attribute);
  return index < 0 ? ALL_SORT_ORDER : index;
}

function sortAttributes(attributes: Attributes) {
  return Object.entries(attributes).sort(([a,], [b,]) =>
    getSortOrder(a) - getSortOrder(b));
}

/**
 * Sets the specified attributes on the element. Values missing in the attributes are left alone,
 * values set to undefined are cleared.
 */
export function setAttributes(element: SVGElement, attributes: Attributes) {
  for (const [attrib, value] of sortAttributes(attributes)) {
    const attribute = HYPHENATED_ATTRIBUTES_MAP.get(attrib) || attrib;
    const useNS = !/^xmlns(:\w+)?$/.test(attribute);
    if (useNS) {
      const colonPos = attribute.indexOf(":");
      const ns = colonPos > 0 && NAMESPACES.get(attribute.slice(0, colonPos)) || null;
      if (value === undefined)
        element.removeAttributeNS(ns, attribute);
      else
        element.setAttributeNS(ns, attribute, valueToString(value));
    } else {
      if (value === undefined)
        element.removeAttribute(attribute);
      else
        element.setAttribute(attribute, valueToString(value));
    }
    if (getGlobalOptions().quirks?.xlinkHref && attribute === "href")
      setAttributes(element, {"xlink:href": value});
  }
}

export function createElement<TagName extends keyof SVGElementTagNameMap>({
  tagName,
  attributes = {},
  children = [],
}: {
  tagName: TagName,
  attributes?: Attributes,
  children?: OrArray<SVGElement | string | undefined>,
}): SVGElementTagNameMap[TagName] {
  const element = document.createElementNS(SVG_NAMESPACE_URI, tagName);
  setAttributes(element, {
    ...COMMON_ATTRIBUTES,
    ...attributes,
  });
  element.append(...flattenFilter(children));
  return element;
}

export function getDefaultSVGAttributes(): Attributes {
  return {
    xmlns: SVG_NAMESPACE_URI,
    ...getGlobalOptions().quirks?.xlinkHref ?
      {"xmlns:xlink": "http://www.w3.org/1999/xlink"} : undefined,
  };
}

export function createSVG({
  viewBox,
  millimetersPerUnit,
  attributes = {},
  children = [],
  childrenSeparator = true,
}: {
  viewBox: ViewBox | undefined,
  millimetersPerUnit?: number,
  attributes?: Attributes,
  children?: OrArray<SVGElement | string | undefined>,
  childrenSeparator?: boolean,
}): SVGSVGElement {
  return createElement({
    tagName: "svg",
    attributes: {
      ...viewBox && millimetersPerUnit && {
        width: `${roundReasonably(viewBox.width * millimetersPerUnit)}mm`,
        height: `${roundReasonably(viewBox.height * millimetersPerUnit)}mm`,
      },
      ...getDefaultSVGAttributes(),
      viewBox: viewBox && viewBoxToString(viewBox),
      ...attributes,
    },
    children: childrenSeparator ?
      [...flattenFilter(children).flatMap(c => ["\n\n", c]), "\n\n"] :
      children,
  });
}

export function cloneElement<E extends SVGElement>(element: E): E {
  return element.cloneNode(true) as E;
}

export function uniqueElements<E extends SVGElement>(elements: readonly E[]) {
  function getKey(e: E) {
    return JSON.stringify([
      e.tagName,
      e.id,
      e.getAttributeNames(),
    ]);
  }
  const byKey = new Map<string, E[]>();
  for (const element of new Set(elements)) {
    const key = getKey(element);
    const arr = byKey.get(key) || [];
    byKey.set(key, arr);
    arr.push(element);
  }
  const result = [];
  for (const elems of byKey.values())
    if (elems.length === 1)
      result.push(elems[0]);
    else {
      const outerHTMLs = new Set<string>();
      for (const elem of elems) {
        const {outerHTML} = elem;
        if (!outerHTMLs.has(outerHTML)) {
          outerHTMLs.add(outerHTML);
          result.push(elem);
        }
      }
    }
  return result;
}

/** Parameters used when measuring the bounding box of elements. */
const ELEMENTS_BOUNDING_BOX_PARAMS = {
  /**
   * The maximum number of times the elements are measured, with the view box of the SVG element
   * adjusted after each measurement.
   */
  maxMeasures: 3,
  minSizeCoeff: 0.1,
} as const;

/**
 * Cached measured bounding box of the last measured element, used to heuristically speed up
 * consequent measures.
 */
let elementsBoundingBoxInitialViewBox = viewBoxFromPartial({centered: true, width: 10, height: 10});

let svgForGetBoundingBox: SVGSVGElement | undefined;

/**
 * Calculates the bounding box of the specified elements. It does take into account the transform
 * on these elements (but not on their parent elements), which is different from `getBBox()`.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getBBox
 */
export function getElementsBoundingBox(elements: readonly SVGElement[]) {
  let viewBox = elementsBoundingBoxInitialViewBox;
  let svg = svgForGetBoundingBox;
  if (svg) {
    while (svg.firstChild)
      svg.lastChild?.remove();
    for (const element of elements)
      svg.append(element);
  } else {
    svg = createSVG({
      viewBox,
      children: elements,
    });
    svgForGetBoundingBox = svg;
  }
  document.body.append(svg);
  try {
    let boundingBox = viewBoxFromBBox(svg);
    let numMeasures = 1;
    while (
      numMeasures < ELEMENTS_BOUNDING_BOX_PARAMS.maxMeasures && (
        boundingBox.width < ELEMENTS_BOUNDING_BOX_PARAMS.minSizeCoeff * viewBox.width ||
        boundingBox.height < ELEMENTS_BOUNDING_BOX_PARAMS.minSizeCoeff * viewBox.height ||
        !fitsInViewBox({boundingBox, viewBox}))) {
      viewBox = extendViewBox(boundingBox, {
        x: boundingBox.width / 2,
        y: boundingBox.height / 2,
      });
      setAttributes(svg, {viewBox: viewBoxToString(viewBox)});
      boundingBox = viewBoxFromBBox(svg);
      numMeasures++;
    }
    elementsBoundingBoxInitialViewBox = viewBox;
    return boundingBox;
  } finally {
    svg.remove();
  }
}

const utilSVG = createSVG({viewBox: viewBoxFromPartial()});

/**
 * Executes the function on a reusable `<svg>` element appended to body.
 * The `<svg>` is then removed.
 */
export function withUtilSVG<R>(func: (svg: SVGSVGElement) => R) {
  try {
    document.body.append(utilSVG);
    return func(utilSVG);
  } finally {
    utilSVG.remove();
  }
}
