import * as ts from 'typescript';

export default interface ImportData {
	/**
	 * undefined if no bindings are specified (e.g. 'import "module-name"';)
	 */
	name?: string;
	/**
	 * undefined if no bindings are specified (e.g. 'import "module-name"';) or
	 * import alias declaration (e.g. 'import XXX = <module-specifier>')
	 * - for 'import XXX from "module-name"', fromName will be 'default'
	 * - for 'import * as XXX from "module-name"', fromName will be '*'
	 */
	fromName?: string;
	module: string;
	node: ts.Node;
}
