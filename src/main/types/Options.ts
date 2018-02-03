import * as ts from 'typescript';

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
	 * If empty, './tsconfig.json' will be used.
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

	list?: boolean | undefined;
}
