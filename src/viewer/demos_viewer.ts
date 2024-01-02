import * as calibration from '../calibration/index.ts';
import * as coins from '../demos/coins.ts';
import * as houseBox from '../demos/house_box.ts';
import * as images from '../demos/images.ts';
import * as jigsawPuzzle from '../demos/jigsaw_puzzle.ts';
import * as normaliseExplainer from '../demos/normalise_explainer.ts';
import * as solver from '../demos/solver.ts';
import * as tabsAndSlots from '../demos/tabs_and_slots.ts';
import * as tpVectorIcon from '../demos/tpvector_icon.ts';
import * as transformExplainer from '../demos/transform_explainer.ts';
import * as turtle from '../demos/turtle.ts';
import {Viewer} from './viewer_tools.ts';

export const DEMOS_VIEWER = Viewer.create()

  // TPVector icon
  .add(tpVectorIcon)

  // Demos
  .add(turtle)
  .add(coins)
  .add(jigsawPuzzle)
  .add(tabsAndSlots)
  .add(houseBox)
  .add(images)
  .add(solver)

  // Calibration utilities
  .addSeparator()
  .add(calibration.kerf, {thickness: 3})
  .add(calibration.printPosCorrection)
  .add(calibration.gradient)

  // Explainers
  .addSeparator()
  .add(transformExplainer)
  .add(normaliseExplainer);
