
import HeaderFooterOutputData from './HeaderFooterOutputData';

/**
 * The callback function type for 'headerText' and 'footerText' options.
 * If null or undefined is returned, the header or footer will not be emitted.
 * For 'module' style, this callback will be called for two output files.
 */
type HeaderFooterCallback = (data: HeaderFooterOutputData) => string | null | undefined;
export default HeaderFooterCallback;
