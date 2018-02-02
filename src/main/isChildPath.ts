import * as path from 'path';

export default function isChildPath(basePath: string, targetPath: string): boolean {
	const p = path.relative(basePath, targetPath).split(path.sep);
	return p.indexOf('..') < 0;
}
