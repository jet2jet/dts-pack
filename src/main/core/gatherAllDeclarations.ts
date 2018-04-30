import * as path from 'path';
import * as ts from 'typescript';

import isChildPath from '../utils/isChildPath';

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

export default function gatherAllDeclarations(
	inputFiles: { [fileName: string]: string } | undefined,
	tsProgram: ts.Program,
	projectFile: string,
	compilerOptions: ts.CompilerOptions,
	checkInputs?: boolean
): {
		files: { [fileName: string]: string },
		diagnostics: ReadonlyArray<ts.Diagnostic>,
		hasError: boolean
	} {
	const r: { [fileName: string]: string } = {};
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
		r[srcFileName] = data;
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
				r[srcFileName] = inputFiles[name];
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
		files: diag.length > 0 ? {} : r,
		diagnostics: diag,
		hasError: hasError
	};
}
