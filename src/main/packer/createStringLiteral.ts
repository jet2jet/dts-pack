import * as ts from 'typescript';

declare module 'typescript' {
	// (this is not declared yet)
	interface StringLiteral {
		singleQuote?: boolean;
	}
}

export default function createStringLiteral(text: string, singleQuote: boolean = true): ts.StringLiteral {
	const r = ts.createLiteral(text);
	r.singleQuote = singleQuote;
	return r;
}
