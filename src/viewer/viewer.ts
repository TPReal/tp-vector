import {globalOptions} from '../index.ts';

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

globalOptions.modify(
  globalOptions.presets.chrome(),

  // Enable suitable global options to adjust the generated SVG files for
  // the laser cutter software:
  // globalOptions.presets.lightburn(),

  // Enable print pos correction (see _calibration/print_pos_correction.ts_):
  // {printPosCorrectionMillimeters: [0.0, 0.0]},
);

await Viewer.create()

  .add(tpVectorIcon)

  .add(imagesDemo)
  .add(coins)
  .add(jigsawPuzzle)
  .add(turtleDemo)

  .add(calibration.kerf, {thickness: 3})
  .add(calibration.printPosCorrection)

  .add(transformExplainer.getSection)
  .add(normaliseExplainer.getSection)

  .show();
