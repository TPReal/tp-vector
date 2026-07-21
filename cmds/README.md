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

## Generating the documentation

[_cmds/gen-docs_](gen-docs) generates the API documentation in the _docs_
directory, using [TypeDoc](https://typedoc.org/).
