import {Attributes, setAttributes} from './elements.ts';
import {AbstractTransformableTo} from './transformable.ts';

export class Transform extends AbstractTransformableTo<Transform> {

  protected constructor(readonly svgTransform: string) {
    super();
  }

  static fromSVGTransform(svgTransform: string) {
    return new Transform(svgTransform);
  }

  static readonly IDENTITY = new Transform("");

  transform(tf: Transform) {
    return new Transform([tf.svgTransform, this.svgTransform].filter(Boolean).join(" "));
  }

  asAttributes(): Attributes {
    return {transform: this.svgTransform || undefined};
  }

  toString() {
    return `transform="${this.svgTransform}"`;
  }

}

/**
 * A convenience tool for creating transforms. Usage example:
 *
 *     Tf.rotate(20).translateX(10)
 */
export const Tf = Transform.IDENTITY;

export function transformedToString(object: unknown, tf: Transform) {
  if (tf.svgTransform)
    return `${tf.svgTransform}*${object}`;
  return `${object}`;
}

function simplifyTf<
  A extends string,
  S extends SVGElement & Record<A, SVGAnimatedTransformList>,
>(
  element: SVGElement,
  subclass: {prototype: S, new(): S},
  attribute: A,
) {
  if (element instanceof subclass) {
    const tfList = element[attribute].baseVal;
    if (tfList.length > 1) {
      const matrix = tfList.consolidate()?.matrix;
      if (matrix)
        setAttributes(element, {
          [attribute]: Tf.matrix([
            matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f,
          ]).svgTransform,
        });
    }
  }

}

export function simplifyTransform(element: SVGElement) {
  simplifyTf(element, SVGGradientElement, "gradientTransform");
  simplifyTf(element, SVGGraphicsElement, "transform");
  return element;
}
