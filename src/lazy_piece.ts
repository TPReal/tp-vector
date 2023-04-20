import {LayerName, NO_LAYER, OptionalLayerName} from './layers.ts';
import {BasicPiece, Piece, PiecePartArg, RestPieceCreateArgs} from './pieces.ts';
import {Tf} from './transform.ts';
import {OrArray, OrArrayRest} from './util.ts';

type LazyPieceArg = OrArray<PiecePartArg | undefined> | (() => OrArray<PiecePartArg | undefined>);

/**
 * A BasicPiece that delegates its methods to a provided element or a function returning an element.
 */
class LazyWrapperPiece implements BasicPiece {

  protected constructor(private readonly getPiece: LazyPieceArg) {}

  static create(getPiece: LazyPieceArg) {
    return new LazyWrapperPiece(getPiece);
  }

  private getWrapped() {
    return Piece.create(typeof this.getPiece === "function" ? this.getPiece() : this.getPiece);
  }

  getElements() {
    return this.getWrapped().getElements();
  }

  getDefs() {
    return this.getWrapped().getDefs();
  }

  setLayer(layer: LayerName) {
    return this.getWrapped().setLayer(layer);
  }

  getLayers() {
    return this.getWrapped().getLayers();
  }

  selectLayers(...layers: OrArrayRest<OptionalLayerName>) {
    return this.getWrapped().selectLayers(...layers);
  }

}

export abstract class SimpleLazyPiece extends Piece {

  protected constructor(getPiece: LazyPieceArg) {
    super([LazyWrapperPiece.create(getPiece)], Tf, NO_LAYER, [], {}, undefined);
  }

}

/**
 * Creates a superclass for a custom class that wants to extend Piece in a lazy way, i.e. so that
 * the actual geometry is only created on demand. This is useful for builder-like classes if
 * building the SVG geometry after each build step would be expensive.
 *
 * For example usage, see the Path class.
 */
export function lazyPiece<ThisClass, CreateArgs extends unknown[] = [never]>() {
  abstract class LazyPiece extends SimpleLazyPiece {

    static create(...args: CreateArgs): ThisClass;
    static create(...args: RestPieceCreateArgs): never;
    static create(...args: unknown[]) {
      return this.createInternal(...args as CreateArgs);
    }

    protected static createInternal(..._args: CreateArgs): ThisClass {
      throw new Error(`Implement static createInternal in ${this.name}`);
    }

  }
  return LazyPiece;
}
