import { Body, Controller, HttpCode, HttpStatus, Post, Logger } from '@nestjs/common';
import { ReaderService } from './reader.service';
import { FetchUrlDto } from './dto/fetch-url.dto';
import { ReaderResult } from './interfaces/reader-result.interface';

@Controller('reader')
export class ReaderController {
  private readonly logger = new Logger(ReaderController.name);

  constructor(private readonly readerService: ReaderService) {}

  @Post('fetch')
  @HttpCode(HttpStatus.OK)
  async fetch(@Body() dto: FetchUrlDto): Promise<ReaderResult> {
    console.log(`[CONTROLLER] Received fetch request for URL: ${dto.url}`);
    this.logger.log(`Received fetch request for URL: ${dto.url}`);
    return this.readerService.fetchAndParse(dto.url);
  }

  // 🧪 임시 테스트: finalUrl만 추출
  @Post('test-final-url')
  @HttpCode(HttpStatus.OK)
  async testFinalUrl(
    @Body() dto: FetchUrlDto,
  ): Promise<{ initialUrl: string; finalUrl: string }> {
    console.log(`[CONTROLLER] Test finalUrl request for URL: ${dto.url}`);
    this.logger.log(`Test finalUrl request for URL: ${dto.url}`);
    return this.readerService.fetchFinalUrl(dto.url);
  }
}
