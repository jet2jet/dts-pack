
export default interface ExternalImportData {
	modules: {
		[resolvedName: string]: { name: string | null, module: string }
	};
	importedCount: number;
}
