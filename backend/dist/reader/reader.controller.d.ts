import { ReaderService } from './reader.service';
import { FetchUrlDto } from './dto/fetch-url.dto';
import { ReaderResult } from './interfaces/reader-result.interface';
export declare class ReaderController {
    private readonly readerService;
    private readonly logger;
    constructor(readerService: ReaderService);
    fetch(dto: FetchUrlDto): Promise<ReaderResult>;
}
