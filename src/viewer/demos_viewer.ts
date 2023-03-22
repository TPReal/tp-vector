import * as calibration from '../calibration/index.ts';
import * as coins from '../demos/coins.ts';
import * as imagesDemo from '../demos/images_demo.ts';
import * as jigsawPuzzle from '../demos/jigsaw_puzzle.ts';
import * as normaliseExplainer from '../demos/normalise_explainer.ts';
import * as tpVectorIcon from '../demos/tpvector_icon.ts';
import * as transformExplainer from '../demos/transform_explainer.ts';
import * as turtleDemo from '../demos/turtle_demo.ts';
import {Viewer} from './viewer_tools.ts';

export const DEMOS_VIEWER = Viewer.create()

  // TPVector icon
  .add(tpVectorIcon)

  // Demos
  .add(imagesDemo)
  .add(coins)
  .add(jigsawPuzzle)
  .add(turtleDemo)

  // Calibration utilities
  .add(calibration.kerf, {thickness: 3})
  .add(calibration.printPosCorrection)

  // Explainers
  .add(transformExplainer.getSection)
  .add(normaliseExplainer.getSection)
