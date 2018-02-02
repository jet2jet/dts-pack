import * as ts from 'typescript';

import ExternalImportData from './ExternalImportData';
import GlobalDeclarationData from './GlobalDeclarationData';
import ImportData from './ImportData';
import ImportsAndExports from './ImportsAndExports';
import Options from './Options';

import getIdentifierName from './getIdentifierName';
import getNamespaceName from './getNamespaceName';
import isChildPath from './isChildPath';
import isEqualPath from './isEqualPath';
import resolveModule from './resolveModule';

function getImportData(data: ImportsAndExports, node: ts.Node): ImportData[] {
	return data.imports.filter((x) => x.node === node);
}

function getExternalImportModuleData(options: Options, resolvedName: string, moduleName: string, externalImportData: ExternalImportData, assign: boolean) {
	const prefix = options.importBindingName || '__module';
	let x = externalImportData.modules[resolvedName];
	if (!x) {
		x = {
			name: `${prefix}${++externalImportData.importedCount}`,
			module: moduleName
		};
		externalImportData.modules[resolvedName] = x;
	} else if (assign && !x.name) {
		x.name = `${prefix}${++externalImportData.importedCount}`;
	}
	return x;
}

function gatherAllExportEntities(options: Options, moduleFullPath: string, allData: {
	sourceFile: ts.SourceFile;
	data: ImportsAndExports;
}[]): string[] | null {
	const dataMap = allData.filter((d) => isEqualPath(d.sourceFile.fileName, moduleFullPath))[0];
	if (!dataMap)
		return null;
	let r: string[] | null = [];
	dataMap.data.exports.forEach((x) => {
		if (!r)
			return;
		if (x.namedExports && x.namedExports.length) {
			r = r.concat(x.namedExports.map((n) => getIdentifierName(n.name, options)));
		} else {
			// 'export = XXX'
			r = null;
		}
	});
	return r;
}

function gatherAllExportEntitiesFromExternalModule(
	resolvedFileName: string,
	program: ts.Program
): string[] | null {
	const src = program.getSourceFile(resolvedFileName);
	if (!src) {
		return null;
	}
	const checker = program.getTypeChecker();
	const moduleSymbol = checker.getSymbolAtLocation(src);
	if (!moduleSymbol) {
		return null;
	}
	const r = checker.getExportsOfModule(moduleSymbol);
	return r.map((s) => s.name);
}

export default function rebuildAST(
	options: Options,
	sourceFile: ts.SourceFile,
	basePath: string,
	allData: {
		sourceFile: ts.SourceFile;
		data: ImportsAndExports;
	}[],
	externalImportData: ExternalImportData,
	outGlobals: GlobalDeclarationData[],
	host: ts.CompilerHost,
	program: ts.Program,
	compilerOptions: ts.CompilerOptions,
	resolutionCache: ts.ModuleResolutionCache
) {
	const namespaceName = getNamespaceName(basePath, sourceFile.fileName, options);
	const n = ts.createIdentifier(namespaceName);

	const dataMap = allData.filter((d) => (d.sourceFile === sourceFile))[0];
	if (!dataMap) {
		return null;
	}
	const data = dataMap.data;

	const localImportData: {
		[name: string]: string;
	} = {};
	const moduleStatements: ts.Statement[] = [];
	sourceFile.forEachChild((node) => {
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
			let replaced = false;
			if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
				const i = getImportData(data, node);
				if (i && i.length) {
					i.forEach((d) => {
						const m = resolveModule(host, compilerOptions, resolutionCache, d.module, sourceFile.fileName);
						if (m) {
							if (isChildPath(basePath, m.resolvedFileName)) {
								if (d.name) {
									let refNamespace = getNamespaceName(basePath, m.resolvedFileName, options);
									if (d.fromName && d.fromName !== '*') {
										refNamespace = `${refNamespace}.${getIdentifierName(d.fromName, options)}`;
									}
									const decl = ts.createImportEqualsDeclaration(
										undefined,
										undefined,
										ts.createIdentifier(d.name),
										ts.createIdentifier(refNamespace)
									);
									localImportData[d.name] = refNamespace;
									moduleStatements.push(decl);
								}
							} else {
								const x = getExternalImportModuleData(options, m.resolvedFileName, d.module, externalImportData, !!d.name);
								if (d.name) {
									let refNamespace: string;
									if (d.fromName === '*') {
										refNamespace = `${x.name!}`;
									} else {
										refNamespace = `${x.name!}.${getIdentifierName(d.fromName!, options)}`;
									}
									const decl = ts.createImportEqualsDeclaration(
										undefined,
										undefined,
										ts.createIdentifier(d.name),
										ts.createIdentifier(refNamespace)
									);
									localImportData[d.name] = refNamespace;
									moduleStatements.push(decl);
								}
							}
						}
					});
				}
				replaced = true;
			} else if (ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
				replaced = true;
			} else if (ts.isModuleDeclaration(node)) {
				if (node.flags & ts.NodeFlags.GlobalAugmentation) {
					outGlobals.push({
						sourceFile: sourceFile,
						node: node
					});
					replaced = true;
				}
			}
			if (!replaced) {
				// remove 'export' 'declare' 'default' keywords
				if (node.modifiers) {
					const mods = node.modifiers
						.filter((m) => (
							m.kind !== ts.SyntaxKind.ExportKeyword &&
							m.kind !== ts.SyntaxKind.DeclareKeyword &&
							m.kind !== ts.SyntaxKind.DefaultKeyword
						));
					if (mods.length !== node.modifiers.length) {
						node.modifiers = ts.createNodeArray(mods);
					}
				}
				moduleStatements.push(node);
			}
		}
	});
	const innerModuleBlock = ts.createModuleBlock(moduleStatements);
	innerModuleBlock.statements.forEach((s) => {
		s.parent = innerModuleBlock;
	});

	const innerModuleName = ts.createIdentifier('module');
	const innerModule = ts.createModuleDeclaration(
		undefined,
		[],
		innerModuleName,
		innerModuleBlock,
		ts.NodeFlags.Namespace
	);

	const outerStatements: ts.Statement[] = [innerModule];
	data.exports.forEach((d) => {
		if (d.moduleName) {
			const m = resolveModule(host, compilerOptions, resolutionCache, d.moduleName, sourceFile.fileName);
			if (m) {
				if (!m.isExternalLibraryImport) {
					const names = gatherAllExportEntities(options, m.resolvedFileName, allData);
					if (names) {
						const refNamespace = getNamespaceName(basePath, m.resolvedFileName, options);
						names.forEach((name) => {
							const fromIdentifier = ts.createIdentifier(`${refNamespace}.${name}`);
							const exportIdentifier = ts.createIdentifier(name);
							const exp = ts.createImportEqualsDeclaration(
								undefined,
								[ts.createToken(ts.SyntaxKind.ExportKeyword)],
								exportIdentifier,
								fromIdentifier
							);
							outerStatements.push(exp);
						});
					}
				} else {
					const names = gatherAllExportEntitiesFromExternalModule(m.resolvedFileName, program);
					if (names) {
						const x = getExternalImportModuleData(options, m.resolvedFileName, d.moduleName, externalImportData, true);
						const refNamespace = x.name!;
						names.forEach((name) => {
							const fromIdentifier = ts.createIdentifier(`${refNamespace}.${name}`);
							const exportIdentifier = ts.createIdentifier(name);
							const exp = ts.createImportEqualsDeclaration(
								undefined,
								[ts.createToken(ts.SyntaxKind.ExportKeyword)],
								exportIdentifier,
								fromIdentifier
							);
							outerStatements.push(exp);
						});
					}
				}
			}
		} else if (d.baseName) {
		} else {
			d.namedExports.forEach((m) => {
				const name = getIdentifierName(m.name, options);
				const fromName = m.baseName || name;
				let fromIdentifier: ts.Identifier;
				if (localImportData[fromName]) {
					fromIdentifier = ts.createIdentifier(localImportData[fromName]);
				} else {
					fromIdentifier = ts.createIdentifier(`module.${fromName}`);
				}
				const exportIdentifier = ts.createIdentifier(name);
				const exp = ts.createImportEqualsDeclaration(
					undefined,
					[ts.createToken(ts.SyntaxKind.ExportKeyword)],
					exportIdentifier,
					fromIdentifier
				);
				outerStatements.push(exp);
			});
		}
	});

	const outerModuleBlock = ts.createModuleBlock(
		outerStatements
	);
	outerModuleBlock.statements.forEach((s) => {
		s.parent = outerModuleBlock;
	});
	const outerModule = ts.createModuleDeclaration(
		undefined,
		[ts.createToken(ts.SyntaxKind.DeclareKeyword)],
		n,
		outerModuleBlock,
		ts.NodeFlags.Namespace
	);
	return outerModule;
}
