import { ReaderResult } from './interfaces/reader-result.interface';
export declare class ReaderService {
    private readonly logger;
    fetchAndParse(url: string): Promise<ReaderResult>;
    private parseHtml;
}
