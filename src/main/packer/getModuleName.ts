import * as path from 'path';

export default function getModuleName(baseModulePath: string, targetPath: string) {
	return path.relative(baseModulePath, targetPath).replace(/\..*?$/g, '').replace(/\\/g, '/');
}
