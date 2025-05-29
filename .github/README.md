<!-- markdownlint-capture -->
<!-- markdownlint-disable-file no-inline-html heading-increment first-line-heading -->

<table align="center"><tr><td align="center" width="9999">
<img src="../docs/images/logo-full.png" align="center" width="400" alt="SysIDE icon">

### System Engineering at the Speed of Code

_SysIDE_ (pronounced "seaside") is a comprehensive tool suite for all of your SysML v2 needs

</td></tr></table>

<!-- markdownlint-restore -->

# SysIDE Editor

**NOTE: this is a mirror repository.** The main repository is hosted [here on Gitlab](https://gitlab.com/sensmetry/public/sysml-2ls).

[![pipeline status](https://gitlab.com/sensmetry/public/sysml-2ls/badges/main/pipeline.svg)](https://gitlab.com/sensmetry/public/sysml-2ls/-/commits/main)
[![coverage report](https://gitlab.com/sensmetry/public/sysml-2ls/badges/main/coverage.svg)](https://sensmetry.gitlab.io/public/sysml-2ls)
[![Latest Release](https://gitlab.com/sensmetry/public/sysml-2ls/-/badges/release.svg)](https://gitlab.com/sensmetry/public/sysml-2ls/-/releases)
[![VSCode Marketplace](https://img.shields.io/badge/Download-VS%20Code%20Marketplace-brightgreen?logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=sensmetry.sysml-2ls)
[![OpenVSX](https://img.shields.io/badge/Download-Open--VSX-brightgreen?logo=vscodium)](https://open-vsx.org/extension/sensmetry/sysml-2ls)

---

_SysIDE Editor_ is a free and open source SysML v2 textual editing and analysis
tool, bringing rich SysML v2 language support to Visual Studio Code.
_SysIDE Editor_ can also be integrated into other applications and automated
workflows which need to interact with SysML v2 textual representations.

The main enabling components of _SysIDE Editor_ are a parser and a language
server for SysML v2 and KerML
[2024-12 release](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-12)
specifications.

_SysIDE Editor_ provides features such as:

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

_SysIDE Editor_ is built and maintained by [**Sensmetry**](https://sensmetry.com/),
a company focused on ensuring the safety and reliability of mission- &
safety-critical automated systems.

_SysIDE Editor_ is an open source project and Sensmetry is looking for community
contributions from users and developers. For further information about the open
source license, see [LICENSE](/LICENSE). To contribute, please see the
[CONTRIBUTING.md](/CONTRIBUTING.md) document.

## SysIDE tool suite

_SysIDE_ tool suite is quickly growing. It includes:

- _**SysIDE Editor**_ - free and open source VS Code extension, enabling modern
  'as code' modeling for everyone. Available to everyone.
- _**SysIDE Librarian**_ - open-source SysML v2 package manager. Coming soon.
- _**SysIDE Modeler**_ - a premium SysML v2 modeling environment. Please visit
  [syside.sensmetry.com](https://syside.sensmetry.com) for more information.
- _**SysIDE Automator**_ - analyse, optimise, and automate your modeling
  workflows by using Python. Please visit
  [syside.sensmetry.com](https://syside.sensmetry.com) for more information.
- _**SysIDE Server**_ - model server to ensure interoperability with other SysML
  v2 tools, even those that do not support textual notation. Coming soon.

If you want to get in touch regarding any edition of _SysIDE_, reach out to
Sensmetry at [syside@sensmetry.com](mailto:syside@sensmetry.com)

## Join the community

Connect with other SysIDE and SysML v2 users to share your experiences and learn
from others on our [community forum](https://forum.sensmetry.com).

## Quick start

### In a browser (without local VSCode)

You can try out _SysIDE Editor_ without needing to instal it locally. To do so:

1. Go to [Visual Studio Code for the Web](https://vscode.dev)
2. Open the `Extensions` tab on the right of the screen
3. Search for and install _SysIDE Editor_
4. Open a folder or a `.sysml` file

This is a good way to get a taste for how _SysIDE Editor_ works. But if you plan
on using it for a longer term or for larger models, we suggest installing it locally.

### Running locally

0. Install [Visual Studio Code](https://code.visualstudio.com),
  [VSCodium](https://vscodium.com), or [Cursor AI](https://www.cursor.com)
1. Open the `Extensions` tab on the right of the screen
2. Search for and install _SysIDE Editor_
3. Open a SysML v2 (.sysml) file and the extension will activate.
4. Link with the SysML v2 standard library:

## Standard library

_SysIDE Editor_ includes the standard library from
[our fork](https://github.com/daumantas-kavolis-sensmetry/SysML-v2-Release/tree/fixes)
of the
[SysML-v2-Release](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-12/sysml.library)
repository. The library is licensed under the LGPL v3.0, see
[LICENSE](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-12/LICENSE).

If you wish to use a different version of the standard library you can go to the
_SysIDE Editor_ settings and enter the path to the directory with your preferred
library.

![Settings](./docs/images/library-settings.png)

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

We invite enthusiasts and developers to join the SysML v2 open-source community
by contributing to and expanding the capabilities of the SysIDE Editor.

See [CONTRIBUTING.md](/CONTRIBUTING.md).

## Disclaimer

_SysIDE Editor_ is developed for the language that carries the name of SysML
which is a trademark of OMG. _SysIDE Editor_ has been started and continues to
be maintained by [Sensmetry](https://sensmetry.com/).

The project is open source. For further information, see [LICENSE](/LICENSE).
