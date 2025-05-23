import * as globalOptions from '../global_options.ts';
import {DEMOS_VIEWER} from './demos_viewer.ts';
import {Viewer} from './viewer_tools.ts';

Viewer.create({
  globalOpts: [
    globalOptions.presets.LightBurn(),
    {
      cutRunsStrokeWidth: 1,
      fontFallbackToNotDef: false,
    },
  ],
})
  .addAll(DEMOS_VIEWER)
  .show();
