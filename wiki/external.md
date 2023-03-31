# Using external resources

Some resources can be loaded directly from external sources. For example:

- [Images](../src/images.ts): `Image.fromURL`
- [Fonts](../src/fonts.ts): `Font.fromURL` and `Font.googleFonts`

These functions do the following:

- fetch the specified URL in JavaScript,
- encode the loaded content as a
  [data URI](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URLs),
- use the data URI instead of the original URL.

As a result, the generated SVG file embeds the data and does not need to load
anything from an external URL. This allows rendering the SVG as PNG (for
technical reasons, nothing can be loaded from external URLs during this
process), and importing such an SVG in a laser cutter software (laser cutter
software usually doesn't support loading external URLs found in the SVG).
