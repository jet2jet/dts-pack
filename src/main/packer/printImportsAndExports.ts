import * as path from 'path';
import * as ts from 'typescript';

import EditorConfig from '../types/EditorConfig';
import ImportsAndExports from '../types/ImportsAndExports';
import Options from '../types/Options';

import collectImportsAndExports from '../core/collectImportsAndExports';
import collectUnusedSymbols from '../core/collectUnusedSymbols';
import pickupUnusedExports from '../core/pickupUnusedExports';

import resolveModule from './resolveModule';

function outputImportsAndExports(
	messageWriter: (text: string) => void,
	_econf: EditorConfig,
	host: ts.CompilerHost,
	compilerOptions: ts.CompilerOptions,
	resolutionCache: ts.ModuleResolutionCache,
	fileName: string,
	data: ImportsAndExports
) {
	messageWriter(`File '${fileName}':`);
	messageWriter('  Imports:');
	data.imports.forEach((x) => {
		const resolved = resolveModule(host, compilerOptions, resolutionCache, x.module, fileName);
		if (resolved) {
			messageWriter(`    from '${x.module}' [${resolved.resolvedFileName}]:`);
		} else {
			messageWriter(`    from '${x.module}':`);
		}
		if (!x.name) {
			messageWriter('      (no bindings)');
		} else if (!x.fromName) {
			messageWriter(`      --> ${x.name} (alias)`);
		} else if (x.fromName === '*') {
			messageWriter(`      <as namespace> ${x.name}`);
		} else {
			messageWriter(`      ${x.fromName} --> ${x.name}`);
		}
	});
	messageWriter('  Exports:');
	data.exports.forEach((x) => {
		if (x.baseName) {
			messageWriter(`    = ${x.baseName}`);
		} else {
			let indent = '';
			if (x.moduleName) {
				const resolved = resolveModule(host, compilerOptions, resolutionCache, x.moduleName, fileName);
				if (resolved) {
					messageWriter(`    <from '${x.moduleName}' [${resolved.resolvedFileName}]>`);
				} else {
					messageWriter(`    <from '${x.moduleName}'>`);
				}
				indent = '  ';
			}
			if (!x.namedExports.length) {
				messageWriter(`    ${indent}*`);
			} else {
				x.namedExports.forEach((e) => {
					messageWriter(`    ${indent}${e.baseName || e.name} as ${e.name}`);
				});
			}
		}
	});
}

export default function printImportsAndExports(
	messageWriter: (text: string) => void,
	options: Options,
	econf: EditorConfig,
	projectFile: string,
	sourceFiles: ReadonlyArray<ts.SourceFile>,
	host: ts.CompilerHost,
	compilerOptions: ts.CompilerOptions,
	resolutionCache: ts.ModuleResolutionCache,
	program: ts.Program
) {
	//writer(`Files: ${sourceFiles.map((src) => src.fileName).join(econf.lineBreak + '  ')}:`);

	const map: { [fileName: string]: ImportsAndExports } = {};
	sourceFiles.forEach((file) => {
		const rx = collectImportsAndExports(file);
		map[path.resolve(file.fileName)] = rx;
		outputImportsAndExports(messageWriter, econf, host, compilerOptions, resolutionCache, file.fileName, rx);
		messageWriter('');
	});

	if (options.entry) {
		const baseUrl = compilerOptions.baseUrl || '.';
		const basePath = path.resolve(path.dirname(projectFile), baseUrl);
		const entryFileName = path.resolve(basePath, options.entry);
		const r = pickupUnusedExports(entryFileName, options.export, map, host, compilerOptions, resolutionCache);
		const retKeys = Object.keys(r);
		if (retKeys.length > 0) {
			messageWriter('Unused exports:');
			sourceFiles.forEach((sourceFile) => {
				const fileName = path.resolve(sourceFile.fileName);
				let a = r[fileName];
				if (a) {
					const unusedSymbols = collectUnusedSymbols(sourceFile, program.getTypeChecker(), a);
					a = a.filter((exp) => {
						exp.namedExports = exp.namedExports.filter((x) => {
							const s = x.baseName || x.name;
							return unusedSymbols.some((sym) => sym === s);
						});
						return exp.namedExports.length > 0;
					});
					if (a.length > 0) {
						messageWriter(`  ${fileName}:`);
						if (a.length === map[fileName]!.exports.length) {
							messageWriter('    <all exports are unused>');
						} else {
							a.forEach((x) => {
								x.namedExports.forEach((named) => {
									messageWriter(`    ${named.baseName || named.name}`);
								});
							});
						}
					}
				}
			});
		}
	}
}
