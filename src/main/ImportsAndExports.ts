import ExportData from './ExportData';
import ImportData from './ImportData';

export default interface ImportsAndExports {
	exports: ExportData[],
	imports: ImportData[]
}
