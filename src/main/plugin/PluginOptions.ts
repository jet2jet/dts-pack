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
	useProjectSources?: boolean;
}
