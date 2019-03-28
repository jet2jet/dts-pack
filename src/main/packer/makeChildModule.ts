import * as path from 'path';
import * as ts from 'typescript';

import ExportDataMap from '../types/ExportDataMap';
import Options from '../types/Options';

import getModuleName from './getModuleName';
import getModuleNameFromSpecifier from '../core/getModuleNameFromSpecifier';
import getNodeWithStrippedExports from '../core/getNodeWithStrippedExports';

import isEqualPath from '../utils/isEqualPath';

import createStringLiteral from './createStringLiteral';
import resolveModule from './resolveModule';

function filterNonNull<T>(array: ReadonlyArray<T | null>): T[] {
	return (array.filter((value) => value !== null) as T[]);
}

function containsSourceFile(sourceFiles: ReadonlyArray<ts.SourceFile>, fileName: string) {
	return sourceFiles.some((sourceFile) => isEqualPath(path.resolve(sourceFile.fileName), fileName));
}

export default function makeChildModule(
	_options: Options,
	sourceFile: ts.SourceFile,
	sourceFiles: ReadonlyArray<ts.SourceFile>,
	baseModulePath: string,
	baseModuleName: string,
	host: ts.CompilerHost,
	compilerOptions: ts.CompilerOptions,
	resolutionCache: ts.ModuleResolutionCache,
	stripUnusedExports?: ExportDataMap | undefined
) {
	const moduleName = `${baseModuleName}/${getModuleName(baseModulePath, sourceFile.fileName)}`;
	const resolvedFileName = path.resolve(sourceFile.fileName);

	const statements: ts.Statement[] = filterNonNull(sourceFile.statements.map((node) => {
		if (stripUnusedExports) {
			const s = getNodeWithStrippedExports(sourceFile, resolvedFileName, node, stripUnusedExports);
			if (s === null) {
				return null;
			}
			// strip if no exports are specified in 'export { ... }'
			if (ts.isExportDeclaration(s)) {
				if (s.exportClause && s.exportClause.elements.length === 0) {
					return null;
				}
			}
			node = s;
		}
		if (ts.isFunctionDeclaration(node) ||
			ts.isMissingDeclaration(node) ||
			ts.isClassDeclaration(node) ||
			ts.isInterfaceDeclaration(node) ||
			ts.isTypeAliasDeclaration(node) ||
			ts.isEnumDeclaration(node) ||
			ts.isModuleDeclaration(node) ||
			ts.isImportEqualsDeclaration(node) ||
			ts.isNamespaceExportDeclaration(node) ||
			ts.isExportDeclaration(node) ||
			ts.isExportAssignment(node) ||
			ts.isVariableStatement(node) ||
			ts.isImportDeclaration(node)) {
			if (ts.isImportDeclaration(node) ||
				(ts.isExportDeclaration(node) && node.moduleSpecifier)) {
				const m = resolveModule(host, compilerOptions, resolutionCache, getModuleNameFromSpecifier(node.moduleSpecifier!), sourceFile.fileName);
				if (m && containsSourceFile(sourceFiles, m.resolvedFileName)) {
					const refModule = `${baseModuleName}/${getModuleName(baseModulePath, m.resolvedFileName)}`;
					//return ts.createImportDeclaration(
					//	node.decorators,
					//	node.modifiers,
					//	node.importClause,
					//	createStringLiteral(refModule)
					//);
					node.moduleSpecifier = createStringLiteral(refModule);
				}
			} else if (ts.isImportEqualsDeclaration(node)) {
				const ex = node.moduleReference;
				if (ts.isExternalModuleReference(ex) && ex.expression) {
					const m = resolveModule(host, compilerOptions, resolutionCache, getModuleNameFromSpecifier(ex.expression), sourceFile.fileName);
					if (m && containsSourceFile(sourceFiles, m.resolvedFileName)) {
						const refModule = `${baseModuleName}/${getModuleName(baseModulePath, m.resolvedFileName)}`;
						//return ts.createImportEqualsDeclaration(
						//	node.decorators,
						//	node.modifiers,
						//	node.name,
						//	ts.createExternalModuleReference(createStringLiteral(refModule))
						//);
						node.moduleReference = ts.createExternalModuleReference(createStringLiteral(refModule));
					}
				}
			}
			if (node.modifiers) {
				// remove 'declare' keyword
				const mods = node.modifiers
					.filter((m) => (
						m.kind !== ts.SyntaxKind.DeclareKeyword
					));
				if (mods.length !== node.modifiers.length) {
					node.modifiers = ts.createNodeArray(mods);
				}
			}
		}
		return node;
	}));
	if (!statements.length) {
		return null;
	}
	const outModuleBlock = ts.createModuleBlock(statements);
	const outModule = ts.createModuleDeclaration(
		undefined,
		ts.createNodeArray([ts.createToken(ts.SyntaxKind.DeclareKeyword)]),
		createStringLiteral(moduleName),
		outModuleBlock
	);
	return { name: moduleName, module: outModule };
}
