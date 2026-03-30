import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ReaderService } from './reader.service';
import { FetchUrlDto } from './dto/fetch-url.dto';
import { ReaderResult } from './interfaces/reader-result.interface';

@Controller('reader')
export class ReaderController {
  constructor(private readonly readerService: ReaderService) {}

  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  async fetch(@Body() dto: FetchUrlDto): Promise<ReaderResult> {
    return this.readerService.fetchAndParse(dto.url);
  }
}
