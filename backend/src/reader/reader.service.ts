import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import * as cheerio from 'cheerio';
import { ReaderResult } from './interfaces/reader-result.interface';

const NOISE_TAGS = [
  'script', 'style', 'noscript', 'iframe', 'nav', 'footer',
  'header', 'aside', 'form', 'button', 'figure', 'figcaption',
  '[class*="ad-"]', '[class*="cookie"]',
  '[class*="popup"]', '[class*="banner"]', '[id*="sidebar"]',
].join(', ');

@Injectable()
export class ReaderService {
  private readonly logger = new Logger(ReaderService.name);

  async fetchAndParse(url: string): Promise<ReaderResult> {
    let html: string;

    try {
      const response = await axios.get<string>(url, {
        timeout: 10_000,
        maxRedirects: 5,
        responseType: 'text',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/124.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        validateStatus: () => true,
      });

      if (response.status >= 400) {
        throw new HttpException(
          `Remote server returned HTTP ${response.status} for the requested URL.`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      const contentType = response.headers['content-type'] ?? '';
      if (!contentType.includes('html')) {
        throw new BadRequestException(
          `URL does not point to an HTML page (Content-Type: ${contentType}).`,
        );
      }

      html = response.data as string;
    } catch (err) {
      if (err instanceof HttpException || err instanceof BadRequestException) {
        throw err;
      }

      const axiosErr = err as AxiosError;
      if (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT') {
        throw new HttpException(
          'Request timed out. The site may be unreachable.',
          HttpStatus.GATEWAY_TIMEOUT,
        );
      }
      if (axiosErr.code === 'ENOTFOUND' || axiosErr.code === 'ECONNREFUSED') {
        throw new BadRequestException(
          'Could not connect to the URL. Check that the address is correct.',
        );
      }

      this.logger.error(`Unexpected fetch error for ${url}`, axiosErr.message);
      throw new HttpException(
        'An unexpected error occurred while fetching the URL.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    return this.parseHtml(html, url);
  }

  private parseHtml(html: string, originalUrl: string): ReaderResult {
    const $ = cheerio.load(html);

    const title =
      $('title').first().text().trim() ||
      $('h1').first().text().trim() ||
      'Untitled Page';

    $(NOISE_TAGS).remove();

    const contentRoot =
      $('article').first().length > 0
        ? $('article').first()
        : $('main').first().length > 0
        ? $('main').first()
        : $('[role="main"]').first().length > 0
        ? $('[role="main"]').first()
        : $('body');

    const rawText = contentRoot.text();
    const content = rawText
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const wordCount = content
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    return {
      url: originalUrl,
      title,
      content,
      wordCount,
      fetchedAt: new Date().toISOString(),
    };
  }
}
