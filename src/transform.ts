import {Attributes} from './elements.ts';
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

export const Tf = Transform.IDENTITY;

export function transformedToString(object: unknown, tf: Transform) {
  if (tf.svgTransform)
    return `${tf.svgTransform}*${object}`;
  return `${object}`;
}
