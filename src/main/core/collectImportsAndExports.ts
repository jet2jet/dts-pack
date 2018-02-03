import * as ts from 'typescript';

import ExportData from '../types/ExportData';
import ImportData from '../types/ImportData';
import ImportsAndExports from '../types/ImportsAndExports';

import getModuleNameFromSpecifier from './getModuleNameFromSpecifier';

function getModuleNameFromReference(moduleReference: ts.ModuleReference): string {
	if (ts.isExternalModuleReference(moduleReference) && moduleReference.expression) {
		return getModuleNameFromSpecifier(moduleReference.expression);
	} else {
		return moduleReference.getText();
	}
}

export default function collectImportsAndExports(source: ts.SourceFile): ImportsAndExports {
	const exports: ExportData[] = [];
	const imports: ImportData[] = [];

	source.forEachChild((node) => {
		if (ts.isExportDeclaration(node)) { // 'export { ... };'
			//console.log('Export:');
			//console.log('  Name:', node.name && node.name.getText()); // not used for usual 'export' (only for 'export as namespace XXX' which is not an ExportDeclaration)
			//console.log('  Modifiers:', node.modifiers);
			//console.log('  ModuleSpecifier:', node.moduleSpecifier);
			//console.log('  Clause:', node.exportClause);
			exports.push({
				moduleName: node.moduleSpecifier && getModuleNameFromSpecifier(node.moduleSpecifier),
				namedExports: (node.exportClause && node.exportClause.elements.map((c) => {
					const name = c.name.getText();
					return {
						name: name,
						baseName: c.propertyName && c.propertyName.getText(),
						node: c
					};
				})) || [],
				node: node
			});
		} else if (ts.isExportAssignment(node)) { // 'export = XXX;' or 'export default XXX;'
			//console.log('ExportAssignment:');
			//console.log('  Name:', node.name && node.name.getText());
			//console.log('  Modifiers:', node.modifiers);
			//console.log('  IsEqual:', node.isExportEquals); // false for 'export default XXX;'
			//console.log('  Expression:', node.expression.getText());
			if (node.isExportEquals) {
				exports.push({
					baseName: node.expression.getText(),
					namedExports: [],
					node: node
				});
			} else {
				exports.push({
					namedExports: [{
						name: 'default',
						baseName: node.expression.getText(),
						node: node.expression
					}],
					node: node
				});
			}
		} else if (node.modifiers && node.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
			//console.log('Export definition:', node.kind);
			//console.log('  Decorators:', node.decorators);
			//console.log('  Modifiers:', node.modifiers);
			//console.log('  Flags:', node.flags);
			const isDefault = node.modifiers.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
			if (ts.isVariableStatement(node)) {
				// 'export [let|const] <variables...>'
				exports.push({
					namedExports: node.declarationList.declarations.map((d) => ({
						name: d.name.getText(),
						node: d
					})),
					node: node
				});
			} else if (ts.isFunctionDeclaration(node) ||
				ts.isClassDeclaration(node) ||
				ts.isInterfaceDeclaration(node) ||
				ts.isTypeAliasDeclaration(node) ||
				ts.isEnumDeclaration(node) ||
				ts.isModuleDeclaration(node)) {
				const baseName = node.name && node.name.getText();
				const name = (isDefault || !node.name) ? 'default' : baseName!;
				exports.push({
					namedExports: [{
						name: name,
						baseName: baseName,
						node: node
					}],
					node: node
				});
			} else if (ts.isImportEqualsDeclaration(node)) {
				const baseName = getModuleNameFromReference(node.moduleReference);
				const name = node.name.getText();
				exports.push({
					namedExports: [{
						name: name,
						baseName: baseName,
						node: node.moduleReference
					}],
					node: node
				});
				// also add to imports
				imports.push({
					name: name,
					module: baseName,
					node: node
				});
			}
		} else if (ts.isImportDeclaration(node)) {
			// (refs. writeImportDeclaration)
			//console.log('Import:');
			//console.log('  Modifiers:', node.modifiers);
			//console.log('  ModuleSpecifier:', node.moduleSpecifier); // module name
			//console.log('  Clause:', node.importClause); // name is used for 'import XXX from ...'; otherwise namedBindings is used
			if (!node.importClause) {
				imports.push({
					module: getModuleNameFromSpecifier(node.moduleSpecifier),
					node: node
				});
			} else {
				if (node.importClause.name) {
					imports.push({
						name: node.importClause.name.getText(),
						fromName: 'default',
						module: getModuleNameFromSpecifier(node.moduleSpecifier),
						node: node
					});
				}
				if (node.importClause.namedBindings) {
					const bindings = node.importClause.namedBindings;
					if (ts.isNamespaceImport(bindings)) {
						imports.push({
							name: bindings.name.getText(),
							fromName: '*',
							module: getModuleNameFromSpecifier(node.moduleSpecifier),
							node: node
						});
					} else {
						bindings.elements.forEach((element) => {
							const n = element.name.getText();
							imports.push({
								name: n,
								fromName: element.propertyName && element.propertyName.getText() || n,
								module: getModuleNameFromSpecifier(node.moduleSpecifier),
								node: node
							});
						});
					}
				}
			}
		} else if (ts.isImportEqualsDeclaration(node)) {
			//console.log('Import:');
			//console.log('  Name:', node.name);
			//console.log('  Modifiers:', node.modifiers);
			//console.log('  ModuleReference:', node.moduleReference);
			imports.push({
				name: node.name.getText(),
				module: getModuleNameFromReference(node.moduleReference),
				node: node
			});
		} else {
			//console.log('Kind:', node.kind);
			//console.log('  Decorators:', node.decorators);
			//console.log('  Modifiers:', node.modifiers);
			//console.log('  Flags:', node.flags);
		}
	});

	return {
		exports,
		imports
	};
}
