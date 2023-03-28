# Installation

Install the tools necessary to work with the TPVector library:

- Install [esbuild](https://esbuild.github.io/), used for bundling and serving
  the code (install [Node.js](https://nodejs.org/) first, if needed). It is
  recommended to install globally with `npm install -g esbuild`, because
  TPVector is not a Node.js project, and esbuild is treated just as an external
  executable that needs to exist on the system.
- Install [Deno](https://deno.land/)
  ([instructions](https://deno.land/manual/getting_started/installation)) for
  type-checking the code. Strictly speaking, this is optional, but extremely
  useful for development, and required for full IDE support.
- _Recommended:_ Install [Visual Studio Code](https://code.visualstudio.com/)
  and the
  [Deno extension](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno).

Finally, fork the TPVector repository.

# Usage

- Open the forked TPVector repository in Visual Studio Code.
- Launch the _Viewer_ debug session (from the menu select _Run | Start
  Debugging_). This will start the _Viewer_ task (an esbuild process that
  bundles and serves the code) and launch the browser with the Viewer page
  opened.

Alternatively, you can launch the esbuild server manually, or using a different
IDE. You can find the esbuild command in
[_.vscode/tasks.json_](../.vscode/tasks.json), in the definition of the _Viewer_
task.

## Where to start

Take a look at the code entry point, which is
[_src/viewer/viewer.ts_](../src/viewer/viewer.ts), browse the demo projects, try
making changes. Changes in the code are immediately caught by esbuild, and the
browser is refreshed to show the result.

_Note:_ The esbuild process does not perform type-checking. For TypeScript
correctness you need to either rely on your IDE, or run the _Type-check_ task
(configured in [_.vscode/tasks.json_](../.vscode/tasks.json)).

## Creating your own projects

### In a branch

Starting your own repository in a branch is the easiest way to test out
TPVector.

- In the forked TPVector repository, create a new branch for your project(s).
- Create a _my_proj.ts_ file in the [_src/demos_](../src/demos) directory (or
  some other directory, e.g. _src/projects_) and include it in
  [_src/viewer/viewer.ts_](../src/viewer/viewer.ts).

### In a separate repository

- Create a repository for your projects.
- Add TPVector as a
  [submodule](https://git-scm.com/book/en/v2/Git-Tools-Submodules), e.g. in the
  _tp-vector_ subdirectory of your repository.
- Copy [_.vscode_](../.vscode) and [_deno.jsonc_](../deno.jsonc) to your
  repository's root, and make the necessary changes:
  - Add a section to _deno.jsonc_:

    ```
    "imports": {
      "tp-vector/": "./tp-vector/src/",
    },
    ```

    This will allow referencing the library from your files as:

    <!-- deno-fmt-ignore -->
    ```ts
    import {Piece} from 'tp-vector/index.ts';
    ```

  - In _.vscode/tasks.json_ change the esbuild command:
    - Add `--alias:tp-vector=./tp-vector/src`
    - Change the `--outdir` and `--servedir` from _src/viewer/static_ to
      _tp-vector/src/viewer/static_.
- Create a copy of [_src/viewer/viewer.ts_](../src/viewer/viewer.ts) in your own
  repository and modify it to add your projects.
