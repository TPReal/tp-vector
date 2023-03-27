# Code style

TPVector is written entirely in [TypeScript](https://www.typescriptlang.org/).
At any time, the most modern features of the language might be used.

## Immutability

All the classes and most interfaces in TPVector are
[immutable](https://en.wikipedia.org/wiki/Immutable_object). For more details,
see the [Immutability doc](immutability.md).

## Constructors

The constructors are always protected (or private), and classes are instantiated
using static constructor methods, like `create(...)`, `fromBinary(...)` etc.

## Formatting

The code is formatted using the `vscode.typescript-language-features` formatter,
with the formatting options stored
[.vscode/settings.json](../.vscode/settings.json). The formatter gives a lot of
freedom, some choices were made for consistency:

- Single quotes are used for imports, backticks are used for user-visible
  messages, other string literals use double quotes, or backticks as template
  literals.

## Documentation

The code is well structured and self-documenting as much as possible. JSDoc is
added where it is needed, or clearly beneficial, and the HTML documentation is
generated using [typedoc](https://typedoc.org/), configured in
[typedoc.json](../typedoc.json). However, it might be a good idea to read the
code of the library, and not just the docs.

When writing JSDoc, there are no strict requirements on using the tags like
`@param` etc. A free-form text explaining the entity is enough.
