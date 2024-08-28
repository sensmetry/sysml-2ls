# SysIDE Community Edition

**NOTE: this is a mirror repository.** The main repository is hosted [here on Gitlab](https://gitlab.com/sensmetry/public/sysml-2ls).

<!-- markdownlint-capture -->
<!-- markdownlint-disable-file no-inline-html heading-increment -->

<table align="center"><tr><td align="center" width="9999">
<img src="../docs/images/logo-full.png" align="center" width="400" alt="SysIDE icon">

### SysML v2 'as code' modeling and analysis system

_SysIDE_ (pronounced "seaside") is a transformational SysML v2 systems-as-code modeling tool

</td></tr></table>

<!-- markdownlint-restore -->

[![pipeline status](https://gitlab.com/sensmetry/public/sysml-2ls/badges/main/pipeline.svg)](https://gitlab.com/sensmetry/public/sysml-2ls/-/commits/main)
[![coverage report](https://gitlab.com/sensmetry/public/sysml-2ls/badges/main/coverage.svg)](https://sensmetry.gitlab.io/public/sysml-2ls)
[![Latest Release](https://gitlab.com/sensmetry/public/sysml-2ls/-/badges/release.svg)](https://gitlab.com/sensmetry/public/sysml-2ls/-/releases)
[![VSCode Marketplace](https://img.shields.io/badge/Download-VS%20Code%20Marketplace-brightgreen?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=sensmetry.sysml-2ls)
[![OpenVSX](https://img.shields.io/badge/Download-Open--VSX-brightgreen?logo=vscodium)](https://open-vsx.org/extension/sensmetry/sysml-2ls)

---

_SysIDE Community Edition (SysIDE CE)_ is a free and open source SysML v2 textual editing and analysis system, bringing rich SysML v2 language support to Visual Studio Code. _SysIDE CE_ can also be integrated into other applications and automated workflows which need to interact with SysML v2 textual representations.

The main enabling components of _SysIDE CE_ are a parser and a language server for SysML v2 and KerML [2024-05 release](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-05) specifications.

_SysIDE CE_ provides features such as:

- Semantic highlighting
- Autocompletion
- Code navigation
- Formatting
- Real-time syntax and semantic validation
- Reference search
- Folding
- Document symbols
- Renaming
- Documentation on hover

_SysIDE CE_ is built and maintained by [**Sensmetry**](https://sensmetry.com/), a company focused on ensuring the safety and reliability of mission- & safety-critical automated systems.

_SysIDE CE_ is an open source project with contributions from user and developer community highly encouraged and welcome. For further information about the open source license, see [LICENSE](/LICENSE). To contribute, please see the [CONTRIBUTING.md](/CONTRIBUTING.md) document.

## Editions

There are two editions of _SysIDE_:

- _SysIDE CE_ - free and open source version of _SysIDE_, enabling modern 'as code' modeling for everyone
- _SysIDE Pro_ - a licenced version of _SysIDE_, providing advanced features & performance for power-users

If you want to get in touch regarding any edition of _SysIDE_, reach out to Sensmetry at `syside(at)sensmetry(dot)com`

## Quick start

### In a browser (without local VSCode)

You can try out _SysIDE_ without needing to instal it locally. To do so:
1. Go to [Visual Studio Code for the Web](https://vscode.dev)
2. Open the `Extensions` tab on the right of the screen
3. Search for and install _SysIDE CE_
4. Open a folder or a `.sysml` file

This is a good way to get a taste for how _SysIDE CE_ works. But if you plan on using it for a longer term or for larger models, we suggest installing it locally.

### Running locally

0. Install [Visual Studio Code](https://code.visualstudio.com) or [VSCodium](https://vscodium.com)
1. Open the `Extensions` tab on the right of the screen
2. Search for and install _SysIDE CE_
3. Open a SysML v2 (.sysml) file and the extension will activate.
4. Link with the SysML v2 standard library:

    - Upon the first activation a pop-up will be displayed on the bottom righ tof your screen asking you to either locate an existing SysML v2 standard library or download it.  
    <img src="docs/images/library-prompt.png" alt="Prompt" width="600"/>
    <br> <br>

    - If you don't see the pop-up, download the library (`sysml.library` directory from [SysML-v2-Release](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-02/sysml.library) repository) and copy its path to extension settings:  
    <img src="docs/images/library-settings.png" alt="Settings" width="600"/>
    <br> <br>

    - Alternatively, the pop-up may also be disabled globally or in the workspace and the extension will continue without standard library support (<mark>may result in faulty sysml validation</mark>).

## Features

The extension provides basic features to support SysML v2 document editing:

<!-- markdownlint-capture -->
<!-- markdownlint-disable-file no-inline-html -->

- **Semantic and syntax checking** identifies errors as they occur allowing to instantly correct mistakes and speed up workflow.  
  ![Semantic and syntax checking](/docs/images/validation_dark.gif)
  <br> <br>


- **Semantic highlighting** increases readability and allows to distinguish different parts of the code quickly.  
  ![Semantic highlighting](/docs/images/semantic-highlighting.png)
  <br> <br>

- **Autocompletion** speeds up the workflow by reducing typing errors and minimizing manual input.  
  ![Autocompletion](/docs/images/completion.gif)
  <br> <br>

- **Hovers** instantly display documentation allowing to quickly understand an element.  
  ![Hovers](/docs/images/hover.gif)
  <br> <br>

- **Code navigation** speeds up development by enabling quick access to element definitions.  
  ![Navigation](/docs/images/navigation.gif)
  <br> <br>

- **Folding** improves readability and eases navigation by organizing code into collapsible sections.  
  ![Folding](/docs/images/folding.gif)

- **Auto-formatting** enhances code readability and maintainability by ensuring consistent structure for:  

  - Comment bodies  
  ![Comment bodies](/docs/images/comment-formatting.gif)
  <br> <br>

  - Elements  
  ![Elements](/docs/images/formatting.gif)
  <br> <br>

- **Renaming** saves time and reduces errors by renaming all elements with the same name with one click.  
  ![Renaming](/docs/images/renaming.gif)
  <br> <br>

- **References** enable efficient navigation and code updating by identifying all instances of an element.  
  ![References](/docs/images/references.gif)
  <br> <br>

- **Document symbols** provide rapid model overviews, enabling efficient comprehension and navigation.  
  ![Symbols](/docs/images/symbols.gif)
  <br> <br>


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

_SysIDE CE_ is developed for the language that carries the name of SysML which is a trademark of OMG. _SysIDE CE_ has been started and continues to be maintained by [Sensmetry](https://sensmetry.com/).

The project is open source. For further information, see [LICENSE](/LICENSE).
