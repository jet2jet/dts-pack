import Options from '../types/Options';

export type OptionsWithAllOptionals = {
	[P in keyof Options]?: Options[P] | undefined;
};
export type OptionsRequiredForPluginOptions = {
};
export type OptionsBase = OptionsWithAllOptionals & OptionsRequiredForPluginOptions;

export default interface PluginOptions extends OptionsBase {
	/**
	 * true if using source files in the project file instead of emitting declaration files.
	 * (even if useProjectSources is true, other emitting declaration files will be removed)
	 */
	useProjectSources?: boolean | undefined;
	/**
	 * true if using module resolution method from TypeScript only.
	 * By default, the plugin uses enhanced-resolve with webpack configuration for module resolution.
	 */
	useTsModuleResolution?: boolean | undefined;
	/**
	 * The regular expression that represents the pattern of script file names.
	 * Only used when 'useTsModuleResolution' is not true.
	 * Default is /\.tsx?$/
	 */
	scriptPattern?: RegExp;
	/**
	 * If true, the source declaration files will also be emitted.
	 */
	keepIndividualDeclarations?: boolean | undefined;
}
