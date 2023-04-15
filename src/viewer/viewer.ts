import {globalOptions} from 'tp-vector/index.ts';
import {DEMOS_VIEWER} from 'tp-vector/viewer/demos_viewer.ts';
import {installLiveReload, Viewer} from 'tp-vector/viewer/viewer_tools.ts';

// There are two main ways of developing your own projects,
// described in wiki/installation_and_usage.md#custom-projects.

installLiveReload();

globalOptions.modify(
  // Modify the global options to adjust the generated SVG files for the laser cutter software:
  // globalOptions.presets.lightburn(),

  // Set the print pos correction if necessary (see _calibration/print_pos_correction.ts_):
  // {printPosCorrectionMillimeters: [0.0, 0.0]},
);

await Viewer.create()

  // Add your own projects here:
  // .add(myProjectModule)

  // Add the demos at the end.
  .addAll(DEMOS_VIEWER)

  .show();
