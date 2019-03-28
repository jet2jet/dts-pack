import * as path from 'path';

/**
 * Returns the common root path for path1 and path2.
 */
export default function pickupRootPath(path1: string, path2: string): string {
	let prefix = '';
	path1 = path.normalize(path1);
	path2 = path.normalize(path2);
	// for Windows path
	if (path1.startsWith('\\\\.\\')) {
		if (!path2.startsWith('\\\\.\\')) {
			return '';
		}
		path1 = path1.substr(4);
		path2 = path2.substr(4);
		prefix = '\\\\.\\';
	} else if (path2.startsWith('\\\\.\\')) {
		return '';
	}
	if (path1[1] === ':' && path1[2] === '\\') {
		if (path2[1] !== ':' || path2[2] !== '\\') {
			return '';
		}
		if (path1[0] !== path2[0]) {
			return '';
		}
		prefix = `${prefix}${path1.substr(0, 3)}`;
		// strip first '\\' char
		path1 = path1.substr(3);
		path2 = path2.substr(3);
	} else if (path2[1] === ':' && path2[2] === '\\') {
		return '';
	}
	const path1Tokens = path1.split(path.sep);
	const path2Tokens = path2.split(path.sep);
	let count = path1Tokens.length;
	if (count > path2Tokens.length) {
		count = path2Tokens.length;
	}
	for (let i = 0; i < count; ++i) {
		if (path1Tokens[i] !== path2Tokens[i]) {
			return `${prefix}${path1Tokens.slice(0, i).join(path.sep)}`;
		}
	}
	// same path
	return `${prefix}${path1Tokens.join(path.sep)}`;
}
