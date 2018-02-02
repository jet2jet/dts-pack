import * as ts from 'typescript';

export default function getModuleNameFromSpecifier(moduleSpecifier: ts.Expression): string {
	if (ts.isStringLiteral(moduleSpecifier)) {
		return moduleSpecifier.text;
	} else {
		return moduleSpecifier.getText();
	}
}
