# Layers and runs

This document describes how [Piece](../src/pieces.ts)s are assigned to laser
runs.

## [Layers](../src/layers.ts)

Each Piece is either assigned to a single layer, using the `setLayer` method, or
not assigned to a layer (the default).

Note that Piece, just like all the other classes in TPVector, is immutable (see
the [Immutability](immutability.md) document), so `myPiece` and
`myPiece.setLayer("layer1")` are two different objects: the first one is not
assigned to a layer (unless `setLayer` was called on it (or some of its parts)
before), and the second one assigned fully to `"layer1"`.

The meaning of the layers is defined by the developer, any string can be used as
a layer name. There are, however, some conventions:

- In a simple, one-sided project, there is a simple default setting in place,
  when the [runs](#runs) are not specified explicitly:
  - Pieces on the `"cut"` layer, or not assigned to a layer, are part of a
    cutting run.
  - Pieces on the `"print"` layer are assigned to a print (engrave) run.
- In a more complicated project, the layers can be named after the parts of the
  project they represent, for example `"labels_front"`, `"labels_back"`,
  `"edges_deep_engrave"`, `"cut"`. In this case you need to specify the runs
  (see below).

Note that if there are Pieces assigned to a layer, but the layer is not a part
of any run, these Pieces will be completely skipped, both in the preview and in
the laser SVG.

## Runs

A run is a collection of objects that will be sent to the laser with the same
cutting/engraving options.

The list of runs is one of the parameters when creating a
[Sheet](../src/sheet.ts) object.

- A simple one-sided project has two runs: one for printing, and the other for
  cutting. This is the default if the runs are not specified.
- A more complicated project can have more runs, for example printing with
  different laser settings (speed and power) or scoring (cutting, but with
  higher speed, so that the material is not cut all the way through).
- A dual-sided project will have separate layers for printing and scoring on the
  back side, as well as the reversing frame - see the
  [Dual-sided projects](dual_sided.md) document for more information.

Each run has a list of layers that belong to that run. A run can have multiple
layers, and a layer can belong to multiple runs.

A run does not define the actual laser settings. This should be done in the
laser software after loading the SVG with the runs. A run only declares its type
as either `"cut"` or `"print"`.

The default runs, when not specified, are these:

<!-- deno-fmt-ignore -->
```ts
runs: [
  {type: "cut", id: "cut", layers: ["cut", NO_LAYER], side: "front"},
  {type: "print", id: "print", layers: ["print"], side: "front"},
]
```

Note that this is equivalent to just `runs: [{type: "print"}, {type: "cut"}]`,
because:

- `id` is by default equal to `type`,
- `layers` is by default equal to `id === "cut" ? [id, NO_LAYER] : [id]`,
- `side` is by default `"front"`.

<details><summary>A more complex example</summary>

A complex dual-sided project could use the following definition (defaults in
comment):

<!-- deno-fmt-ignore -->
```ts
runs: [
  // Two layers to deep-engrave on the back:
  {
    type: "print",
    side: "back",
    id: "deep_back",
    layers: ["groove_back", "deep_labels_back"],
  },
  // A regular engrave on the back:
  {
    type: "print",
    side: "back",
    id: "print_back",
    /* layers: ["print_back"], */
  },
  // A score on the back:
  {
    type: "cut",
    side: "back",
    id: "score_back",
    /* layers: ["score_back"], */
  },
  // A deep-engrave labels on the front:
  {
    type: "print",
    /* side: "front", */
    id: "deep_labels_front",
    /* layers: ["deep_labels_front"], */
  },
  // A regular engrave on the front:
  {
    type: "print",
    /* side: "front", */
    /* id: "print", */
    /* layers: ["print"], */
  },
  // The regular cut, done on the front:
  {
    type: "cut",
    /* side: "front", */
    /* id: "cut", */
    /* layers: ["cut", NO_LAYER], */
  },
]
```

</details>

### Attributes

A Piece's method `setAttributes` can be used to set any
[SVG attributes](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute) on
an element, but there are defaults for each generated element, based on the run
the element is part of.

- Cut runs:
  - `fill="none"`
  - For the preview:
    - `stroke` (line color): some dark color, different for each cut run
    - `stroke-width="1"` and `vector-effect="non-scaling-stroke"` (see
      [vector-effect](https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/vector-effect)),
      to ensure the line width is 1 regardless of the scale and zoom
  - For the laser:
    - `stroke="black"`
    - `stroke-width="0"`, this means that the cuts are not visible when the
      laser SVG is opened in a browser, but laser cutter software interprets
      this correctly
- Print runs:
  - `stroke-width="0"` to disable stroke; to reënable it, just call
    `.setAttributes({strokeWidth})` with the desired width
  - For the preview:
    - `fill`: some color, different for each print run
    - `stroke`: the same color as fill (but note that stroke is disabled by
      width)
  - For the laser:
    - `fill="black"`
    - `stroke="black"` (same note as above)

These default attributes can be overridden in the run
[options](../src/options.ts) passed when creating the Sheet.
