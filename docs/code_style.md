# Code style

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

The code is written in a clear and self-descriptive way. JSDoc is added where it
is needed, or clearly beneficial. There are no strict requirements on using the
JSDoc tags like `@param` etc.
