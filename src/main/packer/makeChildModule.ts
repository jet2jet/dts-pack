import * as path from 'path';
import * as ts from 'typescript';

import Options from '../types/Options';

import isChildPath from '../utils/isChildPath';

import getModuleNameFromSpecifier from '../core/getModuleNameFromSpecifier';

import createStringLiteral from './createStringLiteral';
import resolveModule from './resolveModule';

function getModuleName(basePath: string, targetPath: string) {
	return path.relative(basePath, targetPath).replace(/\..*?$/g, '').replace(/\\/g, '/');
}

export default function makeChildModule(
	_options: Options,
	sourceFile: ts.SourceFile,
	basePath: string,
	baseModuleName: string,
	host: ts.CompilerHost,
	compilerOptions: ts.CompilerOptions,
	resolutionCache: ts.ModuleResolutionCache
) {
	const moduleName = `${baseModuleName}/${getModuleName(basePath, sourceFile.fileName)}`;

	const statements: ts.Statement[] = sourceFile.statements.map((node) => {
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
				if (m && isChildPath(basePath, m.resolvedFileName)) {
					const refModule = `${baseModuleName}/${getModuleName(basePath, m.resolvedFileName)}`;
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
					if (m && isChildPath(basePath, m.resolvedFileName)) {
						const refModule = `${baseModuleName}/${getModuleName(basePath, m.resolvedFileName)}`;
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
	});
	const outModuleBlock = ts.createModuleBlock(statements);
	const outModule = ts.createModuleDeclaration(
		undefined,
		ts.createNodeArray([ts.createToken(ts.SyntaxKind.DeclareKeyword)]),
		createStringLiteral(moduleName),
		outModuleBlock
	);
	return { name: moduleName, module: outModule };
}
