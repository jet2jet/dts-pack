import * as path from 'path';
import * as ts from 'typescript';

import EditorConfig from '../types/EditorConfig';
import ExportDataMap from '../types/ExportDataMap';
import ExternalImportData from '../types/ExternalImportData';
import HeaderFooterCallback from '../types/HeaderFooterCallback';
import HeaderFooterOutputData from '../types/HeaderFooterOutputData';
import GlobalDeclarationData from '../types/GlobalDeclarationData';
import ImportsAndExports from '../types/ImportsAndExports';
import Options from '../types/Options';

import isEqualPath from '../utils/isEqualPath';
import pickupRootPath from '../utils/pickupRootPath';

import collectImportsAndExports from '../core/collectImportsAndExports';
import collectUnusedSymbols from '../core/collectUnusedSymbols';
import pickupUnusedExports from '../core/pickupUnusedExports';

import getIdentifierName from './getIdentifierName';
import getNamespaceName from './getNamespaceName';
import makeChildModule from './makeChildModule';
import rebuildAST from './rebuildAST';

function isEqualEntryFile(source: ts.SourceFile, entryFileName: string): boolean {
	let f = source.fileName;
	if (isEqualPath(f, entryFileName))
		return true;
	let r;
	if ((r = /\.d(\.ts)$/i.exec(f))) {
		f = f.substr(0, f.length - r[0].length) + r[1];
		if (isEqualPath(f, entryFileName))
			return true;
	}
	const p = path.parse(path.normalize(f));
	p.ext = '';
	p.base = '';
	return isEqualPath(path.format(p), entryFileName);
}

function determineBaseModulePath(_entryBasePath: string, sourceFiles: ReadonlyArray<ts.SourceFile>) {
	if (!sourceFiles.length) {
		return '';
	}
	return sourceFiles.reduce<string | null>((prev, current) => {
		const dirName = path.dirname(path.normalize(current.fileName));
		if (prev === null) {
			return dirName;
		}
		if (!prev) {
			return prev;
		}
		return pickupRootPath(prev, dirName);
	}, null)!;
}

function createDefaultHeaderFooterCallback(text: string): HeaderFooterCallback {
	return (data) => {
		const now = new Date();
		const outputName = path.basename(data.outputFileName);
		return text.replace(/\[([A-Za-z0-9\_\-]+?)\]/g, (substring, p1: string) => {
			switch (true) {
				case p1 === 'name':
					return outputName;
				case p1 === 'module':
					return data.moduleName;
				case p1 === 'year':
					return now.getFullYear().toString();
				case p1 === 'year2':
					return now.getFullYear().toString().substr(-2, 2);
				case p1 === 'month':
					return (now.getMonth() + 1).toString();
				case p1 === 'month2':
					return ('0' + (now.getMonth() + 1).toString()).substr(-2, 2);
				case p1 === 'day':
					return now.getDate().toString();
				case p1 === 'day2':
					return ('0' + now.getDate().toString()).substr(-2, 2);
			}
			return substring;
		});
	};
}

function getHeaderFooterText(
	isHeader: boolean,
	callback: HeaderFooterCallback | null | undefined,
	data: HeaderFooterOutputData,
	isRaw?: boolean | undefined
): string[] {
	if (!callback)
		return [];
	let d = callback(data);
	if (d === null || typeof d === 'undefined')
		return [];
	d = '' + d;
	return isRaw ? [d] : [isHeader ? '/*!' : '/*'].concat(
		d.toString().replace(/\r\n/mg, '\n').split(/[\r\n]/g).map(
			(s) => ` * ${s}`.replace(/\s*$/g, '')
		)
	).concat(' */');
}

export default function outputFiles(
	options: Options,
	econf: EditorConfig,
	projectFile: string,
	sourceFiles: ReadonlyArray<ts.SourceFile>,
	host: ts.CompilerHost,
	compilerOptions: ts.CompilerOptions,
	resolutionCache: ts.ModuleResolutionCache,
	program: ts.Program
): { files: { [fileName: string]: string }, warnings: string } {
	const baseUrl = compilerOptions.baseUrl || '.';
	const entryBasePath = path.resolve(path.dirname(projectFile), baseUrl);
	const basePath = determineBaseModulePath(entryBasePath, sourceFiles);
	const entryFileName = path.resolve(entryBasePath, options.entry);
	const outDir = options.outDir || './';
	let warnings = '';
	const files: { [fileName: string]: string } = {};

	if (!sourceFiles.some((src) => isEqualEntryFile(src, entryFileName))) {
		throw `dts-pack: ERROR: entry file '${options.entry}' is not found.`;
	}
	const printer = ts.createPrinter({
		newLine: ts.NewLineKind.LineFeed
	});

	let stripUnusedExports: ExportDataMap | undefined;
	if (options.stripUnusedExports) {
		const map: { [fileName: string]: ImportsAndExports } = {};
		sourceFiles.forEach((file) => {
			const rx = collectImportsAndExports(file);
			map[path.resolve(file.fileName)] = rx;
		});
		stripUnusedExports = pickupUnusedExports(
			entryFileName,
			options.export,
			map,
			host,
			compilerOptions,
			resolutionCache
		);

		sourceFiles = sourceFiles.filter((file) => {
			const fileName = path.resolve(file.fileName);
			let a = stripUnusedExports![fileName];

			if (a) {
				const unusedSymbols = collectUnusedSymbols(file, program.getTypeChecker(), a);
				a = a.filter((exp) => {
					exp.namedExports = exp.namedExports.filter((x) => {
						const s = x.baseName || x.name;
						return unusedSymbols.some((sym) => sym === s);
					});
					return exp.namedExports.length > 0;
				});
				if (!a.length) {
					delete stripUnusedExports![fileName];
					return true;
				}
				stripUnusedExports![fileName] = a;
			}

			return !a || a.length !== map[fileName]!.exports.length;
		});
	}

	const headerCallback = (typeof options.headerText === 'string' ?
		createDefaultHeaderFooterCallback(options.headerText) :
		options.headerText);
	const footerCallback = (typeof options.footerText === 'string' ?
		createDefaultHeaderFooterCallback(options.footerText) :
		options.footerText);

	if (options.style !== 'namespace') {
		const mainDeclFileName = path.join(outDir, options.moduleName, `index.d.ts`);
		const childDeclFileName = path.join(outDir, options.moduleName, `${options.moduleName}.d.ts`);
		const mainDeclOutputs: string[] = getHeaderFooterText(
			true,
			headerCallback,
			{
				entryFileName,
				moduleName: options.moduleName,
				projectFile,
				outputFileName: mainDeclFileName
			},
			options.isHeaderFooterRawText
		);
		const childDeclOutputs: string[] = getHeaderFooterText(
			true,
			headerCallback,
			{
				entryFileName,
				moduleName: options.moduleName,
				projectFile,
				outputFileName: childDeclFileName
			},
			options.isHeaderFooterRawText
		);
		let entryModule = '';
		sourceFiles.forEach((file) => {
			const m = makeChildModule(
				options,
				file,
				sourceFiles,
				basePath,
				options.moduleName,
				host,
				compilerOptions,
				resolutionCache,
				stripUnusedExports
			);
			if (m === null) {
				return;
			}
			childDeclOutputs.push(printer.printNode(ts.EmitHint.Unspecified, m.module, file));
			childDeclOutputs.push('');
			if (isEqualEntryFile(file, entryFileName)) {
				entryModule = m.name;
			}
		});
		const expFrom = options.export ? `.${options.export}` : '';
		const dummyModuleName = options.importBindingName || '__module';
		mainDeclOutputs.push(`/// <reference path='./${options.moduleName}.d.ts' />`);
		mainDeclOutputs.push('');
		mainDeclOutputs.push(`import ${dummyModuleName} = require('${entryModule}');`);
		mainDeclOutputs.push(`export = ${dummyModuleName}${expFrom};`);
		if (options.rootName) {
			const parentNamespaces = options.rootName.split('.');
			const targetNamespace = parentNamespaces.splice(parentNamespaces.length - 1, 1)[0];
			if (parentNamespaces.length > 0) {
				mainDeclOutputs.push('');
				mainDeclOutputs.push('declare global {');
				mainDeclOutputs.push(`    namespace ${parentNamespaces.join('.')} {`);
				mainDeclOutputs.push(`        export import ${targetNamespace} = ${dummyModuleName}${expFrom};`);
				mainDeclOutputs.push('    }');
				mainDeclOutputs.push('}');
			} else {
				mainDeclOutputs.push(`export as namespace ${targetNamespace};`);
				if (options.forceDefineGlobal) {
					mainDeclOutputs.push('');
					mainDeclOutputs.push('declare global {');
					mainDeclOutputs.push(`    var ${targetNamespace}: typeof ${dummyModuleName}${expFrom};`);
					mainDeclOutputs.push('}');
				}
			}
		}
		mainDeclOutputs.push('');
		mainDeclOutputs.push.apply(
			mainDeclOutputs,
			getHeaderFooterText(
				false,
				footerCallback,
				{
					entryFileName,
					moduleName: options.moduleName,
					projectFile,
					outputFileName: mainDeclFileName
				},
				options.isHeaderFooterRawText
			)
		);
		childDeclOutputs.push.apply(
			childDeclOutputs,
			getHeaderFooterText(
				false,
				footerCallback,
				{
					entryFileName,
					moduleName: options.moduleName,
					projectFile,
					outputFileName: childDeclFileName
				},
				options.isHeaderFooterRawText
			)
		);

		files[childDeclFileName] = childDeclOutputs.join(econf.lineBreak);
		files[mainDeclFileName] = mainDeclOutputs.join(econf.lineBreak);
	} else {
		const declFileName = path.join(outDir, `${options.moduleName}.d.ts`);

		let outputs: string[] = [];

		const externalImportData: ExternalImportData = {
			modules: {},
			importedCount: 0
		};
		const allData = sourceFiles.map((file) => {
			const rx = collectImportsAndExports(file);
			return {
				sourceFile: file,
				data: rx
			};
		});
		const globals: GlobalDeclarationData[] = [];
		allData.forEach((d) => {
			const file = d.sourceFile;
			const st = rebuildAST(
				options,
				file,
				sourceFiles,
				basePath,
				allData,
				externalImportData,
				globals,
				host,
				program,
				compilerOptions,
				resolutionCache,
				stripUnusedExports
			);
			if (st) {
				st.parent = file;
				//statements.push(st);
				outputs.push(printer.printNode(ts.EmitHint.Unspecified, st, file));
			}
		});

		if (globals.length) {
			outputs = globals.map((d) => printer.printNode(ts.EmitHint.Unspecified, d.node, d.sourceFile))
				.concat('')
				.concat(outputs);
		}

		if (externalImportData.importedCount) {
			const modules = externalImportData.modules;
			outputs = Object.keys(modules).map((key) => {
				const m = modules[key];
				return `import * as ${m.name} from '${m.module}';`;
			}).concat('').concat(outputs);
		}

		let exportName: string;
		if (options.export) {
			exportName = `${getNamespaceName(basePath, entryFileName, options)}.${getIdentifierName(options.export, options)}`;
		} else {
			exportName = getNamespaceName(basePath, entryFileName, options);
		}
		outputs.push(`export = ${exportName};`);

		if (options.rootName) {
			const parentNamespaces = options.rootName.split('.');
			const targetNamespace = parentNamespaces.splice(parentNamespaces.length - 1, 1)[0];
			if (parentNamespaces.length > 0) {
				outputs.push('');
				outputs.push('declare global {');
				outputs.push(`    namespace ${parentNamespaces.join('.')} {`);
				outputs.push(`        export import ${targetNamespace} = ${exportName};`);
				outputs.push('    }');
				outputs.push('}');
			} else {
				outputs.push(`export as namespace ${targetNamespace};`);
				if (options.forceDefineGlobal) {
					outputs.push('');
					outputs.push('declare global {');
					outputs.push(`    var ${targetNamespace}: typeof ${exportName};`);
					outputs.push('}');
				}
			}
		}
		outputs.push('');

		outputs = getHeaderFooterText(
			true,
			headerCallback,
			{
				entryFileName,
				moduleName: options.moduleName,
				projectFile,
				outputFileName: declFileName
			},
			options.isHeaderFooterRawText
		).concat(outputs);
		outputs = outputs.concat(getHeaderFooterText(
			false,
			footerCallback,
			{
				entryFileName,
				moduleName: options.moduleName,
				projectFile,
				outputFileName: declFileName
			},
			options.isHeaderFooterRawText
		));

		files[declFileName] = outputs.join(econf.lineBreak);
	}

	return { files, warnings };
}
