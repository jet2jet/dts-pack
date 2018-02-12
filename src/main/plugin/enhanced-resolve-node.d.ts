
declare module 'enhanced-resolve/lib/common-types2' {
	import Resolver = require('enhanced-resolve/lib/Resolver');
	import {
		AbstractInputFileSystem,
		ResolverRequest
	} from 'enhanced-resolve/lib/common-types';
	import { Dictionary } from 'enhanced-resolve/lib/concord';

	export interface OptionsWithoutFS {
		modules?: string[] | undefined;
		descriptionFiles?: string[] | undefined;
		plugins?: any[] | undefined;
		mainFields?: string[] | undefined;
		aliasFields?: string[] | undefined;
		mainFiles?: string[] | undefined;
		extensions?: string[] | undefined;
		enforceExtension?: boolean | undefined;
		moduleExtensions?: string[] | undefined;
		enforceModuleExtension?: boolean | undefined;
		alias?: { [key: string]: string } | undefined;
		symlinks?: boolean | undefined;
		resolveToContext?: boolean | undefined;
		unsafeCache?: boolean | Dictionary<any> | undefined;
		cacheWithContext?: boolean | undefined;
		cachePredicate?: ((request: ResolverRequest) => boolean) | undefined;
		useSyncFileSystemCalls?: boolean | undefined;
		resolver?: Resolver | undefined;
	}
	export interface Options extends OptionsWithoutFS {
		fileSystem: AbstractInputFileSystem;
	}
}

declare module 'enhanced-resolve/lib/node' {
	import {
		LoggingCallbackWrapper,
		ResolveContext
	} from 'enhanced-resolve/lib/common-types';
	import { OptionsWithoutFS } from 'enhanced-resolve/lib/common-types2';

	function resolve(context: ResolveContext, path: string, request: string, callback: LoggingCallbackWrapper): void;
	function resolve(path: string, request: string, callback: LoggingCallbackWrapper): void;

	namespace resolve {
		export function sync(context: ResolveContext, path: string, request: string): string;
		export function sync(path: string, request: string): string;

		function context(context: ResolveContext, path: string, request: string, callback: LoggingCallbackWrapper): void;
		function context(path: string, request: string, callback: LoggingCallbackWrapper): void;
		namespace context {
			export function sync(context: ResolveContext, path: string, request: string): string;
			export function sync(path: string, request: string): string;
		}
	
		function loader(context: ResolveContext, path: string, request: string, callback: LoggingCallbackWrapper): void;
		function loader(path: string, request: string, callback: LoggingCallbackWrapper): void;
		namespace loader {
			export function sync(context: ResolveContext, path: string, request: string): string;
			export function sync(path: string, request: string): string;
		}

		interface CreateResolverOptions extends OptionsWithoutFS {
		}
		export interface ResolveFunction {
			(context: ResolveContext, path: string, request: string, callback: LoggingCallbackWrapper): void;
			(path: string, request: string, callback: LoggingCallbackWrapper): void;
		}
		export interface ResolveSyncFunction {
			(context: ResolveContext, path: string, request: string): string;
			(path: string, request: string): string;
		}

		function create(options: resolve.CreateResolverOptions): ResolveFunction;
		namespace create {
			export function sync(options: resolve.CreateResolverOptions): ResolveSyncFunction;
		}
	}

	export = resolve;
}
