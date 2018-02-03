import * as path from 'path';

export default function isEqualPath(path1: string, path2: string): boolean {
	return path.normalize(path1) === path.normalize(path2);
}
