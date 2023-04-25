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

export function simplifyTransform(element: SVGElement) {
  if (element instanceof SVGGraphicsElement) {
    const tfList = element.transform.baseVal;
    if (tfList.length > 1) {
      const matrix = tfList.consolidate()?.matrix;
      if (matrix)
        setAttributes(element, Tf.matrix([
          matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f,
        ]).asAttributes());
    }
  }
  return element;
}
