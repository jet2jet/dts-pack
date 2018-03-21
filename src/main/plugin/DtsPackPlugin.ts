import * as webpack from 'webpack';
import * as path from 'path';

import { runWithFiles } from '../index';

import PluginOptions from './PluginOptions';

import createResolverFactoryFunc from './createResolverFactory';

declare module 'webpack' {
	// simple declaration for webpack 4.x
	interface Compiler {
		hooks?: {
			[eventName: string]: {
				tap(name: string, fn: Function): void;
				tap(options: object, fn: Function): void;
				tapAsync(name: string, fn: Function): void;
				tapAsync(options: object, fn: Function): void;
			}
		};
		context?: string;
	}
}

type ComputedPluginOptions = PluginOptions & {
	entry: string;
	moduleName: string;
	outDir: string;
};

interface WebpackAsset {
	source(): string;
	size(): number;
}

interface WebpackCompilation {
	assets: { [fileName: string]: WebpackAsset };
	compiler: webpack.Compiler;
	[key: string]: any;
}

function computeOptions(options: PluginOptions, conf: webpack.Configuration): Promise<ComputedPluginOptions> {
	return (() => { // returns (options.entry || conf.entry) with Promise
		if (options.entry) {
			return Promise.resolve(options.entry);
		}
		const e = conf.entry;
		if (typeof (e) === 'function') {
			// e: webpack.EntryFunc (since webpack 3)
			const func = e as (() => (string | string[] | webpack.Entry | Promise<string | string[] | webpack.Entry>));
			const p = func();
			if (p instanceof Promise) {
				return p;
			}
			return Promise.resolve(p);
		}
		return Promise.resolve(e);
	})().then((v: string | string[] | webpack.Entry | undefined) => {
		// compute entry and moduleName
		let moduleName: string | undefined = options.moduleName;
		if (!(v instanceof Array) && typeof (v) === 'object') {
			// v: webpack.Entry
			const keys = Object.keys(v);
			if (keys.length === 1) {
				// 'entry: { <moduleName>: <entry-point> }'
				if (!moduleName) {
					moduleName = keys[0];
				}
				v = v[keys[0]];
			} else if (moduleName && v[moduleName]) {
				v = v[moduleName];
			} else {
				throw new Error(`DtsPackPlugin: Multiple entry point is not allowed. Please specify 'entry' explicitly to the plugin option.`);
			}
		}
		if (v instanceof Array) {
			// use last one (webpack exports only the last item)
			v = v.pop();
		}
		if (typeof (v) === 'string') {
			// fail if moduleName is not specified or detected
			if (!moduleName) {
				throw new Error(`DtsPackPlugin: Cannot determine module name; please specify 'moduleName' to the plugin option.`);
			}

			// entry name may be relative path 
			const entry = path.resolve(v);
			// compute outDir from 'output.path' (if not specified, './' will be used)
			const outDir = options.outDir || (conf.output && conf.output.path) || './';
			// compute rootName from 'output.library' (if options.rootName is not specified)
			let rootName = options.rootName;
			if (!rootName && conf.output && conf.output.library) {
				const l = conf.output.library as (string | string[]);
				if (l instanceof Array) {
					// (since webpack 3)
					rootName = l.join('.');
				} else {
					rootName = l;
				}
			}
			return Object.assign({},
				options,
				{
					outDir: outDir,
					entry: entry,
					moduleName: moduleName,
					rootName: rootName
				}
			);
		}
		throw new Error(`DtsPackPlugin: Cannot determine entry name; please specify 'entry' to the plugin option.`);
	});
}

export default class DtsPackPlugin {
	private options: PluginOptions;

	constructor(options: PluginOptions = {}) {
		this.options = options;
	}

	public apply(compiler: webpack.Compiler) {
		const createResolverFactory: typeof createResolverFactoryFunc = require('./createResolverFactory').default;

		const emitCallback = (compilation: WebpackCompilation, callback: (err?: any) => void) => {
			computeOptions(this.options, compiler.options || {})
				.then((opts) => {
					const inputFiles: { [fileName: string]: string } = {};
					let fileCount = 0;

					Object.keys(compilation.assets).forEach((fileName) => {
						if (/\.d\.ts$/i.test(fileName)) {
							const asset = compilation.assets[fileName];
							inputFiles[path.resolve(compilation.compiler.context || '', fileName)] = asset.source();
							++fileCount;
							delete compilation.assets[fileName];
						}
					});

					if (!opts.useProjectSources && fileCount === 0) {
						// do nothing
					} else {
						const r = runWithFiles(
							this.messageWriter.bind(this),
							opts,
							opts.useProjectSources ? {} : inputFiles,
							false,
							createResolverFactory(this.options, (compiler.options && compiler.options.resolve) || {})
						);
						if (r.warnings && console.warn) {
							console.warn(r.warnings);
						}
						const newFiles = Object.keys(r.files);
						newFiles.forEach((file) => {
							const asset = ((src: string): WebpackAsset => {
								return {
									source: () => src,
									size: () => src.length
								};
							})(r.files[file]);
							compilation.assets[path.relative(opts.outDir, file)] = asset;
						});
					}
					callback();
				})
				.catch((e) => {
					// callback must be called outside the 'catch' callback
					// since the 'callback' may throw the error 'e' and
					// the Promise will catch it
					setImmediate(() => {
						callback(e);
					});
				});
		};
		if (compiler.hooks) {
			compiler.hooks.emit.tapAsync('dts-pack', emitCallback);
		} else {
			compiler.plugin('emit', emitCallback);
		}
	}

	private messageWriter(text: string) {
		if (console.log) {
			console.log(text);
		}
	}
}
