import * as ts from 'typescript';

export default interface GlobalDeclarationData {
	sourceFile: ts.SourceFile;
	node: ts.ModuleDeclaration;
}
