# Installation

Start by installing the necessary tools and launching the [Viewer](#viewer),
then experiment with modifying the existing projects, and finally create your
own projects. TPVector projects are written in
[TypeScript](https://www.typescriptlang.org/).

- It's easiest to obtain the necessary development tools using
  [Docker](https://www.docker.com/). Install Docker (note that Docker on Windows
  requires [WSL](https://learn.microsoft.com/en-us/windows/wsl/)).

  <details><summary>Without Docker</summary>

  You can also use TPVector without Docker, however you need to be on linux or
  WSL, and install the tools manually. You can treat the
  [_dockerfile_](../docker/dockerfile) as an instruction for configuring the
  environment. Then launch the commands from the [_cmds_](../cmds/) directory
  manually (normally Docker runs [_cmds/viewer_](../cmds/viewer) by default).

  </details>

- The recommended IDE is [Visual Studio Code](https://code.visualstudio.com/),
  with the following extensions:
  - [Docker](https://marketplace.visualstudio.com/items?itemName=ms-azuretools.vscode-docker)
  - [Deno](https://marketplace.visualstudio.com/items?itemName=denoland.vscode-deno)
    (for type-checking)
  - [WSL](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-wsl)
    (if you're on Windows)

  You can however use a different IDE (or no IDE) as well.

- [Clone or fork](https://docs.github.com/en/get-started/quickstart/fork-a-repo)
  the TPVector git repository on your machine. For this you need a git client,
  for example [GitHub Desktop](https://desktop.github.com/) or
  [git](https://git-scm.com/).

# Usage

## Viewer

The Viewer is a part of the TPVector library. It is a web application that
generates the SVG files, shows them for preview and saves them for usage in the
laser cutter software.

### Starting the Viewer

#### In Visual Studio Code

Run the Run/Debug configuration _Viewer (Docker)_. This will build and start a
Docker container which serves the Viewer app, and open the app in the browser
(at http://localhost:4327/).

<details><summary>Without Docker</summary>

You can use the _Viewer (local)_ configuration instead to run Viewer using the
locally installed development tools.

</details>

#### Without Visual Studio Code

- Build and start the Docker container defined in
  [_docker-compose.yml_](../docker/docker-compose.yml). This can be done in
  multiple ways:
  - from the Docker Desktop, or
  - from the command line: `docker compose -f docker/docker-compose.yml up`.

  <br>
  <details><summary>Without Docker</summary>

  Run directly [_cmds/viewer_](../cmds/viewer) to start the Viewer.

  </details>

- Open the Viewer in the browser, at http://localhost:4327/.

### More details

The TypeScript code of the library and the projects is bundled together and
served to the browser. All the logic of generating the SVGs ( both for preview
and for the laser software) is executed in the browser.

The bundler used to serve the Viewer is [esbuild](https://esbuild.github.io/),
launched by [_cmds/viewer_](../cmds/viewer), which happens automatically if you
start the Docker container as described above.

The Viewer initially shows the demo projects, defined in
[_demos_](../src/demos/). See below for how to add your own projects.

## Where to start in the code

Take a look at the code entry point, which is
[_src/viewer/viewer.ts_](../src/viewer/viewer.ts), browse the demo projects, try
making changes. Changes in the code are immediately caught by the Viewer, and
the browser is refreshed to show the result.

_Note:_ The Viewer process does not perform type-checking. For TypeScript
type-checking you need to either rely on your IDE, or run the checker manually,
using [_cmds/type-check_](../cmds/type-check), or the _Type-check_ task in VS
Code.

## Custom projects

There are two main ways to start developing your own projects:

### Directly in the TPVector repository (easiest)

- In your fork of the TPVector repository, create a new branch for your
  project(s).
- Pick a directory for your projects under [_src_](../src). You can put your
  files directly in [_src/demos_](../src/demos) along with the demo files, or
  you can create another directory, like _src/my_projects_.
- Add your projects to [_src/viewer/viewer.ts_](../src/viewer/viewer.ts).
- [Start the Viewer](#starting-the-viewer). Your projects will be shown along
  with the demo projects.

### In a separate repository

- Pick a directory for your projects under [_src_](../src). If you want it to be
  git-ignored, pick _src/proj_, otherwise pick a different name (whether you
  want it to be git-ignored or not might depend on your workflow, e.g. in VS
  Code a sub-repository works better if it's not git-ignored). Let's say you
  pick `my_projects`.
- Init your projects' repository in the selected directory (now or later).
- Run `cmds/set-up-custom-projects-dir my_projects` (see
  [cmds/set-up-custom-projects-dir](../cmds/set-up-custom-projects-dir)). This
  will do the following:
  - Create _src/my_projects_ directory (unless exists).
  - Create _src/my_projects/viewer.ts_ file (unless exists) as a copy of
    [_src/viewer/viewer.ts_](../src/viewer/viewer.ts).
  - Create _src/my_projects/projects-viewer_ bash script (unless exists) which
    runs the Viewer with the previously created copy of _viewer.ts_ as the entry
    point.
  - Create _cmds/projects-viewer_ file as a symlink to the previously created
    _projects-viewer_. This will cause the [_cmds/viewer_](../cmds/viewer) to
    run this file instead of [_cmds/demos-viewer_](../cmds/demos-viewer).
- If the Docker container is running, stop it, as it will need to be recreated
  after the change of the main script.
- Add your projects to _src/my_projects/viewer.ts_.
- [Start the Viewer](#starting-the-viewer). Your projects will be shown along
  with the demo projects (unless you delete them from
  _src/my_projects/viewer.ts_).

You can make any necessary changes to the _src/my_projects/projects-viewer_
script, e.g. add more loaders.
