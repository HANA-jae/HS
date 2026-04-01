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
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`[📥 START] fetchAndParse 시작: ${url}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    let html: string;

    // 1차 시도: 일반 axios (빠른 사이트용)
    try {
      this.logger.log(`[1️⃣  STEP 1] Axios 직접 요청 시도...`);
      const startTime = Date.now();
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
      const elapsedTime = Date.now() - startTime;
      this.logger.log(`   ✓ Axios 응답 수신: HTTP ${response.status} (${elapsedTime}ms)`);

      let htmlContent: string;

      // Cloudflare JS Challenge 또는 rate limit — Playwright로 폴백
      if ([403, 429, 503].includes(response.status)) {
        this.logger.warn(`   ⚠ HTTP ${response.status} - Cloudflare 챌린지 감지!`);
        this.logger.log(`[2️⃣  STEP 2] Playwright 브라우저 자동화로 우회 시도...`);
        htmlContent = await this.fetchWithBrowser(url);
      } else if (response.status >= 400) {
        this.logger.error(`   ❌ HTTP ${response.status} - 서버 에러`);
        throw new HttpException(
          `Remote server returned HTTP ${response.status} for the requested URL.`,
          HttpStatus.BAD_GATEWAY,
        );
      } else {
        this.logger.log(`   ✓ HTTP ${response.status} OK - 직접 응답 사용`);
        htmlContent = response.data as string;

        // Content-Type 검증
        const contentType = response.headers['content-type'] ?? '';
        if (!contentType.includes('html')) {
          throw new BadRequestException(
            `URL does not point to an HTML page (Content-Type: ${contentType}).`,
          );
        }
      }

      html = htmlContent;
      this.logger.log(`[3️⃣  STEP 3] HTML 콘텐츠 파싱 중... (길이: ${html.length} bytes)`);
      const result = this.parseHtml(html, url);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.logger.log(`[✅ SUCCESS] 완료! 제목: "${result.title}" | 단어: ${result.wordCount}`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return result;
    } catch (err) {
      if (err instanceof HttpException || err instanceof BadRequestException) {
        throw err;
      }

      const axiosErr = err as AxiosError;
      if (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT') {
        this.logger.warn(`   ⚠ Axios 타임아웃 (${axiosErr.code})`);
        this.logger.log(`[2️⃣  STEP 2] Playwright 브라우저 자동화로 우회 시도...`);
        html = await this.fetchWithBrowser(url);
      } else {
        this.logger.warn(`   ⚠ Axios 실패 (${axiosErr.code}): ${axiosErr.message}`);
        this.logger.log(`[2️⃣  STEP 2] Playwright 브라우저 자동화로 우회 시도...`);
        html = await this.fetchWithBrowser(url);
      }

      if (axiosErr.code === 'ENOTFOUND' || axiosErr.code === 'ECONNREFUSED') {
        throw new BadRequestException(
          'Could not connect to the URL. Check that the address is correct.',
        );
      }

      this.logger.log(`[3️⃣  STEP 3] HTML 콘텐츠 파싱 중... (길이: ${html.length} bytes)`);
      const result = this.parseHtml(html, url);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      this.logger.log(`[✅ SUCCESS] 완료! 제목: "${result.title}" | 단어: ${result.wordCount}`);
      this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      return result;
    }
  }

  private async fetchWithBrowser(url: string): Promise<string> {
    try {
      const { chromium } = await import('playwright-core');

      this.logger.log(`   🌐 Playwright 브라우저 실행 중...`);
      const startTime = Date.now();
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
      this.logger.log(`   ✓ 브라우저 실행 완료 (${Date.now() - startTime}ms)`);

      try {
        const userAgent =
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
          'AppleWebKit/537.36 (KHTML, like Gecko) ' +
          'Chrome/124.0.0.0 Safari/537.36';

        this.logger.log(`   📋 브라우저 컨텍스트 생성 중...`);
        const context = await browser.newContext({
          userAgent,
          locale: 'ko-KR',
          extraHTTPHeaders: {
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Accept':
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });
        this.logger.log(`   ✓ 컨텍스트 생성 완료`);

        // Hide headless browser detection
        this.logger.log(`   🔒 자동화 탐지 우회 스크립트 주입...`);
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          delete (window as any).__playwright;
          delete (window as any).__pw_manual;
          delete (window as any).cdc_adoQpoasnfa;
        });
        this.logger.log(`   ✓ 우회 스크립트 주입 완료`);

        const page = await context.newPage();

        this.logger.log(`   🔄 페이지 로드 중: ${url}`);
        const pageLoadStart = Date.now();

        // Initial page load with longer timeout for complex sites
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 60_000, // booktoki469 특화: 60초 타임아웃
        });

        this.logger.log(`   ✓ 페이지 로드 완료 (${Date.now() - pageLoadStart}ms)`);
        this.logger.log(`   🔍 Cloudflare 챌린지 확인 중...`);

        // CF 챌린지 완료 여부 확인 (최대 50초)
        let cfChallengeCompleted = false;
        this.logger.log(`   ⏳ cf_clearance 쿠키 대기 중... (최대 50초)`);
        try {
          const cfStart = Date.now();
          await page.waitForFunction(
            () => {
              const cookies = document.cookie.split(';');
              return cookies.some((c) => c.trim().startsWith('cf_clearance='));
            },
            { timeout: 50_000 },
          );
          this.logger.log(`   ✓ cf_clearance 쿠키 감지! (${Date.now() - cfStart}ms)`);
          cfChallengeCompleted = true;
        } catch {
          this.logger.log(`   ⚠ cf_clearance 미감지, 계속 진행...`);
        }

        // CF 완료 후 실제 콘텐츠 페이지로 리다이렉트되기를 대기
        if (cfChallengeCompleted) {
          this.logger.log(`   🔄 CF 챌린지 후 페이지 리다이렉트 대기 중...`);
          try {
            // 페이지가 실제 콘텐츠로 리다이렉트될 때까지 대기
            const redirectStart = Date.now();
            await page.waitForNavigation({
              waitUntil: 'domcontentloaded',
              timeout: 15_000,
            });
            this.logger.log(`   ✓ 페이지 리다이렉트 완료 (${Date.now() - redirectStart}ms)`);
          } catch {
            this.logger.log(`   ℹ️ 리다이렉트 미감지, 페이지 대기 중...`);
            // 리다이렉트가 없으면 페이지가 이미 로드되었을 가능성
            await page.waitForTimeout(3000);
          }
        }

        // CF 챌린지 페이지인지 확인 (title이 "Just a moment" 또는 "잠시만 기다리십시오" 포함)
        let isCFChallengePage = false;
        let attemptCount = 0;
        const maxAttempts = 5;

        this.logger.log(`   📄 페이지 제목 확인 중... (최대 ${maxAttempts}회 재시도)`);
        while (attemptCount < maxAttempts) {
          const currentTitle = await page.title();
          this.logger.log(`      [시도 ${attemptCount + 1}/${maxAttempts}] 제목: "${currentTitle}"`);

          // CF 챌린지 페이지 패턴 감지
          if (
            currentTitle.includes('Just a moment') ||
            currentTitle.includes('잠시만') ||
            currentTitle.includes('기다리')
          ) {
            this.logger.log(`      ⚠ CF 챌린지 페이지 감지! 리다이렉트 대기 중...`);
            isCFChallengePage = true;

            // CF 페이지에서 벗어날 때까지 대기
            try {
              const cfExit = Date.now();
              await page.waitForFunction(
                () => {
                  const title = document.title;
                  return !title.includes('Just a moment') &&
                         !title.includes('잠시만') &&
                         !title.includes('기다리');
                },
                { timeout: 20_000 },
              );
              this.logger.log(`      ✓ CF 챌린지 페이지 탈출! (${Date.now() - cfExit}ms)`);
              isCFChallengePage = false;
              break;
            } catch {
              this.logger.log(`      ⏳ CF 페이지 유지, 재시도 중...`);
              await page.waitForTimeout(2000);
              attemptCount++;
            }
          } else {
            // 실제 콘텐츠 페이지로 보임
            this.logger.log(`      ✓ 실제 콘텐츠 페이지 확인!`);
            isCFChallengePage = false;
            break;
          }
        }

        if (isCFChallengePage) {
          this.logger.warn(`   ⚠ ${maxAttempts}회 시도 후에도 CF 챌린지 페이지 - 계속 진행...`);
        }

        // 최종 동적 콘텐츠 렌더링 대기
        this.logger.log(`   ⌛ 최종 콘텐츠 렌더링 대기 중... (3초)`);
        try {
          await page.waitForTimeout(3000); // 최종 렌더링 완료 대기
          this.logger.log(`   ✓ 콘텐츠 렌더링 완료`);
        } catch {
          this.logger.log(`   ℹ️ 타임아웃, 현재 상태로 진행`);
        }

        const cookies = await context.cookies();
        const cfCookie = cookies.find((c) => c.name === 'cf_clearance') ?? null;

        if (cfCookie || cfChallengeCompleted) {
          this.logger.log(`   ✅ Cloudflare 챌린지 완료 처리!`);
        }

        // 최종 HTML 캡처
        this.logger.log(`   📥 최종 HTML 캡처 중...`);
        const htmlStart = Date.now();
        const html = await page.content();
        this.logger.log(`   ✓ HTML 캡처 완료 (${html.length} bytes, ${Date.now() - htmlStart}ms)`);
        await context.close();

        this.logger.log(`   ✓ 브라우저 컨텍스트 종료`);
        return html;
      } finally {
        await browser.close();
      }
    } catch (err) {
      if (err instanceof HttpException || err instanceof BadRequestException) {
        throw err;
      }

      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Playwright fetch failed for ${url}: ${errorMsg}`,
      );

      throw new HttpException(
        'Failed to fetch the page with browser. The site may be blocking automated access.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private parseHtml(html: string, originalUrl: string): ReaderResult {
    this.logger.log(`   🔬 HTML 파싱 시작...`);
    const parseStart = Date.now();
    const $ = cheerio.load(html);
    this.logger.log(`      ✓ Cheerio 로드 완료`);

    const title =
      $('title').first().text().trim() ||
      $('h1').first().text().trim() ||
      'Untitled Page';
    this.logger.log(`      ✓ 제목 추출: "${title}"`);

    this.logger.log(`      🗑️  노이즈 태그 제거 중...`);
    $(NOISE_TAGS).remove();
    this.logger.log(`      ✓ 노이즈 제거 완료`);

    // booktoki469.com 특화: id="novel_content" 우선 선택
    this.logger.log(`      🎯 콘텐츠 요소 선택 중...`);
    let selectedBy = '';
    const contentRoot =
      $('#novel_content').first().length > 0
        ? (selectedBy = '#novel_content (booktoki469 특화)', $('#novel_content').first())
        : $('article').first().length > 0
        ? (selectedBy = 'article', $('article').first())
        : $('main').first().length > 0
        ? (selectedBy = 'main', $('main').first())
        : $('[role="main"]').first().length > 0
        ? (selectedBy = '[role="main"]', $('[role="main"]').first())
        : (selectedBy = 'body (폴백)', $('body'));

    this.logger.log(`      ✓ 콘텐츠 선택자: ${selectedBy}`);

    const rawText = contentRoot.text();
    this.logger.log(`      ✓ 원본 텍스트 추출: ${rawText.length} chars`);

    this.logger.log(`      🧹 텍스트 정규화 중...`);
    const content = rawText
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    this.logger.log(`      ✓ 정규화 완료: ${content.length} chars`);

    const wordCount = content
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    this.logger.log(`      ✓ 단어 수 계산: ${wordCount} words`);

    const result = {
      url: originalUrl,
      title,
      content,
      wordCount,
      fetchedAt: new Date().toISOString(),
    };

    this.logger.log(`   ✅ 파싱 완료 (${Date.now() - parseStart}ms)`);
    return result;
  }
}
