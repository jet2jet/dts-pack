import * as path from 'path';
import * as ts from 'typescript';

class MyFormatDiagnosticsHost implements ts.FormatDiagnosticsHost {
	getCurrentDirectory(): string {
		return __dirname;
	}
	getCanonicalFileName(fileName: string): string {
		return path.resolve(__dirname, fileName);
	}
	getNewLine(): string {
		return '\n';
	}	
}

const host = new MyFormatDiagnosticsHost();

export default function getFormatDiagnosticHost(): ts.FormatDiagnosticsHost {
	return host;
}
