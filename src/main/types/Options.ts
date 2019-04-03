import * as ts from 'typescript';

import HeaderFooterCallback from './HeaderFooterCallback';

export default interface Options {
	/**
	 * The entry module name. Must be included in the project.
	 */
	entry: string;
	/**
	 * The output module name. Used for output file name ('<moduleName>.d.ts' or '<moduleName>/index.d.ts').
	 */
	moduleName: string;
	/**
	 * The export entity name in the entry module name (e.g. 'default').
	 * If empty, module itself will be used (such as 'export = require(entry)').
	 */
	export?: string | undefined;
	/**
	 * The project file (tsconfig.json) or directory (containing tsconfig.json).
	 * If empty, './tsconfig.json' will be used for command-line.
	 * For DtsPackPlugin, the project file is searched from the containing directory of
	 * the entry file, its parent directory, grandparent, etc.
	 */
	project?: string | undefined;
	/**
	 * The root variable name to expose or empty if no declaration is needed.
	 * If rootName contains '.', then the parent namespace also be declared.
	 */
	rootName?: string | undefined;
	/**
	 * The output directory name.
	 * If empty, './' will be used.
	 */
	outDir?: string | undefined;
	/**
	 * The declaration style.
	 *  - 'module': using 'declare module "XXX"' for all child modules.
	 *        This style emits two files named '<moduleName>/index.d.ts' and '<moduleName>/<moduleName>.d.ts'.
	 *  - 'namespace' : using 'declare namespace XXX' for all child modules.
	 *        This style emits one file named '<moduleName>.d.ts'.
	 * If empty, 'module' will be used.
	 */
	style?: 'module' | 'namespace' | undefined;
	/**
	 * The 'default' name for namespace-style.
	 * Default is '_default'.
	 */
	defaultName?: string | undefined;
	/**
	 * The identifier for binding modules with 'import'.
	 * For namespace-style, this is used for the prefix of identifier. (e.g. '__module1')
	 * Default is '__module'.
	 */
	importBindingName?: string | undefined;
	/**
	 * The compiler options for TypeScript.
	 * The project settings will be overrided by this options except for 'declaration'.
	 * (On this program, 'declaration' is always true.)
	 */
	compilerOptions?: ts.CompilerOptions;

	/**
	 * The boolean value whether exported entities are stripped when not used.
	 */
	stripUnusedExports?: boolean | undefined;
	/**
	 * The boolean value to define global export variable forcely.
	 * This setting does not affect if `rootName` contains '.'.
	 * For DtsPackPlugin, if 'output.libraryTarget' is 'var' (or unspecified),
	 * this value is treated as true.
	 */
	forceDefineGlobal?: boolean;

	/**
	 * Header text data for output files, or callback function which returns the header text.
	 * If the string data is specified, following text are replaced:
	 *   [name]    --> the basename of the output file name
	 *   [module]  --> moduleName of the option
	 *   [year]    --> the full year value of the build date
	 *   [year2]   --> last 2-digit of the full year value of the build date
	 *   [month]   --> the month value (1 to 12) of the build date
	 *   [month2]  --> the 2-digit month value (01 to 12) of the build date
	 *   [day]     --> the day value (1 to 31) of the build date
	 *   [day2]    --> the 2-digit day value (01 to 31) of the build date
	 */
	headerText?: string | null | undefined | HeaderFooterCallback;
	/**
	 * Footer text data for output files, or callback function which returns the footer text.
	 * The replacement rules for 'headerText' are also applied to 'footerText'.
	 */
	footerText?: string | null | undefined | HeaderFooterCallback;
	/**
	 * If true, headerText and footerText are emitted without comment block.
	 */
	isHeaderFooterRawText?: boolean | undefined;
	/**
	 * The callback function to generate child module name (useful for strip internal directory name).
	 * \`${moduleName}/${childName}\` is used for default.
	 */
	childModuleNameConverter?(moduleName: string, childName: string, resolvedFileName: string): string;

	// (for command-line option)
	list?: boolean | undefined;
}
