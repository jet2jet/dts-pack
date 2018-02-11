import * as ts from 'typescript';

import ExportData from '../types/ExportData';

import mapEntityWithName from './mapEntityWithName';

function isDeclarationSymbol(symbol: ts.Symbol, node: ts.Node) {
	const parent = node.parent;
	if (symbol.flags === ts.SymbolFlags.Alias) {
		return false;
	}
	return !!symbol.declarations && symbol.declarations.some((d) => d === parent);
}

function isSymbolReferring(symTarget: ts.Symbol, symReference: ts.Symbol, nodeReference: ts.Node, outExportedSymbols: ts.Symbol[]): boolean {
	if (symReference.flags === ts.SymbolFlags.Alias) {
		if (!symReference.declarations) {
			return false;
		}
		// 'export { A as B };'
		return symReference.declarations.some((d) => {
			if (ts.isExportSpecifier(d)) {
				const i = d.propertyName || d.name;
				if (i.text === symTarget.name) {
					outExportedSymbols.push(symTarget);
					return true;
				}
				return false;
			} else {
				return !!symTarget.declarations && symTarget.declarations.some((x) => x === d);
			}
		});
	} else if (!symTarget.declarations || symTarget.name === symReference.name) {
		return false;
	} else {
		let node: ts.Node | undefined = nodeReference;
		while (node) {
			if (symTarget.declarations.some((d) => d === node)) {
				return true;
			}
			node = node.parent;
		}
		return false;
	}
}

function reduceNoEntryMap<T>(map: Map<T, T[]>, keys: T[], equator: (a: T, b: T) => boolean, reduceable?: (x: T) => boolean): T[] {
	const reduced: T[] = [];
	while (true) {
		let needMoreReduction = false;
		for (let i = keys.length - 1; i >= 0; --i) {
			const t = keys[i];
			const arr = map.get(t)!;
			if (!arr.length && (!reduceable || reduceable(t))) {
				keys.splice(i, 1);
				map.delete(t);
				reduced.push(t);
				keys.forEach((x) => {
					const arr2 = map.get(x)!;
					for (let j = arr2.length - 1; j >= 0; --j) {
						if (equator(arr2[j], t)) {
							arr2.splice(j, 1);
						}
					}
				});
				needMoreReduction = true;
			}
		}
		if (!needMoreReduction) {
			break;
		}
	}
	return reduced;
}

function findParentSymbol(symbols: ts.Symbol[], childNode: ts.Node): ts.Symbol | undefined {
	for (let i = symbols.length - 1; i >= 0; --i) {
		const x = symbols[i];
		let p: ts.Node | undefined = childNode;
		while (p) {
			if (x.declarations && x.declarations.some((d) => d === p)) {
				return x;
			}
			p = p.parent;
		}
	}
	return undefined;
}

function isUsingExportSymbol(source: ts.SourceFile, sym: ts.Symbol, unusedExports: ExportData[] | undefined): boolean {
	if (!unusedExports) {
		return true;
	}
	let symName = sym.name;
	// sym.name may be 'default', so get original entity name
	if (sym.declarations) {
		sym.declarations.forEach((d) => {
			mapEntityWithName((_n, exportName, baseName, i) => {
				if (i === 0) {
					symName = baseName || exportName;
				}
			}, d, source);
		});
	}
	return !unusedExports.some((exp) => {
		return exp.namedExports.some((x) => {
			return (x.baseName || x.name) === symName;
		});
	});
}

export default function collectUnusedSymbols(sourceFile: ts.SourceFile, typeChecker: ts.TypeChecker, unusedExports?: ExportData[]): string[] {
	const symbols = new Map<ts.Symbol, ts.Symbol[]>();
	const symKeys: ts.Symbol[] = [];
	const exportedSymKeys: ts.Symbol[] = [];

	function processNode(node: ts.Node) {
		const baseSym = typeChecker.getSymbolAtLocation(node);
		if (baseSym) {
			//const s = typeChecker.getAliasedSymbol(baseSym);
			const s = baseSym;
			if (isDeclarationSymbol(s, node)) {
				let parentSymbol: ts.Symbol | undefined;
				if (s.getFlags() === ts.SymbolFlags.Method ||
					s.getFlags() === ts.SymbolFlags.Property ||
					s.getFlags() === ts.SymbolFlags.NamespaceModule) {
					parentSymbol = findParentSymbol(symKeys, node);
				}
				if (!symbols.get(s)) {
					//console.log('Declaration symbol:', s.name);
					symbols.set(s, []);
					symKeys.push(s);
				}
				if (parentSymbol) {
					//console.log(`  (found parent symbol: ${parentSymbol.name})`);
					// 'parent (parentSymbol) is referring child (s)'
					const arr = symbols.get(s)!;
					arr.push(parentSymbol);
				}
			} else {
				//console.log('Reference symbol:', s.name);
				symKeys.forEach((x) => {
					if (isSymbolReferring(x, s, node, exportedSymKeys)) {
						//console.log(`  (found declaration: ${x.name})`);
						// 'x' is referring 's'
						const arr = symbols.get(s);
						if (arr) {
							arr.push(x);
						}
					}
				});
			}
		}
		node.forEachChild(processNode);
	}
	sourceFile.forEachChild(processNode);

	//console.log(`collectUnusedSymbols [file = ${sourceFile.fileName}]`);
	//console.log(`  unused exports:`);
	//unusedExports && unusedExports.forEach((exp) => exp.namedExports.forEach((x) => console.log(`    ${x.baseName || x.name} as ${x.name}`)));
	return reduceNoEntryMap(symbols, symKeys, (a, b) => a.name === b.name, (s) => {
		const usingExport = isUsingExportSymbol(sourceFile, s, unusedExports);
		if (!s.declarations) {
			return true;
		}
		//console.log(`  Symbol '${s.name}'[${s.flags}]: usingExport = `, usingExport);
		if (usingExport && exportedSymKeys.some((x) => x === s)) {
			return false;
		}
		const d = s.declarations[0];
		if (!d) {
			return true;
		}
		return !usingExport || !(
			ts.isExportDeclaration(d) ||
			ts.isExportAssignment(d) ||
			ts.isExportSpecifier(d) ||
			(d.modifiers && d.modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword))
		);
	}).map((sym) => {
		let name = sym.name;
		if (sym.declarations) {
			sym.declarations.forEach((d) => {
				mapEntityWithName((_n, exportName, baseName, i) => {
					if (i === 0) {
						name = baseName || exportName;
					}
				}, d, sourceFile);
			});
		}
		return name;
	});
}
