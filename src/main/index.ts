import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as editorconfig from 'editorconfig';

import EditorConfig from './types/EditorConfig';
import Options from './types/Options';

import createProgramFromMemory from './core/createProgramFromMemory';
import gatherAllDeclarations from './core/gatherAllDeclarations';
import getFormatDiagnosticHost from './core/getFormatDiagnosticHost';

import isEqualPath from './utils/isEqualPath';

import outputFiles from './packer/outputFiles';
import printImportsAndExports from './packer/printImportsAndExports';

import DtsPackPlugin from './plugin/DtsPackPlugin';

////////////////////////////////////////////////////////////////////////////////

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
	checkInputs?: boolean,
	resolverFactory?: (options: Options, compilerOptions: ts.CompilerOptions, host: ts.CompilerHost, resolutionCache: ts.ModuleResolutionCache) => (
		(moduleNames: string[], containingFile: string, reusedNames?: string[]) => (ts.ResolvedModule | undefined)[]
	)
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

	if (resolverFactory) {
		host.resolveModuleNames = resolverFactory(options, compilerOptions, host, resolutionCache);
	}

	const program = ts.createProgram(inputFiles && Object.keys(inputFiles).length > 0 ? [] : r.fileNames, compilerOptions, host);
	const decls = gatherAllDeclarations(inputFiles, program, projectFile, compilerOptions, checkInputs);
	if (decls.hasError) {
		throw ts.formatDiagnostics(decls.diagnostics, getFormatDiagnosticHost());
	}

	const newProgram = createProgramFromMemory(decls.files, compilerOptions, host, program);
	const files = (() => {
		const baseFiles = Object.keys(decls.files);
		return newProgram.getSourceFiles().filter((file) => {
			return baseFiles.some((f) => isEqualPath(file.fileName, f));
		});
	})();

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
		printImportsAndExports(
			messageWriter,
			options,
			econf,
			projectFile,
			files,
			host,
			compilerOptions,
			resolutionCache,
			newProgram
		);
		return {
			files: {},
			warnings
		};
	} else {
		const x = outputFiles(
			options,
			econf,
			projectFile,
			files,
			host,
			compilerOptions,
			resolutionCache,
			newProgram
		);
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
