# Commands

This directory contains bash files for performing common actions.

_Note:_ Run the commands directly from the main repository directory, e.g.
`$ cmds/type-check`.

## Starting the Viewer

The [_cmds/viewer_](viewer) file by default runs
[_cmds/demos-viewer_](demos-viewer), which starts the Viewer with the demo
projects (plus and any custom projects that have been added to
[_viewer.ts_](../src/viewer/viewer.ts)).

### Custom projects

To start the viewer with custom projects defined separately in a directory, for
example _src/my_projects_, run `cmds/set-up-custom-projects-dir my_projects`
(works on linux or [WSL](https://learn.microsoft.com/en-us/windows/wsl/)). See
[Custom projects in a separate repository](../wiki/installation_and_usage.md#in-a-separate-repository)
for more information.

## Type-checking and linting

The Viewer process does not perform type-checking or linting, so run these
checks separately:

- [_cmds/type-check_](type-check) type-checks all the TypeScript sources,
  including the projects.
- [_cmds/lint_](lint) lints the sources (see the `lint` section of
  [_deno.jsonc_](../deno.jsonc) for the configuration).

Both commands use [Deno](https://deno.com/), which is included in the Docker
image, and are also available as the _Type-check_ and _Lint_ tasks in VS Code.

## Rendering without the Viewer

[_cmds/render_](render) renders sections of the Viewer to files, in a headless
browser, which is useful for scripts and coding agents. It uses the same entry
point as [_cmds/viewer_](viewer), except that the entry point cannot use
top-level `await`. It needs [Deno](https://deno.com/) and esbuild, plus the
browser downloaded once to the git-ignored _.tools_ directory by
[_cmds/render-setup_](render-setup), which needs `curl` and `unzip`. Set the
`TP_VECTOR_CHROME` environment variable to use a different browser. The Docker
image does not cover this, so run these commands outside of it.

Each sheet produces these files in the git-ignored _.render_ directory:

- A PNG with the preview. `--runs`, `--crop` and `--grid` restrict it to some
  runs and to an area, and draw a labelled grid in the sheet units.
- The laser SVG.
- A JSON report with the sheet coordinates of the closed and open outlines in
  each run. The command also prints warnings, e.g. about near-miss gaps in
  cuts, double cuts, and fonts which were not embedded.

When a PNG already exists, the new one is compared to it, and the differences
are shown in a _.diff.png_ file. See `cmds/render --help` for all the options.

## Generating the documentation

[_cmds/gen-docs_](gen-docs) generates the API documentation in the _docs_
directory, using [TypeDoc](https://typedoc.org/).
