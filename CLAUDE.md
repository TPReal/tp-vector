# TPVector

A TypeScript library generating SVG files for laser cutters. See [README.md](README.md) and
[wiki/](wiki/). Commands live in [cmds/](cmds/README.md), and run from the repository root.

## Seeing the results

A design can only be judged by looking at it, so check every change with `cmds/render`, which
needs `cmds/render-setup` once, or after a `Browser not found` error:

1. `cmds/render <section>` prints the sheets, their runs and warnings, and writes PNG, SVG and
   JSON files to _.render/_. Open the PNG with the Read tool.
2. `--crop x,y,w,h --grid <step>` zooms in, with a labelled grid. Use it for anything small, such
   as tabs, slots and kerf. The sheet-sized PNG does not show these reliably.
3. For a measurement, use the JSON report. Its `loops` are in sheet units, with absolute positions,
   unlike the nested transforms and relative paths of the SVG.
4. Rendering again writes a _.diff.png_ showing what changed since the previous render. Use
   `cmds/render --all` before and after changing library code, to catch side effects.

A clean run is not proof that the output is right. Look at the image, and read the warnings.
Sections are named by `cmds/render --list`, and the Viewer's global options apply; `--preset`
selects a preset.

## Checks

`cmds/type-check` and `cmds/lint` cover also any custom projects under _src_, which may be a
separate repository, so report errors there rather than fixing them along with library changes.
