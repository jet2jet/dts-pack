import * as ts from 'typescript';

export default interface ExportData {
	/**
	 * For 'export = XXX' style, baseName is XXX.
	 * Otherwise baseName is undefined
	 * ('export default XXX' is treated as 'export { XXX as default }')
	 */
	baseName?: string;
	/**
	 * For 'export * from XXX' style, moduleName is XXX.
	 * Otherwise moduleName is undefined
	 */
	moduleName?: string;
	namedExports: {
		name: string;
		/**
		 * undefined if the base name is equal to 'name'
		 */
		baseName?: string;
		node: ts.Node;
	}[];
	node: ts.Statement;
}
