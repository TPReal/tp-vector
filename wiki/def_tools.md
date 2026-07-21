# Clipping, masking and gradients

This document describes the def tools, defined in
[def_tools.ts](../src/def_tools.ts) and [def_tool.ts](../src/def_tool.ts). A def
tool represents elements that go into the `<defs>` section of the generated SVG
(like `<clipPath>`, `<mask>` or `<linearGradient>`), together with the
information on how a [Piece](../src/pieces.ts) should reference them.

See also the
[Clipping, masking, gradients](../README.md#clipping-masking-gradients) section
of the README for complete runnable examples with images.

## Using def tools

There are two kinds of def tools:

- An `AttributesDefTool` knows which attributes of the Piece should reference
  it. This is the case for a clip path (referenced by the `clip-path` attribute)
  and a mask (referenced by the `mask` attribute). Usage:

  <!-- deno-fmt-ignore -->

  ```ts
  myPiece.useDefTool(createClipPath({...}))
  myPiece.useDefTool(Mask.incl(...))
  ```

- A `GenericDefTool` can be referenced from any attribute, so the attribute
  name(s) must be specified. This is the case for gradients, which can act
  either as fill or as stroke. Usage:

  <!-- deno-fmt-ignore -->

  ```ts
  myPiece.useDefTool(createLinearGradient({...}), "fill")
  ```

Any Piece can also be turned into a GenericDefTool using
`myPiece.asDefTool(id)`, for referencing it from arbitrary attributes.

Note that the definitions of a def tool are included in the generated SVG only
once, even if the def tool is used by many Pieces, or the Pieces using it are
repeated many times (e.g. using the [layouts](../src/layouts.ts) functions). For
this to work, the same def tool object needs to be reused, as opposed to
creating multiple identical def tools.

## Clip paths

A clip path restricts the painting region of a Piece to the region defined by
the specified shapes, with a hard edge:

<!-- deno-fmt-ignore -->

```ts
myPiece.useDefTool(
  createClipPath(figures.rectangle({ centered: true, width: 3, height: 1 })),
);
```

The shapes use the same coordinates as the clipped Piece.

See
[clipPath](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/clipPath)
for more information.

## Masks

A mask controls the visibility of a Piece per-pixel, based on the luminance of
the mask contents: where the mask is white, the Piece is visible, where it's
black (or outside of the mask contents), the Piece is hidden, and intermediate
luminance values result in partial visibility. In a print (engrave) layer,
partial visibility means a lighter shade, and consequently lower laser power.

Masking does not work for cut layers, because the laser cutter software typically
does not support it.

Just like a clip path, the mask contents use the same coordinates as the masked
Piece.

The `Mask` class offers helpers that take care of the white and black colors:

- `Mask.incl(piece)` includes the region covered by the piece (paints the piece
  white in the mask contents).
- `Mask.excl(piece)` excludes the region covered by the piece (paints it black
  over an implicit huge white rectangle).
- The calls can be chained, e.g. `Mask.excl(...).incl(...)`. The parts are
  painted in order, so later parts override the earlier ones.

By default the pieces are filled; pass the `MaskPartAttributes` to control the
fill and stroke, e.g. `Mask.incl(myPiece, {fill: false, stroke: 0.3})` includes
just the outline of the piece.

### Arbitrary mask contents, image masks

`Mask.create(piece)` creates a mask with the specified contents, taking the
luminance as-is. This is particularly useful for [Image](../src/images.ts)s: the
`incl`/`excl` helpers are not applicable to them (an `<image>` element ignores
the fill and stroke attributes), but an image prepared as white-on-black works
directly as a luminance mask:

<!-- deno-fmt-ignore -->

```ts
figures
  .circle({ radius: 5 })
  .setAttributes({ fill: "#ccc" })
  .useDefTool(
    Mask.create(
      maskImage.normalise({
        target: { centered: true, width: 10, height: 10 },
      }),
    ),
  );
```

Note that transparent areas of the mask contents also hide the masked Piece,
regardless of their color. For an image that defines the mask shape in its alpha
channel instead of luminance (e.g. black-on-transparent), switch the mask to the
alpha mode:

<!-- deno-fmt-ignore -->

```ts
Mask.create(maskImage).setAttributes({ maskType: "alpha" });
```

See [mask](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/mask) for
more information.

## Gradients

`createLinearGradient` and `createRadialGradient` create gradients, usable as
fill or stroke:

<!-- deno-fmt-ignore -->

```ts
myPiece.useDefTool(
  createLinearGradient({
    stops: [
      { offset: 0, color: "black" },
      { offset: 1, color: "white" },
    ],
    from: [0, 0],
    to: [1, 0],
  }),
  "fill",
);
```

The coordinates (`from` and `to` for the linear gradient, `circle` and `from`
for the radial gradient) are expressed as fractions of the Piece's bounding box.

The stops can be specified as a list of `{offset, color?, opacity?}` objects, or
as a function mapping the offset to a stop value, which is useful for non-linear
gradients. In a print layer, the shades of a gradient translate to the laser
power, just like with masks.

See
[linearGradient](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/linearGradient)
and
[radialGradient](https://developer.mozilla.org/en-US/docs/Web/SVG/Element/radialGradient)
for more information.
