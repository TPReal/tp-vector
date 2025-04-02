import {DEMOS_VIEWER} from './demos_viewer.ts';
import {Viewer} from './viewer_tools.ts';

// There are two main ways of developing your own projects,
// described in wiki/installation_and_usage.md#custom-projects.

Viewer.create({
  globalOpts: [
    // Modify the global options to adjust the generated SVG files for the laser cutter software:
    // globalOptions.presets.LightBurn(),

    // Set the print pos correction if necessary (see _calibration/print_pos_correction.ts_):
    // {printPosCorrectionMillimeters: [0.0, 0.0]},
  ],
})

  // Add your own projects here:
  // .add(myProjectModule)

  // Add the demos at the end.
  .addAll(DEMOS_VIEWER)

  .show();
