import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as editorconfig from 'editorconfig';

import EditorConfig from './types/EditorConfig';
import ExternalImportData from './types/ExternalImportData';
import GlobalDeclarationData from './types/GlobalDeclarationData';
import ImportsAndExports from './types/ImportsAndExports';
import Options from './types/Options';

import collectImportsAndExports from './core/collectImportsAndExports';
import getFormatDiagnosticHost from './core/getFormatDiagnosticHost';

import isChildPath from './utils/isChildPath';
import isEqualPath from './utils/isEqualPath';

import getIdentifierName from './packer/getIdentifierName';
import getNamespaceName from './packer/getNamespaceName';
import makeChildModule from './packer/makeChildModule';
import rebuildAST from './packer/rebuildAST';
import resolveModule from './packer/resolveModule';

import DtsPackPlugin from './plugin/DtsPackPlugin';

////////////////////////////////////////////////////////////////////////////////

function convertDeclFileNameToSourceFileName(compilerOptions: ts.CompilerOptions, projectFile: string, declFile: string): string {
	declFile = declFile.replace(/\.d(\.ts)$/i, '$1');

	let declOutDir = compilerOptions.declarationDir;
	if (typeof declOutDir === 'undefined') {
		declOutDir = compilerOptions.outDir;
		if (typeof declOutDir === 'undefined') {
			// output directory seems to be same as the project directory
			return path.resolve(path.dirname(projectFile), declFile);
		}
	}

	const baseUrl = compilerOptions.baseUrl || '.';
	const basePath = path.resolve(path.dirname(projectFile), baseUrl);
	declOutDir = path.resolve(basePath, declOutDir);
	if (!isChildPath(declOutDir, declFile)) {
		return declFile;
	}
	return path.resolve(basePath, path.relative(declOutDir, declFile));
}

function gatherAllDeclarations(
	inputFiles: { [fileName: string]: string } | undefined,
	tsProgram: ts.Program,
	projectFile: string,
	compilerOptions: ts.CompilerOptions,
	checkInputs?: boolean
): {
	files: ReadonlyArray<ts.SourceFile>,
	diagnostics: ReadonlyArray<ts.Diagnostic>,
	hasError: boolean
} {
	const r: ts.SourceFile[] = [];
	let diag: ts.Diagnostic[] = [];
	const writeFile: ts.WriteFileCallback = (
		fileName: string,
		data: string
	) => {
		if (!/\.d\.ts$/i.test(fileName)) {
			return;
		}
		// set source file to the original file name instead of declaration file
		const srcFileName = convertDeclFileNameToSourceFileName(compilerOptions, projectFile, fileName);
		r.push(ts.createSourceFile(srcFileName, data, compilerOptions.target || ts.ScriptTarget.ES5, true));
	};
	let inputFileNames: string[];
	if (inputFiles && (inputFileNames = Object.keys(inputFiles)).length > 0) {
		inputFileNames.forEach((name) => {
			if (checkInputs) {
				const src = ts.createSourceFile(name, inputFiles[name], compilerOptions.target || ts.ScriptTarget.ES5, true);
				const emitResult = tsProgram.emit(src, writeFile);
				diag = diag.concat(emitResult.diagnostics);
			} else {
				const srcFileName = convertDeclFileNameToSourceFileName(compilerOptions, projectFile, name);
				const src = ts.createSourceFile(srcFileName, inputFiles[name], compilerOptions.target || ts.ScriptTarget.ES5, true);
				r.push(src);
			}
		});
	} else {
		tsProgram.getSourceFiles().forEach((src) => {
			const emitResult = tsProgram.emit(src, writeFile);
			diag = diag.concat(emitResult.diagnostics);
		});
	}
	const hasError = diag.some((d) => d.category === ts.DiagnosticCategory.Error);
	return {
		files: diag.length > 0 ? [] : r,
		diagnostics: diag,
		hasError: hasError
	};
}

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

function isEqualEntryFile(source: ts.SourceFile, entryFileName: string): boolean {
	if (isEqualPath(source.fileName, entryFileName))
		return true;
	const p = path.parse(path.normalize(source.fileName));
	p.ext = '';
	p.base = '';
	return isEqualPath(path.format(p), entryFileName);
}

function printImportsAndExports(
	messageWriter: (text: string) => void,
	_options: Options,
	econf: EditorConfig,
	_projectFile: string,
	sourceFiles: ReadonlyArray<ts.SourceFile>,
	host: ts.CompilerHost,
	compilerOptions: ts.CompilerOptions,
	resolutionCache: ts.ModuleResolutionCache
) {
	//writer(`Files: ${sourceFiles.map((src) => src.fileName).join(econf.lineBreak + '  ')}:`);

	sourceFiles.forEach((file) => {
		const rx = collectImportsAndExports(file);
		outputImportsAndExports(messageWriter, econf, host, compilerOptions, resolutionCache, file.fileName, rx);
		messageWriter('');
	});
}

function outputFiles(
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
	const basePath = path.resolve(path.dirname(projectFile), baseUrl);
	const entryFileName = path.resolve(basePath, options.entry);
	const outDir = options.outDir || './';
	let warnings = '';
	const files: { [fileName: string]: string } = {};

	if (!sourceFiles.some((src) => isEqualEntryFile(src, entryFileName))) {
		throw `tsd-pack: ERROR: entry file '${options.entry}' is not found.`;
	}
	//const outFile = ts.createSourceFile('test.d.ts', '', compilerOptions.target || ts.ScriptTarget.ES5, true);
	//const statements: ts.Statement[] = [];
	const printer = ts.createPrinter({
		newLine: ts.NewLineKind.LineFeed
	});

	if (options.style !== 'namespace') {
		const childDeclOutputs: string[] = [];
		let entryModule = '';
		sourceFiles.forEach((file) => {
			const m = makeChildModule(
				options,
				file,
				basePath,
				options.moduleName,
				host,
				compilerOptions,
				resolutionCache
			);
			childDeclOutputs.push(printer.printNode(ts.EmitHint.Unspecified, m.module, file));
			childDeclOutputs.push('');
			if (isEqualEntryFile(file, entryFileName)) {
				entryModule = m.name;
			}
		});
		const mainDeclOutputs: string[] = [];
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
			}
		}
		mainDeclOutputs.push('');

		files[path.join(outDir, options.moduleName, `${options.moduleName}.d.ts`)] = childDeclOutputs.join(econf.lineBreak);
		files[path.join(outDir, options.moduleName, `index.d.ts`)] = mainDeclOutputs.join(econf.lineBreak);
	} else {
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
				basePath,
				allData,
				externalImportData,
				globals,
				host,
				program,
				compilerOptions,
				resolutionCache
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
			}
		}
		outputs.push('');

		files[path.join(outDir, `${options.moduleName}.d.ts`)] = outputs.join(econf.lineBreak);
	}

	return { files, warnings };
}

/**
 * Executes packing for specified file data.
 * @param messageWriter the callback function for logging (used when options.list is true)
 * @param options options for packing
 * @param inputFiles input file data (each key is a file name and value is an entire content)
 *                   If no files are specified, uses source files in the TypeScript project..
 * @param checkInputs if true, executes the emit process of TypeScript
 * @return output files and warning messages
 * @throws string for error messages or Error object otherwise
 */
export function runWithFiles(
	messageWriter: (text: string) => void,
	options: Options,
	inputFiles?: { [fileName: string]: string },
	checkInputs?: boolean
): { files: { [fileName: string]: string }, warnings: string } {
	let projectFile: string;
	if (!options.project) {
		projectFile = './tsconfig.json';
	} else {
		projectFile = options.project;
		if (fs.statSync(projectFile).isDirectory()) {
			projectFile = path.resolve(projectFile, 'tsconfig.json');
		}
	}

	const conf = ts.readConfigFile(projectFile, (path) => fs.readFileSync(path, 'utf8'));
	if (conf.error) {
		throw ts.formatDiagnostic(conf.error, getFormatDiagnosticHost());
	}

	const r = ts.parseJsonConfigFileContent(conf.config, ts.sys, path.dirname(projectFile));
	if (r.errors && r.errors.length) {
		throw ts.formatDiagnostics(r.errors, getFormatDiagnosticHost());
	}

	let compilerOptions = r.options;
	if (options.compilerOptions) {
		compilerOptions = Object.assign({}, compilerOptions, options.compilerOptions);
	}
	compilerOptions.declaration = true;
	const host = ts.createCompilerHost(compilerOptions);
	const resolutionCache = ts.createModuleResolutionCache(process.cwd(), (file) => host.getCanonicalFileName(file));
	const program = ts.createProgram(inputFiles && Object.keys(inputFiles).length > 0 ? [] : r.fileNames, compilerOptions, host);
	const decls = gatherAllDeclarations(inputFiles, program, projectFile, compilerOptions, checkInputs);
	if (decls.hasError) {
		throw ts.formatDiagnostics(decls.diagnostics, getFormatDiagnosticHost());
	}

	let warnings = '';
	if (decls.diagnostics && decls.diagnostics.length) {
		warnings = ts.formatDiagnostics(decls.diagnostics, getFormatDiagnosticHost());
	}

	let econf: EditorConfig;
	try {
		const theEditorConfig = editorconfig.parseSync(projectFile);
		if (!theEditorConfig) {
			throw new Error();
		}
		let lineBreak: string;
		switch (theEditorConfig.end_of_line) {
			case 'lf':
				lineBreak = '\n';
				break;
			case 'crlf':
			// fall-through
			default:
				lineBreak = '\r\n';
				break;
		}
		econf = {
			lineBreak
		};
	} catch {
		econf = {
			lineBreak: '\r\n'
		};
	}

	if (options.list) {
		printImportsAndExports(messageWriter, options, econf, projectFile, decls.files, host, compilerOptions, resolutionCache);
		return {
			files: {},
			warnings
		};
	} else {
		const x = outputFiles(options, econf, projectFile, decls.files, host, compilerOptions, resolutionCache, program);
		return {
			files: x.files,
			warnings: warnings + x.warnings
		};
	}
}

/**
 * Executes packing for project files.
 * @param messageWriter the callback function for logging (used when options.list is true)
 * @param options options for packing
 * @return output files and warning messages
 * @throws string for error messages or Error object otherwise
 */
export function run(messageWriter: (text: string) => void, options: Options): { files: { [fileName: string]: string }, warnings: string } {
	return runWithFiles(messageWriter, options, {});
}

export { DtsPackPlugin };
