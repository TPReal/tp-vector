# Installation

To use TPVector, you need to write [TypeScript](https://www.typescriptlang.org/)
code. Start by installing the necessary tools and launching the
[Viewer](#viewer).

## The tools

It's easiest to obtain the necessary development tools using
[Docker](https://www.docker.com/):

- Install [Docker](https://www.docker.com/). Note that Docker on Windows
  requires [WSL](https://learn.microsoft.com/en-us/windows/wsl/).
- [Clone or fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo)
  the TPVector repository on your machine.
- Build and start the Docker container defined in
  [_docker-compose.yml_](../docker/docker-compose.yml). This can be done in
  multiple ways, for example:
  - from the Docker Desktop, or
  - from the command line: `docker compose -f docker/docker-compose.yml up`.
- Open the [Viewer](#viewer) in the browser, at http://localhost:4327/.

### Visual Studio Code

If you're using [Visual Studio Code](https://code.visualstudio.com/), you still
need to install Docker, but the remaining steps can be simplified even further:
just launch the Run/Debug configuration _Viewer (docker)_ (defined in
[_launch.json_](../.vscode/launch.json)). This starts the Docker container and
opens the Viewer.

Visual Studio Code extensions recommended for development:

- [Docker](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-docker)
- [Deno](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)
  (for type-checking)
- [WSL](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl)
  (if you're on Windows)

### Without Docker

You can also use TPVector without Docker, however you need to be on linux or
WSL, and install the tools manually. You can treat the
[_dockerfile_](../docker/dockerfile) as an instruction. Then launch the commands
from the [_cmds_](../cmds/) directory.

# Usage

The TypeScript code of the library and the projects is bundled and served to the
browser. All the logic is executed there: it's the browser that generates the
SVGs, both for preview and for the laser software.

## Viewer

The Viewer is a part of the TPVector library. It is a web application for
generating, previewing and saving SVG files.

It is launched using the command in [_cmds/viewer_](../cmds/viewer), which
happens automatically if you start the Docker container as described above.

The Viewer initially shows the demo projects, defined in
[_demos_](../src/demos/). See below for how to add more projects.

## Where to start in the code

Take a look at the code entry point, which is
[_src/viewer/viewer.ts_](../src/viewer/viewer.ts), browse the demo projects, try
making changes. Changes in the code are immediately caught by the Viewer, and
the browser is refreshed to show the result.

_Note:_ The Viewer process (which uses esbuild under the hood) does not perform
type-checking. For TypeScript type-checking you need to either rely on your IDE,
or run the checker manually, using [_cmds/type-check_](../cmds/type-check), or
the _Type-check_ task in VS Code.

## Creating your own projects

The easiest way to start working on your own projects is to put them in a branch
of the TPVector repository:

- In your fork of the TPVector repository, create a new branch for your
  project(s).
- Create a _my_proj.ts_ file in the [_src/demos_](../src/demos) directory (or
  some other directory, e.g. _src/projects_), as a copy of one of the demo
  projects, and include it in [_src/viewer/viewer.ts_](../src/viewer/viewer.ts).

The change should be immediately caught by the Viewer. You can now work on your
project, and, when ready, submit it to your fork of the repository.
