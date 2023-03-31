import {Point} from './point.ts';
import {Transform} from './transform.ts';

/**
 * Basic methods for transformations.
 * @see https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform
 */
export interface SVGTransformsInterface<R> {
  translate(dx: number, dy?: number): R;
  scale(k: number): R;
  scale(kx: number, ky: number): R;
  rotate(angleDeg: number, center?: Point): R;
  skewX(angleDeg: number): R;
  skewY(angleDeg: number): R;
  matrix(abcdef: [number, number, number, number, number, number]): R;
}

/** Convenience methods for transformations. */
export interface TransformsInterface<R> extends SVGTransformsInterface<R> {

  translateX(dx: number): R;
  translateY(dy: number): R;
  moveUp(dy: number): R;
  moveDown(dy: number): R;
  moveRight(dx: number): R;
  moveLeft(dx: number): R;

  scale(k: number, center?: Point): R;
  scale(kx: number, ky: number, center?: Point): R;
  scaleX(kx: number, centerX?: number): R;
  scaleY(ky: number, centerY?: number): R;
  flipX(centerX?: number): R;
  flipY(centerY?: number): R;
  flipXY(center?: Point): R;
  swapXY(): R;

  rotateRight(angleDeg: number, center?: Point): R;
  rotateRight(center?: Point): R;
  rotateLeft(angleDeg: number, center?: Point): R;
  rotateLeft(center?: Point): R;

  skewX(angleDeg: number, centerX?: number): R;
  skewTopToRight(angleDeg: number, centerY?: number): R;
  skewTopToLeft(angleDeg: number, centerY?: number): R;
  skewBottomToRight(angleDeg: number, centerY?: number): R;
  skewBottomToLeft(angleDeg: number, centerY?: number): R;

  skewY(angleDeg: number, centerY?: number): R;
  skewRightUp(angleDeg: number, centerX?: number): R;
  skewRightDown(angleDeg: number, centerX?: number): R;
  skewLeftUp(angleDeg: number, centerX?: number): R;
  skewLeftDown(angleDeg: number, centerX?: number): R;

}

export interface TransformableTo<R> extends TransformsInterface<R> {

  transform(tf: Transform): R;

}

export abstract class AbstractTransforms<R extends TransformsInterface<R>>
  implements TransformsInterface<R> {

  protected abstract tfData(func: string, args: number[]): R;

  translate(dx: number, dy = 0) {return this.tfData("translate", [dx, dy]);}
  translateX(dx: number) {return this.translate(dx);}
  translateY(dy: number) {return this.translate(0, dy);}
  moveUp(dy: number) {return this.translateY(-dy);}
  moveDown(dy: number) {return this.translateY(dy);}
  moveRight(dx: number) {return this.translateX(dx);}
  moveLeft(dx: number) {return this.translateX(-dx);}

  scale(k: number, center?: Point): R;
  scale(kx: number, ky: number, center?: Point): R;
  scale(...params: [number, Point?] | [number, number, Point?]) {
    const [kx, ky, center] = typeof params[1] === "number" ?
      params as [number, number, Point?] : [params[0], params[0], params[1]];
    if (center) {
      const [dx, dy] = center;
      return this.translate(-dx, -dy).scale(kx, ky).translate(dx, dy);
    }
    return this.tfData("scale", [kx, ky]);
  }
  scaleX(kx: number, centerX?: number) {
    return this.scale(kx, 1, centerX ? [centerX, 0] : undefined);
  }
  scaleY(ky: number, centerY?: number) {
    return this.scale(1, ky, centerY ? [0, centerY] : undefined);
  }
  flipX(centerX?: number) {return this.scaleX(-1, centerX);}
  flipY(centerY?: number) {return this.scaleY(-1, centerY);}
  flipXY(center?: Point) {return this.scale(-1, center);}

  swapXY() {return this.rotateRight().flipX();}

  rotate(angleDeg: number, center?: Point) {
    return this.tfData("rotate", [angleDeg, ...(center || [])]);
  }

  rotateRight(angleDeg: number, center?: Point): R;
  rotateRight(center?: Point): R;
  rotateRight(...params: [number, Point?] | [Point?]) {
    const [angleDeg, center] = typeof params[0] === "number" ?
      params as [number, Point?] : [90, params[0]];
    return this.rotate(angleDeg, center);
  }

  rotateLeft(angleDeg: number, center?: Point): R;
  rotateLeft(center?: Point): R;
  rotateLeft(...params: [number, Point?] | [Point?]) {
    const [angleDeg, center] = typeof params[0] === "number" ?
      params as [number, Point?] : [90, params[0]];
    return this.rotate(-angleDeg, center);
  }

  skewX(angleDeg: number, centerY = 0) {
    if (centerY)
      return this.translateY(-centerY).skewX(angleDeg).translateY(centerY);
    return this.tfData("skewX", [angleDeg]);
  }
  skewTopToRight(angleDeg: number, centerY = 0) {return this.skewX(-angleDeg, centerY);}
  skewTopToLeft(angleDeg: number, centerY = 0) {return this.skewX(angleDeg, centerY);}
  skewBottomToRight(angleDeg: number, centerY = 0) {return this.skewX(angleDeg, centerY);}
  skewBottomToLeft(angleDeg: number, centerY = 0) {return this.skewX(-angleDeg, centerY);}

  skewY(angleDeg: number, centerX = 0) {
    if (centerX)
      return this.translateX(-centerX).skewY(angleDeg).translateX(centerX);
    return this.tfData("skewY", [angleDeg]);
  }
  skewRightUp(angleDeg: number, centerX = 0) {return this.skewY(-angleDeg, centerX);}
  skewRightDown(angleDeg: number, centerX = 0) {return this.skewY(angleDeg, centerX);}
  skewLeftUp(angleDeg: number, centerX = 0) {return this.skewY(angleDeg, centerX);}
  skewLeftDown(angleDeg: number, centerX = 0) {return this.skewY(-angleDeg, centerX);}

  matrix(abcdef: [number, number, number, number, number, number]) {
    return this.tfData("matrix", abcdef);
  }

}

function tfDataToSVGTransform(func: string, args: number[]) {
  const res = `${func}(${args.join(",")})`;
  if (args.some(a => !Number.isFinite(+a)))
    console.warn(`Infinite values in transform: ${res}`);
  return res;
}

/** An object that can be transformed. */
export abstract class AbstractTransformableTo<R extends TransformableTo<R>>
  extends AbstractTransforms<R> implements TransformableTo<R> {

  abstract transform(tf: Transform): R;

  protected tfData(func: string, args: number[]) {
    return this.transform(Transform.fromSVGTransform(tfDataToSVGTransform(func, args)));
  }

}
