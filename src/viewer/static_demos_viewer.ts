import {DEMOS_VIEWER} from './demos_viewer.ts';
import {Viewer} from './viewer_tools.ts';

// The static demos viewer. It is used to create a pre-compiled live demo.
// It uses IIFE to allow compiling into a non-module JS file,
// because of some limitations of the HTML viewer currently used.

(async () => {
  await Viewer.create().addAll(DEMOS_VIEWER).show();
})();
