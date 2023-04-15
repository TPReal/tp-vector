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
[Custom projects in a separate repository](../wiki/installation_and_usage.md#custom-projects-2)
for more information.
