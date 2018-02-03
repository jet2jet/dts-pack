import * as ts from 'typescript';

export default function resolveModule(host: ts.CompilerHost, options: ts.CompilerOptions, resolutionCache: ts.ModuleResolutionCache, moduleName: string, baseFile: string): ts.ResolvedModule | null {
	if (host.resolveModuleNames) {
		const r = host.resolveModuleNames([moduleName], baseFile);
		return r.length && r[0] || null;
	} else {
		const r = ts.resolveModuleName(moduleName, baseFile, options, host, resolutionCache);
		return r.resolvedModule || null;
	}
}
