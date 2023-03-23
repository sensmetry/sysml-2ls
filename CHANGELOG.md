<!-- markdownlint-disable-file no-duplicate-header -->

# Changelog

<!-- Include links to comparison to the previous version -->

## main

### Added

- Subsetting multiplicities and unique names in direct scope validations

### Fixed

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
