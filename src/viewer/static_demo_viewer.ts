import {DEMOS_VIEWER} from './demos_viewer.ts';
import {Viewer} from './viewer_tools.ts';

// The static demo viewer.

(async () => {
  await Viewer.create().addAll(DEMOS_VIEWER).show();
})();
