## Installation

To run the TPVector demos and start developing your own projects, follow these
steps:

- Fork this repository.
- Install [esbuild](https://esbuild.github.io/), used for bundling and serving
  the code (install [Node.js](https://nodejs.org/) first, if needed). It is
  recommended to install it globally with `npm install -g esbuild`, because
  TPVector is not a Node.js project, and esbuild is treated just as an external
  executable that needs to exist on the system.
- Install [Deno](https://deno.land/)
  ([instructions](https://deno.land/manual/getting_started/installation)) for
  type-checking the code. Strictly speaking, this is optional, but extremely
  useful for development, and required for full IDE support.
- It is recommended to use [Visual Studio Code](https://code.visualstudio.com/):
  - Open the project in Visual Studio Code with the official
    [Deno extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)
    enabled.
  - Launch the _Viewer_ debug session (from the menu select _Run | Start
    Debugging_ or _Run | Run Without Debugging_). This will start the _Viewer_
    task (an [esbuild](https://esbuild.github.io/) process that bundles and
    hosts the code) and launch the browser with the Viewer page opened.
- Alternatively, you can launch the esbuild server manually. You can find the
  command in [.vscode/tasks.json](../.vscode/tasks.json), in the definition of
  the _Viewer_ task.

Changes done in the code are immediately caught by esbuild, and the browser is
refreshed to show the changes.

If you want to develop your own projects, the easiest option is to create your
projects in the [_src/demos_](../src/demos) directory, or some other directory
like _src/projects_, and include them in the
[_src/viewer/viewer.ts_](../src/viewer/viewer.ts).
