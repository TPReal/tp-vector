import {NO_LAYER, OptionalLayerName} from "./layers.ts";
import {BasicPiece, Piece, PiecePartArg, RestPieceCreateArgs} from "./pieces.ts";
import {Tf} from "./transform.ts";
import {OrArray, OrArrayRest} from "./util.ts";

type LazyPieceArg = OrArray<PiecePartArg | undefined> | (() => OrArray<PiecePartArg | undefined>);

class LazyWrapperPiece implements BasicPiece {

  protected constructor(private readonly getPiece: LazyPieceArg) {
  }

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

  setLayer(layer: OptionalLayerName) {
    return this.getWrapped().setLayer(layer);
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
