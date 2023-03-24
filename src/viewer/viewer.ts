import {globalOptions} from '../index.ts';
import {DEMOS_VIEWER} from './demos_viewer.ts';
import {installLiveReload, Viewer} from './viewer_tools.ts';

installLiveReload();

globalOptions.modify(
  // Modify the global options to adjust the generated SVG files for the laser cutter software:
  // globalOptions.presets.lightburn(),

  // Set the print pos correction, if necessary (see _calibration/print_pos_correction.ts_):
  // {printPosCorrectionMillimeters: [0.0, 0.0]},
);

await Viewer.create()

  // Add your own projects here:
  // .add(myProjectModule)

  // Add the demos at the end.
  .addAll(DEMOS_VIEWER)

  .show();
