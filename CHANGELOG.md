<!-- markdownlint-disable-file no-duplicate-header -->

# Changelog

<!-- Include links to comparison to the previous version -->

## main

## 0.8.0

### Fixed

- Fixed erroneous `validateLibraryPackageNotStandard` validation errors when
  using the bundled standard library

### Changes

- Updated to [2024-11 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-11)
  - New keyword `terminate`
  - New type `TerminateActionUsage`

### Chores

- Renamed command titles from 'SysIDE' to 'SysIDE Editor'

## 0.7.0

### Changes

- Added license to the published `syside-languageserver.js` which is now zipped
  together with license
- Added License Bundler on esbuild
- Updated to [2024-09 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-09)
  - Updated default visibilities of `Imports`
  - Imports need to have explicit visibility now

### Improvements

- Users no longer need to manually download the standard library or click the
  "Download standard library" button in the notification on first run of SysIDE
  Editor. The extension now bundles the latest standard library.

### Chores

- Rebranded from "SysIDE CE" to "SysIDE Editor".
  - Settings and command prefixes changed from `syside` to `syside.editor`.
  - Existing settings will be automatically migrated.

## 0.6.2

### Changes

- Updated icon

## 0.6.1

### Fixed

- Fixed `locale` semantic highlighting and TextMate grammar now correctly
  highlights `REGULAR_COMMENT`s, strings and numbers.

## 0.6.0

### Changes

- Updated to [2024-02 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2024-02)
  - Nearly all changes are to validation
- VS Code configuration settings now use `syside` section name instead of
  `sysml`, existing settings will be automatically migrated

### Improvements

- VSCode extension now works on the web with a few differences:
  - `syside.standardLibraryPath` is ignored, standard library is fetched directly
    from GitHub
  - `syside.plugins` is ignored

  Performance on the web may be degraded as the server has to share resources
  with other extensions. In addition, selecting SysML language will now provide
  language server support irrespective of the file extension, KerML files have
  to have `.kerml` extension to get support
- Only relevant standard library files will be downloaded instead of the full
  repository, greatly improving download
- Formatter now uses pretty-printer to format documents which can take line
  width into account through

  ```json
    "[sysml|kerml]": {
      "syside.formatting.lineWidth": 100
    },
    "syside.formatting.lineWidth": 100
  ```

  in VS Code settings. Additional options are available through
  `syside.formatting.` section which can also control optional keyword formatting.
  Formatting can be disabled by leading notes with `syside-format ignore` inside
  them which will print the element subtree the note is attached to as-is. Let
  us know about any issues with the new formatter like notes disappearing or
  feedback how the formatting style can be improved.
- Added pretty-printer for KerML and SysML models

### Chores

- Added methods to add and remove owned child elements
- Refactored model building and validation to work on internal model elements
  instead
- Refactored AST and internal model to store order dependent child nodes in
  separate fields/properties to allow for easier runtime modifications without
  having to maintain implicit ordering

## 0.5.2

### Fixed

- Fixed resolving custom SysIDE path on Windows when it was absolute

## 0.5.1

### Improvements

- Changed how language server is bundled, resulting in much better performance

## 0.5.0

### Fixed

- False positive standard library validation in some cases on Windows
- Completion showing suggestions from the current element scope for type and
  feature relationships when completion is triggered by a related token

### Improvements

- Global scopes are now cached in a single structure, and reference resolution
  across documents will be done in constant time unless some documents in the
  workspace contain public imports or unnamed features in root namespace. In
  that case, reference resolution will fall back to iterating through those
  documents if name was not resolved. While this does not improve performance
  much on small projects, it should scale better
- Improved reference resolution performance, should be more than twice as fast
  now

## 0.4.3

### Fixed

- `StateActionUsage` and `EffectBehaviorUsage` parsing which resulted in bad
  parse trees [#9](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues/9)

### Chores

- Updated Langium to 1.2.0

## 0.4.2

### Fixed

- Standard library always loaded from an equivalent path on the current drive on
  Windows [#7](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues/7)
- False error when semantic token computation is cancelled [#8](https://gitlab.com/sensmetry/public/sysml-2ls/-/issues/8)

### Chores

- Added configuration options for custom server path and command line arguments
  which may be used in the future
- Organized sources into workspace with dependant packages

## 0.4.1

### Fixed

- Fixed type relationships sometimes indented an additional time in unnamed types
- Alias members not showing up in completion suggestions

## 0.4.0

### Added

- KerML validations
- SysML validations
- Subsetting multiplicities and unique names in direct scope validations

### Fixed

- Whitespace issues in some formatting cases
- Excessive indentation in some formatting cases
- Formatter replacing all comment bodies in a scope with the first one
- Bugs discovered while adding validations
- `allocate` is not indented an additional time if the element starts with
  `allocate`
- Qualified names in suggestions shown from the membership node instead of the
  suggested element
- Standard library pop up showing on every extension activation after updating
  compatible standard library

## 0.3.1

### Changed

- Updated to [2023-02 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2023-02)
  - Indexing now uses `#(<sequence expression>)` syntax, `[...]` is now only
    used for multiplicities and quantities

## 0.3.0

### Changed

- Renamed to Systems Modeling IDE (SysIDE)

## 0.2.1

### Added

- Syntax highlighting in markdown fenced blocks with `kerml` and `sysml` identifiers
- Full auto-formatting. However, there is no configuration for it currently and
  there is no support for maximum line widths

### Fixed

- Completion not inserting quotes around restricted names if the cursor is on `{`
- Automatic indentation
- Completion sometimes returning no suggestions for multi-word unrestricted names

### Changed

- VS Code extension exports `LanguageClient`
- Invalid KerML/SysML documents will not be formatted

## 0.2.0

### Added

- Dynamic loading of JS plugins similar to how VS Code loads plugins at start up
  for non-intrusively extending server functionality. Plugins are loaded during
  workspace initialization through an exported `activate(context:
  SysMLSharedServices)` function. Also see `sysml.plugins` setting
- Users who have downloaded the standard library through this extension will be
  prompted to download a compatible standard library again when the compatible
  version changes

### Changed

- Updated to [2022-12 spec](https://github.com/Systems-Modeling/SysML-v2-Release/tree/2022-12)

## 0.1.1

### Fixed

- Documentation fixes

## 0.1.0

- Initial release
