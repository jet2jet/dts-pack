import * as ts from 'typescript';
import * as path from 'path';

import ExportData from '../types/ExportData';
import ExportDataMap from '../types/ExportDataMap';
import ImportsAndExports from '../types/ImportsAndExports';
import resolveModule from '../packer/resolveModule';
import isEqualPath from '../utils/isEqualPath';

function cloneExportData(data: ExportData[]): ExportData[] {
	return data.map((x) => {
		return {
			baseName: x.baseName,
			moduleName: x.moduleName,
			node: x.node,
			namedExports: x.namedExports.map((named) => {
				return {
					name: named.name,
					baseName: named.baseName,
					node: named.node
				} as typeof named;
			})
		} as ExportData;
	});
}

export default function pickupUnusedExports(
	entryFile: string,
	entryExport: string | undefined,
	allData: { [fileName: string]: ImportsAndExports },
	host: ts.CompilerHost,
	compilerOptions: ts.CompilerOptions,
	resolutionCache: ts.ModuleResolutionCache
): ExportDataMap {
	const ret: ExportDataMap = {};
	Object.keys(allData).forEach((fileName) => {
		if (isEqualPath(entryFile, fileName)) {
			entryFile = fileName;
		}
		ret[fileName] = cloneExportData(allData[fileName]!.exports);
	});

	const usedDataFileNames: string[] = [];
	const usedDataExports: ExportDataMap = {};

	const processUsingData = (targetFileName: string, fromName: string | undefined): boolean => {
		const d = ret[targetFileName];
		if (!d) {
			return false;
		}
		if (typeof (fromName) === 'undefined' || fromName === '*') {
			// all exports are 'used'
			usedDataFileNames.push(targetFileName);
			usedDataExports[targetFileName] = d;
			ret[targetFileName] = [];
			return true;
		} else {
			for (let i = d.length - 1; i >= 0; --i) {
				const x = d[i];
				let usedExports: typeof x.namedExports = [];
				for (let j = x.namedExports.length - 1; j >= 0; --j) {
					const named = x.namedExports[j];
					if (named.name === fromName) {
						usedExports = usedExports.concat(x.namedExports.splice(j, 1));
						//break;
					}
				}
				if (usedExports.length > 0) {
					const base = usedDataExports[targetFileName];
					if (!x.namedExports.length) {
						const a = d.splice(i, 1);
						a[0].namedExports = usedExports;
						if (base) {
							usedDataExports[targetFileName] = base.concat(a);
						} else {
							usedDataFileNames.push(targetFileName);
							usedDataExports[targetFileName] = a
						}
					} else {
						const newData = {
							moduleName: x.moduleName,
							baseName: x.baseName,
							node: x.node,
							namedExports: usedExports
						};
						if (base) {
							usedDataExports[targetFileName] = base.concat(newData);
						} else {
							usedDataFileNames.push(targetFileName);
							usedDataExports[targetFileName] = [newData];
						}
					}
					return true;
				}
			}
			return false;
		}
	};

	if (!processUsingData(entryFile, entryExport)) {
		return {};
	}

	let lastUsedDataKeyIndex = 0;
	while (true) {
		let changed = false;
		let i = lastUsedDataKeyIndex;
		lastUsedDataKeyIndex = usedDataFileNames.length;
		for (; i < usedDataFileNames.length; ++i) {
			const fileName = usedDataFileNames[i];
			//console.log(`* pickupUnusedExports [current = ${fileName}]`);
			// walk all imports in the file marked 'used'
			// and pick up using modules/exports
			const data = allData[fileName];
			data.imports.forEach((imp) => {
				if (imp.name) {
					//console.log(`  * import: name: ${imp.name}, module: ${imp.module}, fromName: ${imp.fromName}`);
					const importModule = resolveModule(host, compilerOptions, resolutionCache, imp.module, fileName.replace(/\\/g, '/'));
					if (importModule) {
						const importFileName = path.resolve(importModule.resolvedFileName);
						//console.log(`  * import file: ${importFileName}`);
						if (allData[importFileName]) {
							if (processUsingData(importFileName, imp.fromName)) {
								changed = true;
							}
						}
					}
				}
			});
			data.exports.forEach((exp) => {
				if (exp.moduleName) {
					//console.log(`  * export-from: module: ${exp.moduleName}`);
					const importModule = resolveModule(host, compilerOptions, resolutionCache, exp.moduleName, fileName.replace(/\\/g, '/'));
					if (importModule) {
						const importFileName = path.resolve(importModule.resolvedFileName);
						//console.log(`  * import file: ${importFileName}`);
						if (allData[importFileName]) {
							if (processUsingData(importFileName, void (0))) {
								changed = true;
							}
						}
					}
				}
			});
		}
		if (!changed) {
			break;
		}
	}
	Object.keys(ret).forEach((s) => {
		const a = ret[s]!;
		if (a.length === 0) {
			delete ret[s];
		}
	});
	return ret;
}
