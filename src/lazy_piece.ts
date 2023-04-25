import {LayerName, OptionalLayerName} from './layers.ts';
import {BasicPiece, DefaultPiece, Piece, PiecePartArg} from './pieces.ts';
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

/**
 * A superclass for custom classes that wants to extend Piece in a lazy way, i.e. so that
 * the actual geometry is only created on demand. This is useful for builder-like classes if
 * building the SVG geometry after each build step would be expensive.
 *
 * For a usage example, see the Path class.
 */
export abstract class SimpleLazyPiece extends DefaultPiece {

  protected constructor(getPiece: LazyPieceArg) {
    super(LazyWrapperPiece.create(getPiece));
  }

}
