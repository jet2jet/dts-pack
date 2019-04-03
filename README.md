[![NPM version](https://badge.fury.io/js/dts-pack.svg)](https://www.npmjs.com/package/dts-pack)

dts-pack
==========

Generates concatenated `.d.ts` file(s) for the TypeScript project.

## Install

```
npm install dts-pack
```

## Usage

```
Usage:
  dts-pack --entry <entry-name> --module <module-name> [<options...>]
  dts-pack --list [<options...>]

Options:
  --help, -h, -?                      Show help                        [boolean]
  --project, -p                       The project file or directory
                                           [string] [default: "./tsconfig.json"]
  --entry, -e                         The entry module name in the project
                                                                        [string]
  --moduleName, -m                    The output module name            [string]
  --export, -x                        The export entity name in the entry module
                                      name                              [string]
  --rootName, -r                      The root variable name            [string]
  --outDir, -o                        The output directory name (not file name)
                                                        [string] [default: "./"]
  --style, -s                         The declaration style
                   [string] [choices: "module", "namespace"] [default: "module"]
  --defaultName, -d                   The 'default' name for namespace-style
                                                  [string] [default: "_default"]
  --importBindingName                 The identifier for binding modules with
                                      'import'    [string] [default: "__module"]
  --stripUnusedExports                The flag whether exported entities are
                                      stripped when not used           [boolean]
  --forceDefineGlobal                 The flag whether to define global export
                                      variable forcely                 [boolean]
  --headerText, --header, -H          Header text data for output files [string]
  --footerText, --footer, -F          Footer text data for output files [string]
  --isHeaderFooterRawText, --raw, -R  If set, headerText and footerText are
                                      emitted without comment block    [boolean]
  --list                              If specified, outputs all imports and
                                      exports and exit without emitting files.
                                                                       [boolean]
  --version, -V                       Show version number              [boolean]
```

### Options

#### --help, -h, -? (boolean)

Shows the usage.

#### --project, -p (string)

Specifies the TypeScript project file (such as tsconfig.json) or the directory path.
If omitted, `'./tsconfig.json'` will be used.

#### --entry, -e (string)

Specifies the entry module name to expose exported entities. This is treated as a source file name of the project. If the path is relative, the path is treated as referring from the root source directory (from `baseUrl` or the project directory).
If an extension is omitted, `.ts` will be appended.

#### --moduleName, -m (string)

Specifies the module name. This name will be used as the output filename or the directory name.

#### --export, -x (string)

Specifies the export name in the entry file to expose. If omitted, the entire entry module will be used as a namespace and will be exposed (such as `import * as XXX from '...'; export = XXX;`).
To expose default, use '--export default'.

#### --rootName, -r (string)

Specifies the root variable (entity) name. This name will be used as a global entity of the exported data (e.g. `export as namespace XXX;`). If omitted, the root name will not be created. This is useful for the modules exposing the global namespace (like UMD modules); if the declaration file is used for the type reference (e.g. with `typeRoots` option or `reference` directive), you can use the module via the namespace name without `import`ing.

You can specify a nested namespace name like `Some.Namespace.Name`; if specified, all namespaces will be created.

#### --outDir, -o (string)

Specifies the output directory. Note that you cannot specify the output filename directly; use `--outDir` and `--moduleName`.

#### --style, -s (`'module' | 'namespace'`)

Specifies the declaration style. Following style names are valid.

##### `'module'` (default)

Outputs two files named `<moduleName>/index.d.ts` and `<moduleName>/<moduleName>.d.ts`. `index.d.ts` refers `<moduleName>.d.ts` with `reference` directive, and `<moduleName>.d.ts` contains all modules in the project. For putting `<moduleName>/` directory to your directory for external modules, you can use the module with `import ... from '<moduleName>'`. You can also `import` child modules, but it may cause errors because of lacks of actual child modules' sources (e.g. using with concatenated JS module).

##### `'namespace'`

\[Experimental\] Outputs one file named `<moduleName>.d.ts`, containing dummy namespaces and exported entities. You can use `import ... from '<moduleName>'`, but cannot import child modules.
This style declares dummy namespaces, and some entity types may be differ from actual types. And, for restriction of specification, the `default` will be renamed to `_default` (or other name specified with `--defaultName` option). You can still use `default` to the option `--export` (renamed automatically), but cannot use `default` for the descendant entities.

#### --defaultName, -d (string)

Specifies the entity name to rename from `default`. If omitted, `_default` will be used. This option will be ignored if `'module'`-style is used.

#### --importBindingName (string)

Specifies the dummy binding name for importing external modules (e.g. `import __module from '<external-module>'`). Default is `__module`.

#### --stripUnusedExports (boolean)

Specifies for stripping exported entities when not used. If omitted, the entities are not stripped.

#### --forceDefineGlobal (boolean)

Specifies to define global export variable forcely.
If specified, the variable which name is from `rootName` will be defined to `global` scope
in addition to `export as namespace XXX;`.
This setting does not affect if `rootName` contains '.', because the root namespace is always declared to `global`.

#### --headerText, --header, -H (string) / --footerText, --footer, -F (string)

Header or footer text data for output files. For text data, following text are replaced:

* `[name]`    --> the basename of the output file name
* `[module]`  --> moduleName of the option
* `[year]`    --> the full year value of the build date
* `[year2]`   --> last 2-digit of the full year value of the build date
* `[month]`   --> the month value (1 to 12) of the build date
* `[month2]`  --> the 2-digit month value (01 to 12) of the build date
* `[day]`     --> the day value (1 to 31) of the build date
* `[day2]`    --> the 2-digit day value (01 to 31) of the build date

If you use this option from the script, you can also specify callback function which returns the header/footer text. The type of the callback is [HeaderFooterCallback](./src/main/types/HeaderFooterCallback.ts).

#### --isHeaderFooterRawText, --raw, -R (boolean)

If set, the header and footer text (from `--headerText` and `--footerText` options) are output without any decorations.  
If not set, header and footer text will be wrapped with `/*!\n * [each line text]\n */` for header and `/*\n * [each line text]\n */` for footer.

#### childModuleNameConverter (function; used only from API)

Specifies for generating child module name. This option is used only with `'module'`-style.

The function prototype is `(moduleName: string, childName: string, resolvedFileName: string) => string`, which
`moduleName` is the `--moduleName` option value, `childName` is the actual child module name, and
`resolvedFileName` is the absolute child module file name. If the function is not specified,
the default child module name will be `<moduleName>/<childName>`.

#### --list (boolean)

Outputs all imports and exports in the sources of the project file. If this option is specified, no files are outputted.

#### --version, -V (boolean)

Shows the version number.

## Examples

Output examples for both 'module-style' and 'namespace-style' is in the [examples directory](./examples). For creating module-style, enter the following command on the directory:

```
dts-pack -p ./tsconfig.json -e index.ts -m myModule -s module -x default -o ./dist-module-style
```

For creating namespace-style, change 'module' of the command line above to 'namespace'.

## webpack plugin

dts-pack can be used as a plugin for [webpack](https://webpack.js.org/). The `DtsPackPlugin` gathers all emitted files with an extension `.d.ts`, and emits one or two combined declaration file(s). Currently the plugin is tested only with the combination of webpack 3/4 and  [ts-loader](https://github.com/TypeStrong/ts-loader) (the plugin might be work on webpack 2, but not tested).

### Usage

```js
var DtsPackPlugin = require('dts-pack').DtsPackPlugin;

...
// in the configuration
{
  ...
  plugins: [
    new DtsPackPlugin({
      entry: 'index.ts',
      moduleName: 'myModule',
      headerText: function (data) {
        return 'Module \'' + data.moduleName + '\'';
      }
    })
  ]
}
```

... and **you need to set `declaration: true` option into the `tsconfig.json`** if `useProjectSources` is not `true`.

### Options (the first parameter of plugin's constructor)

All options passed to the constructor of `DtsPackPlugin` are the same name to the command-line parameters. In addition, if `entry` and `moduleName` are the same to the webpack configuration (`entry` value and the key name of `entry` object respectively), they can also be omitted. Other options below can be collected from webpack configuration if not specified:

- `outDir`: collected from `output.path`
- `project`: search `tsconfig.json` from the directory containing `entry` file
  - If specified `project` is but not an absolute path, and does not start with `./` or `../`, the file of `project` will be searched with the same process of the above search process of `tsconfig.json`.
- `rootName`: collected from `output.library`
- `forceDefineGlobal`: set to true if `output.libraryTarget` is `'var'` or unspecified

The additional options below can also be used for the plugin (all options are optional).

#### compilerOptions (ts.CompilerOptions)

Compiler options overwriting the options in the `tsconfig.json`. These options are only used for TypeScript compiler using in the plugin; some options (such as `declaration`, `removeComments`, `stripInternal`, etc.) are not effective.

If the module resolution is not working properly because of the difference of settings between webpack configuration and `tsconfig.json`, please use `compilerOptions` or `useTsModuleResolution` to resolve problems.

#### useProjectSources (boolean)

Specifies `true` if you want to use real source files in the project instead of emitted declaration files. This may cause slower buildings because the source files will be compiled twice.

Regardless of this option, the original emitted declaration files are removed from outputs
unless `keepIndividualDeclarations` is `true`.

#### useTsModuleResolution (boolean)

By default, the plugin uses module resolution methods from both [enhanced-resolve](https://github.com/webpack/enhanced-resolve), which webpack uses, and from TypeScript. Specifies `true` if you want to use the method from TypeScript only.

#### scriptPattern (RegExp)

The regular expression that represents the pattern of script file names. This option is only used when `useTsModuleResolution` is *not* `true`. Default is `/\.tsx?$/`.

#### keepIndividualDeclarations (boolean)

Specifies `true` if you want to keep the individual (emitted) declaration files for output.

## License

MIT License
