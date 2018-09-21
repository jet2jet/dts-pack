import * as fs from 'fs';
import * as path from 'path';

import Options from '../types/Options';

export default function resolveTsconfig(options: Options) {
	let projectFile: string;
	if (!options.project) {
		projectFile = './tsconfig.json';
	} else {
		projectFile = options.project;
		if (fs.statSync(projectFile).isDirectory()) {
			projectFile = path.resolve(projectFile, 'tsconfig.json');
		}
	}
	return projectFile;
}
