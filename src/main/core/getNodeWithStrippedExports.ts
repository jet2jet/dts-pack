import * as ts from 'typescript';

import ExportDataMap from '../types/ExportDataMap';

import mapEntityWithName from './mapEntityWithName';

export default function getNodeWithStrippedExports<TNode extends ts.Node>(
	sourceFile: ts.SourceFile,
	resolvedFileName: string,
	node: TNode,
	stripUnusedExports: ExportDataMap
): TNode | null {
	const a = stripUnusedExports[resolvedFileName];
	if (!a || !a.length) {
		return node;
	}
	if (ts.isExportDeclaration(node)) {
		if (node.exportClause) {
			const newElem = node.exportClause.elements.filter((element) => {
				return !a.some((exp) => {
					return exp.namedExports.some((x) => element.name.text === (x.baseName || x.name));
				});
			});
			if (!newElem.length) {
				return null;
			}
			if (newElem.length < node.exportClause.elements.length) {
				node.exportClause.elements = ts.createNodeArray(newElem);
			}
		}
	} else if (ts.isExportAssignment(node) && !node.isExportEquals) {
		if (a.some((exp) => exp.namedExports.some((x) => 'default' === x.name))) {
			return null;
		}
	} else if (node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
		if (ts.isVariableStatement(node)) {
			const decls = node.declarationList.declarations.filter(
				(decl) => !a.some((exp) => exp.namedExports.some((x) => decl.name.getText(sourceFile) === (x.baseName || x.name)))
			);
			if (decls.length === 0) {
				return null;
			} else if (decls.length < node.declarationList.declarations.length) {
				node.declarationList.declarations = ts.createNodeArray(decls);
			}
		} else {
			const names = mapEntityWithName((_n, _e, baseName) => {
				return baseName || null;
			}, node, sourceFile);
			if (names[0] !== null) {
				if (a.some((exp) => exp.namedExports.some((x) => names[0] === (x.baseName || x.name)))) {
					return null;
				}
			}
		}
	}
	return node;
}
