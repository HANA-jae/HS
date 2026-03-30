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

      let htmlContent: string;

      // Cloudflare JS Challenge 또는 rate limit — Playwright로 폴백
      if ([403, 429, 503].includes(response.status)) {
        this.logger.warn(
          `HTTP ${response.status} from ${url}, retrying with browser...`,
        );
        htmlContent = await this.fetchWithBrowser(url);
      } else if (response.status >= 400) {
        throw new HttpException(
          `Remote server returned HTTP ${response.status} for the requested URL.`,
          HttpStatus.BAD_GATEWAY,
        );
      } else {
        htmlContent = response.data as string;
      }

      // Playwright 폴백이 아닌 경우만 Content-Type 검증
      if (response.status < 400) {
        const contentType = response.headers['content-type'] ?? '';
        if (!contentType.includes('html')) {
          throw new BadRequestException(
            `URL does not point to an HTML page (Content-Type: ${contentType}).`,
          );
        }
      }

      html = htmlContent;
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

  private async fetchWithBrowser(url: string): Promise<string> {
    try {
      const { chromium } = await import('playwright-core');

      this.logger.debug(`Launching Playwright browser for ${url}...`);
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-features=IsolateOrigins,site-per-process',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      try {
        const context = await browser.newContext({
          userAgent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) ' +
            'Chrome/124.0.0.0 Safari/537.36',
          locale: 'ko-KR',
          extraHTTPHeaders: {
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept':
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        // Hide headless browser detection
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          delete (window as any).__playwright;
          delete (window as any).__pw_manual;
          delete (window as any).cdc_adoQpoasnfa;
        });

        const page = await context.newPage();

        this.logger.debug(`Navigating to ${url} with browser...`);
        // Use domcontentloaded instead of networkidle to avoid timeout
        // from ads/analytics that poll indefinitely
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });

        // Wait for Cloudflare challenge to complete and redirect to actual page
        // CF challenge elements disappear once challenge is solved and page redirects
        this.logger.debug(`Waiting for Cloudflare challenge completion...`);
        await page.waitForFunction(
          () => {
            // Cloudflare challenge DOM elements that appear during verification
            const cfSelectors = [
              '#challenge-running',
              '#cf-challenge-running',
              '.cf-browser-verification',
              '#challenge-body-text',
              '#challenge-form',
            ];
            // Return true when all CF challenge elements are gone
            return !cfSelectors.some((selector) =>
              document.querySelector(selector),
            );
          },
          { timeout: 30_000, polling: 500 },
        );

        // Wait for page to stabilize after CF redirect
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(500);

        const html = await page.content();
        await context.close();

        this.logger.debug(`Successfully fetched ${url} with Playwright`);
        return html;
      } finally {
        await browser.close();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Browser fetch failed for ${url}: ${errorMsg} (Stack: ${err instanceof Error ? err.stack : 'unknown'})`,
      );

      throw new HttpException(
        'Failed to fetch the page with browser. The site may be blocking automated access.',
        HttpStatus.BAD_GATEWAY,
      );
    }
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
