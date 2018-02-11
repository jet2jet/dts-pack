import * as ts from 'typescript';

export default function mapEntityWithName<T>(
	mapCallback: (node: ts.Node, exportName: string, baseName: string | undefined, index: number) => T,
	node: ts.Node,
	source?: ts.SourceFile
): T[] {
	const isDefault = node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
	if (ts.isVariableStatement(node)) {
		return node.declarationList.declarations.map((d, i) => mapCallback(d, d.name.getText(source), undefined, i));
	} else if (ts.isFunctionDeclaration(node) ||
		ts.isClassDeclaration(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		ts.isEnumDeclaration(node) ||
		ts.isModuleDeclaration(node)) {
		const baseName = node.name && node.name.text;
		return [mapCallback(node, (isDefault || !node.name) ? 'default' : baseName!, baseName, 0)];
	} else if (ts.isImportEqualsDeclaration(node)) {
		return [mapCallback(node, node.name.text, undefined, 0)];
	} else {
		return [];
	}
}
