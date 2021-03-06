# Changelog

## v0.7.0

- Add `forceDefineGlobal` option

## v0.6.0

- Add `childModuleNameConverter` option (can only be used from API or `DtsPackPlugin`)
- Add `keepIndividualDeclarations` option for `DtsPackPlugin`
- Fix child module name generation
- Support object value for webpack configuration `output.library`

## v0.5.1

- Fix path resolution for emitted declaration files on `DtsPackPlugin`

## v0.5.0

- Change the `project` file usage when using `DtsPackPlugin` (see [README.md](./README.md))
  - Note that this change does not affect the command-line or APIs.
- Add `--headerText` and `--footerText` options to add header and footer text for output files.

## v0.4.1

- Fix output file name on `DtsPackPlugin`

## v0.4.0

- Use [enhanced-resolve](https://github.com/webpack/enhanced-resolve) for module resolution when using `DtsPackPlugin`.
  - The package 'enhanced-resolve' with version 2.0.0 or higher (currently up to 4.x) is necessary when using the plugin. Users are possibly unnecessary to install it explicitly because webpack and/or other loaders use it.
  - Note that this change does not affect the command-line or APIs; when using dts-pack from command-line or APIs, 'enhanced-resolve' is not used.

## v0.3.0

- Add `--stripUnusedExports` option (#4)
- Support webpack 4.x (not fully tested yet)

## v0.2.0

- Add webpack plugin named `DtsPackPlugin` (#1)

## v0.1.1

- Fix 'typescript' version (tested with 2.7.1)

## v0.1.0

- Initial version
