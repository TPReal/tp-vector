import {OrArrayRest} from './util.ts';

export type LayerName = string;
export const NO_LAYER = undefined;
export type OptionalLayerName = LayerName | typeof NO_LAYER;

export interface Layerable<T extends Layerable<T>> {

  setLayer(layer: OptionalLayerName): T;
  selectLayers(...layers: OrArrayRest<OptionalLayerName>): T;

}

export function inLayerString(layer: OptionalLayerName) {
  return layer === undefined ? `` : `@${JSON.stringify(layer)}`;
}
