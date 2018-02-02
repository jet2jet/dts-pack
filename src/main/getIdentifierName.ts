import Options from './Options';

export default function getIdentifierName(name: string, options: Options): string {
	if (name === 'default') {
		return options.defaultName || '_default';
	}
	return name;
}
