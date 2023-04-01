import {OrArrayRest} from './util.ts';

export type LayerName = string;
/** No layer. Not assigning to any layer is the same as assigning to `NO_LAYER`. */
export const NO_LAYER = undefined;
export type OptionalLayerName = LayerName | typeof NO_LAYER;

export interface Layerable<T extends Layerable<T>> {

  /**
   * Assigns this object and all of its parts to the specified layer.
   * Any previous assignment is ignored.
   */
  setLayer(layer: LayerName): T;

  /** Returns all the layers (optionally including `NO_LAYER`) present in this object. */
  getLayers(): ReadonlySet<OptionalLayerName>;

  /**
   * Returns a subset of this object that is assigned to any of the specified layers.
   * If `NO_LAYER` is specified, includes any parts not assigned to any layer.
   *
   * If this object is assigned directly (using `setLayer`) to one of the specified layers, then
   * this object is returned with all of its parts included. If this object is assigned directly
   * to some different layer then empty object is returned. If this object is not assigned directly
   * to any layer (or assigned to `NO_LAYER`), selection recurses into its parts.
   */
  selectLayers(...layers: OrArrayRest<OptionalLayerName>): T;

}

export function inLayerString(layer: OptionalLayerName) {
  return layer === undefined ? `` : `@${JSON.stringify(layer)}`;
}
