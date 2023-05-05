<!-- markdownlint-disable-file no-duplicate-header -->

# Changelog

<!-- Include links to comparison to the previous version -->

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
