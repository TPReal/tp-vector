// TODO: Reconsider.

type Elem = Node | string;
type NoElem = false | null | undefined;
export type ElemArgs = Elem | NoElem | ElemArgsArray;
interface ElemArgsArray extends Array<ElemArgs> {}

export function asNodes(elems: ElemArgs): Node[] {
  if (Array.isArray(elems))
    return elems.flatMap(asNodes);
  if (!elems)
    return [];
  if (typeof elems === "string")
    return [document.createTextNode(elems)];
  return [elems];
}

export interface ElementParams {
  tagName?: string;
  classes?: string[];
  attributes?: Record<string, unknown>;
  children?: ElemArgs;
  assert?: boolean;
}

export function element(params: ElementParams & {assert: true}): HTMLElement;
export function element(params: ElementParams): HTMLElement | undefined;
export function element({
  tagName = "span",
  classes = [],
  attributes = {},
  children = [],
  assert = false,
}: ElementParams) {
  const nodes = asNodes(children);
  if (!nodes.length) {
    if (assert)
      throw new Error(`No element to create, children: ${JSON.stringify(children)}`);
    return undefined;
  }
  const element = document.createElement(tagName);
  for (const [attribute, value] of Object.entries(attributes)) {
    if (value !== undefined)
      element.setAttribute(attribute, String(value));
  }
  for (const cl of classes)
    element.classList.add(cl);
  for (const childNode of nodes)
    element.appendChild(childNode);
  return element;
}

export function joinElements(elems: ElemArgs, {pre, glue, post}: {
  pre?: ElemArgs,
  glue?: ElemArgs,
  post?: ElemArgs,
}): Node[] {
  const nodes = asNodes(elems);
  if (!nodes.length)
    return [];
  const result = asNodes(pre);
  let first = false;
  for (const node of nodes) {
    if (first)
      first = false;
    else
      result.push(...asNodes(glue));
    result.push(node);
  }
  result.push(...asNodes(post));
  return result;
}
