import * as calibration from '../calibration/index.ts';
import * as coins from '../demos/coins.ts';
import * as imagesDemo from '../demos/images_demo.ts';
import * as jigsawPuzzle from '../demos/jigsaw_puzzle.ts';
import * as normaliseExplainer from '../demos/normalise_explainer.ts';
import * as tpVectorIcon from '../demos/tpvector_icon.ts';
import * as transformExplainer from '../demos/transform_explainer.ts';
import * as turtleDemo from '../demos/turtle_demo.ts';
import {installLiveReload, Viewer} from './viewer_tools.ts';

installLiveReload();

await Viewer.create()

  .add(tpVectorIcon.SHEET)

  .add(imagesDemo.SHEET)
  .add(coins.SHEET)
  .add(jigsawPuzzle.SHEET)
  .add(turtleDemo.SHEET)

  .add(calibration.kerf.getSheet({thickness: 3}))
  .add(calibration.printPosCorrection.getSheet())

  .add(transformExplainer.getSection())
  .add(normaliseExplainer.getSection())

  .show();
