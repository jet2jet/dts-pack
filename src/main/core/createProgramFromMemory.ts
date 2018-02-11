import * as ts from 'typescript';
import * as path from 'path';

class CompilerHostForMemoryFiles implements ts.CompilerHost {
	writeFile: ts.WriteFileCallback;
	private files: { [fileName: string]: string };
	private baseHost: ts.CompilerHost;

	constructor(files: { [fileName: string]: string }, baseHost: ts.CompilerHost) {
		this.files = files;
		this.baseHost = baseHost;
		this.writeFile = baseHost.writeFile;
	}

	getSourceFile(fileName: string, languageVersion: ts.ScriptTarget, onError?: ((message: string) => void) | undefined, shouldCreateNewSourceFile?: boolean | undefined): ts.SourceFile | undefined {
		const f = path.resolve(fileName);
		const source = this.files[f];
		if (typeof (source) === 'string') {
			return ts.createSourceFile(fileName, source, languageVersion);
		}
		return this.baseHost.getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile);
	}
	getDefaultLibFileName(options: ts.CompilerOptions): string {
		return this.baseHost.getDefaultLibFileName(options);
	}
	getCurrentDirectory(): string {
		return this.baseHost.getCurrentDirectory();
	}
	getDirectories(path: string): string[] {
		return this.baseHost.getDirectories(path);
	}
	getCanonicalFileName(fileName: string): string {
		return this.baseHost.getCanonicalFileName(fileName);
	}
	useCaseSensitiveFileNames(): boolean {
		return this.baseHost.useCaseSensitiveFileNames();
	}
	getNewLine(): string {
		return this.baseHost.getNewLine();
	}
	fileExists(fileName: string): boolean {
		const f = path.resolve(fileName);
		const source = this.files[f];
		if (typeof (source) === 'string') {
			return true;
		}
		return this.baseHost.fileExists(fileName);
	}
	readFile(fileName: string): string | undefined {
		const f = path.resolve(fileName);
		const source = this.files[f];
		if (typeof (source) === 'string') {
			return source;
		}
		return this.baseHost.readFile(fileName);
	}
}

export default function createProgramFromMemory(
	files: { [fileName: string]: string },
	compilerOptions: ts.CompilerOptions,
	host: ts.CompilerHost,
	oldProgram?: ts.Program
): ts.Program {
	const newHost = new CompilerHostForMemoryFiles(files, host);
	return ts.createProgram(Object.keys(files), compilerOptions, newHost, oldProgram);
}
