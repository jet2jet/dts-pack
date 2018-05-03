
/**
 * The data passed to HeaderFooterCallback.
 */
export default interface HeaderFooterOutputData {
	/** The file name to output */
	outputFileName: string;
	/** The base entry-point file name */
	entryFileName: string;
	/** The module name */
	moduleName: string;
	/** The configuration file for the project */
	projectFile: string;
}
