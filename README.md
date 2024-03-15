# _SysIDE_: SysML v2 Modeling IDE

[![pipeline status](https://gitlab.com/sensmetry/public/sysml-2ls/badges/main/pipeline.svg)](https://gitlab.com/sensmetry/public/sysml-2ls/-/commits/main)
[![coverage report](https://gitlab.com/sensmetry/public/sysml-2ls/badges/main/coverage.svg)](https://sensmetry.gitlab.io/public/sysml-2ls)
[![Latest Release](https://gitlab.com/sensmetry/public/sysml-2ls/-/badges/release.svg)](https://gitlab.com/sensmetry/public/sysml-2ls/-/releases)

_SysIDE_ (pronounced "seaside") provides SysML v2 language support in VS Code.

_SysIDE_ includes a language server for SysML v2 and KerML [2024-02 release](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-02) specifications. Together with VS Code, _SysIDE_ serves as integrated development environment (IDE) for SysML v2.

This extension provides:

- autocompletion,
- code navigation,
- semantic highlighting,
- formatting,
- syntax validation,
- reference search,
- folding,
- document symbols,
- renaming,
- documentation on hover,
- semantic validation.

_SysIDE_ is built and maintained by [Sensmetry](https://sensmetry.com/), a company focused on ensuring the safety and reliability of mission & safety critical systems.

The initial version has been created as an R&D effort, and contributions are highly encouraged. To provide your contributions please see the [CONTRIBUTING.md](/CONTRIBUTING.md) document.

## Quick start

1. Install the latest extension from the marketplace.
2. Open a SysMLv2 (.sysml) file and the extension will activate.
3. Upon the first activation a pop-up will be displayed asking you to either locate an existing SysMLv2 standard library (`sysml.library` directory from [SysML-v2-Release](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-02/sysml.library) repository) or download it. The pop-up may also be disabled globally or in the workspace and the extension will continue without standard library support.

## Features

The extension provides basic features to support SysMLv2 document editing:

<!-- markdownlint-capture -->
<!-- markdownlint-disable-file no-inline-html -->

- Autocompletion  
  ![Autocompletion](/docs/images/completion.gif)
  <br> <br>

- Code navigation  
  ![Navigation](/docs/images/navigation.gif)
  <br> <br>

- Semantic highlighting  
  ![Semantic highlighting](/docs/images/semantic-highlighting.png)
  <br> <br>

- Auto-formatting:

  - Comment bodies  
  ![Comment bodies](/docs/images/comment-formatting.gif)
  <br> <br>

  - Elements  
  ![Elements](/docs/images/formatting.gif)
  <br> <br>

- Renaming  
  ![Renaming](/docs/images/renaming.gif)
  <br> <br>

- Hovers  
  ![Hovers](/docs/images/hover.gif)
  <br> <br>

- References  
  ![References](/docs/images/references.gif)
  <br> <br>

- Document symbols  
  ![Symbols](/docs/images/symbols.gif)
  <br> <br>

- Folding  
  ![Folding](/docs/images/folding.gif)

<!-- markdownlint-restore -->

## Known Limitations

See [docs/known_limitations.md](docs/known_limitations.md).

## Developer instructions

### Building from source code

- [Install `pnpm`](https://pnpm.io/installation)
- Run `pnpm install` to install dependencies.
- Run `pnpm run grammar:generate` to generate TypeScript code from the grammar
  definition.
  <!-- Langium generator is broken until `addSuperPropertiesInternal`
  is fixed (not using the set parameter). -->
- Run `pnpm run build` to compile all TypeScript code.

### Make changes

- Run `pnpm run install-hooks` to install git hooks.
- Run `pnpm run watch` to have the TypeScript compiler run automatically after
  every change of the source files.
- Run `pnpm run grammar:watch` to have the Langium generator run automatically
  after every change of the grammar declaration.
- You can relaunch the extension from the debug toolbar after making changes to
  the files listed above.
- You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your
  extension to load your changes.

### Packaging

To package the extension for VS Code run:
  
  ```bash
  pnpm run vscode:package
  ```

## Contributing

See [CONTRIBUTING.md](/CONTRIBUTING.md).

## Disclaimer

_SysIDE_ is developed for the language that carries the name of SysML which is a trademark of OMG. _SysIDE_ has been started and continues to be maintained by [Sensmetry](https://sensmetry.com/).

The project is open source. For further information, see [LICENSE](/LICENSE).
