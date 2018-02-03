#!/usr/bin/env node

import { run } from './index';

import * as fs from 'fs';
import * as path from 'path';
import * as yargs from 'yargs';

import Options from './types/Options';

const thisName = 'dts-pack';
import thisVersion from './core/version';

interface Arguments extends yargs.Arguments, Options {
	version?: boolean;
}

////////////////////////////////////////////////////////////////////////////////

function mkdirp(dir: string) {
	if (fs.existsSync(dir)) {
		return;
	}
	const p = path.dirname(dir);
	if (!fs.existsSync(p)) {
		mkdirp(p);
	}
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
}

////////////////////////////////////////////////////////////////////////////////

function main(): number {
	try {
		const argv = yargs
			.usage(`Usage:
  ${thisName} --entry <entry-name> --module <module-name> [<options...>]
  ${thisName} --list [<options...>]`)
			.option('project', {
				alias: 'p',
				default: './tsconfig.json',
				description: 'The project file or directory',
				type: 'string'
			})
			.option('entry', {
				alias: 'e',
				description: 'The entry module name in the project',
				type: 'string'
			})
			.option('moduleName', {
				alias: 'm',
				description: 'The output module name',
				type: 'string'
			})
			.option('export', {
				alias: 'x',
				description: 'The export entity name in the entry module name',
				type: 'string'
			})
			.option('rootName', {
				alias: 'r',
				type: 'string',
				description: 'The root variable name'
			})
			.option('outDir', {
				alias: 'o',
				type: 'string',
				default: './',
				description: 'The output directory name (not file name)'
			})
			.option('style', {
				alias: 's',
				type: 'string',
				choices: ['module', 'namespace'],
				default: 'module',
				description: 'The declaration style'
			})
			.option('defaultName', {
				alias: 'd',
				type: 'string',
				default: '_default',
				description: 'The \'default\' name for namespace-style'
			})
			.option('importBindingName', {
				type: 'string',
				default: '__module',
				description: 'The identifier for binding modules with \'import\''
			})
			.option('list', {
				type: 'boolean',
				description: 'If specified, outputs all imports and exports and exit without emitting files.'
			})
			.version(false)
			.option('version', {
				alias: 'V',
				type: 'boolean',
				description: 'Show version number'
			})
			.option('help', {
				alias: ['h', '?'],
				type: 'boolean',
				description: 'Show help'
			})
			//.help()
			.strict()
			.check((a) => {
				const argv = a as Arguments;
				if (argv.version) {
					return true;
				}
				if (!(argv.list || argv.entry || argv.moduleName)) {
					throw '--entry and --moduleName are missing';
				}
				if (argv.list && (argv.entry || argv.moduleName)) {
					throw '--list cannot be used with --entry and --moduleName';
				}
				if (!!argv.entry !== !!argv.moduleName) {
					throw 'both --entry and --moduleName must be specified';
				}
				if (argv.defaultName === 'default') {
					throw '--defaultName cannot be \'default\'';
				}
				return true;
			})
			.fail(function (msg, err, yargs?: yargs.Argv) {
				if (err) {
					if (typeof err !== 'string') {
						throw err;
					}
					msg = err as string;
				}
				msg = yargs!.help().toString() + msg;
				throw msg;
			})
			.argv as Arguments;

		if (argv.version) {
			console.log(`${thisName} version ${thisVersion}`);
			return 0;
		}

		const outputs: string[] = [];
		const writer = (text: string) => { outputs.push(text + '\n'); };

		const r = run(writer, argv);
		if (r.warnings) {
			console.log(r.warnings);
		}

		const fileNames = Object.keys(r.files);
		fileNames.forEach((file) => {
			const dirName = path.dirname(file);
			mkdirp(dirName);
			fs.writeFileSync(file, r.files[file], 'utf8');
		});
		if (outputs.length > 0) {
			console.log(outputs.join(''));
		}
	} catch (s) {
		if (s instanceof Error) {
			console.error(`${thisName}: ERROR:`, s);
		} else {
			if (typeof s !== 'string') {
				s = s.toString();
			}
			if (s) {
				console.error(s);
			}
		}
		return 1;
	}
	return 0;
}

process.exit(main());
