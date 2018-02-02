import * as path from 'path';

import Options from './Options';

export default function getNamespaceName(basePath: string, targetPath: string, options: Options): string {
	const r = path.relative(basePath, targetPath).replace(/\..*?$/g, '').replace(/[\/\\]/g, '.');
	const n = options.moduleName.replace(/[^A-Za-z0-9\_\$]/g, '_');
	return `${n}.${r}`;
}
