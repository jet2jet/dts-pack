
import Options from '../types/Options';
import getModuleName from './getModuleName';

export default function getNamespaceName(moduleBasePath: string, targetPath: string, options: Options): string {
	const r = getModuleName(moduleBasePath, targetPath);
	const n = options.moduleName.replace(/[^A-Za-z0-9\_\$]/g, '_');
	return `${n}.${r}`;
}
