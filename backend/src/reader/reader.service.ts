import {
  Injectable,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
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

  // User-Agent 랜덤화
  private readonly USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  ];

  private getRandomUserAgent(): string {
    return this.USER_AGENTS[Math.floor(Math.random() * this.USER_AGENTS.length)];
  }

  // 🧪 임시 테스트: finalUrl 추출용
  async fetchFinalUrl(url: string): Promise<{ initialUrl: string; finalUrl: string }> {
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`[🧪 TEST] finalUrl 추출 시작: ${url}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // 1차 시도: axios
    try {
      this.logger.log(`[1️⃣  STEP 1] Axios 직접 요청...`);
      const response = await axios.get<string>(url, {
        timeout: 10_000,
        validateStatus: () => true,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if ([403, 429, 503].includes(response.status)) {
        this.logger.warn(`   ⚠ HTTP ${response.status} - Playwright 필요`);
        this.logger.log(`[2️⃣  STEP 2] Playwright 실행...`);
        const finalUrl = await this.getFinalUrlWithBrowser(url);
        return { initialUrl: url, finalUrl };
      }

      this.logger.log(`   ✓ HTTP ${response.status} - Axios 성공`);
      return { initialUrl: url, finalUrl: url };
    } catch {
      this.logger.log(`[2️⃣  STEP 2] Axios 실패 - Playwright 실행...`);
      const finalUrl = await this.getFinalUrlWithBrowser(url);
      return { initialUrl: url, finalUrl };
    }
  }

  private async getFinalUrlWithBrowser(url: string): Promise<string> {
    try {
      const { chromium } = await import('playwright-core');

      this.logger.log(`   🌐 브라우저 실행...`);
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      try {
        const userAgent = this.getRandomUserAgent();
        this.logger.log(`   🎲 User-Agent: ${userAgent.substring(0, 60)}...`);

        const context = await browser.newContext({
          userAgent,
          locale: 'ko-KR',
          timezoneId: 'Asia/Seoul',
          viewport: { width: 1920, height: 1080 },
          extraHTTPHeaders: {
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        // ⭐ Stealth: Fingerprint 랜덤화 (방법 C)
        this.logger.log(`   🔒 Stealth 코드 주입 중...`);
        await context.addInitScript(() => {
          // 1. navigator.webdriver 패치
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          delete (window as any).__playwright;
          delete (window as any).__pw_manual;

          // 2. navigator.plugins 채우기
          Object.defineProperty(navigator, 'plugins', {
            get: () => [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
              { name: 'Native Client', filename: 'internal-nacl-plugin' },
            ],
          });

          // 3. navigator.languages
          Object.defineProperty(navigator, 'languages', {
            get: () => ['ko-KR', 'ko', 'en-US', 'en'],
          });

          // 4. WebGL fingerprint 덮어쓰기
          const getParam = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function (p: number) {
            if (p === 37445) return 'Intel Inc.';
            if (p === 37446) return 'Intel Iris OpenGL Engine';
            return getParam.call(this, p);
          };

          // 5. screen 해상도
          Object.defineProperty(screen, 'width', { get: () => 1920 });
          Object.defineProperty(screen, 'height', { get: () => 1080 });
          Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
          Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
          Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        });

        const page = await context.newPage();

        this.logger.log(`   🔄 페이지 로드...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

        this.logger.log(`   ⏳ CF 딜레이 대기 (5초)...`);
        await page.waitForTimeout(5000);

        this.logger.log(`   🔍 네트워크 유휴 대기...`);
        try {
          await page.waitForLoadState('networkidle', { timeout: 30_000 });
        } catch {
          this.logger.log(`      ⚠ 타임아웃, 계속 진행...`);
        }

        const finalUrl = page.url();
        this.logger.log(`   📍 최종 URL: ${finalUrl}`);

        await context.close();
        await browser.close();

        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.logger.log(`[✅ TEST COMPLETE]`);
        this.logger.log(`   초기: ${url}`);
        this.logger.log(`   최종: ${finalUrl}`);
        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        return finalUrl;
      } finally {
        await browser.close();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`브라우저 실패: ${errorMsg}`);
      throw new HttpException(
        'Failed to get final URL',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  async fetchAndParse(url: string): Promise<ReaderResult> {
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`[📥 START] fetchAndParse 시작: ${url}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    // ⭐ 통합: finalUrl 추출 + HTML 캡처를 한 번에!
    this.logger.log(`[🧪 PHASE 1] CF 우회 + HTML 캡처...`);
    const html = await this.getFinalUrlAndHtml(url);

    this.logger.log(`[🧪 PHASE 2] HTML 파싱 중... (길이: ${html.length} bytes)`);
    const result = this.parseHtml(html, url);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`[✅ SUCCESS] 완료! 제목: "${result.title}" | 단어: ${result.wordCount}`);
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    return result;
  }

  // ⭐ 핵심 메서드: Axios → Playwright 폴백, 최종 HTML 반환
  private async getFinalUrlAndHtml(url: string): Promise<string> {
    // 1차 시도: Axios 직접 요청
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

      // CF 감지 시 Playwright로 전환
      if ([403, 429, 503].includes(response.status)) {
        this.logger.warn(`   ⚠ HTTP ${response.status} - Cloudflare 감지`);
        this.logger.log(`[2️⃣  STEP 2] Playwright 우회 시작...`);
        return await this.fetchWithBrowserAndCapture(url);
      }

      if (response.status >= 400) {
        this.logger.error(`   ❌ HTTP ${response.status}`);
        throw new HttpException(
          `HTTP ${response.status}`,
          HttpStatus.BAD_GATEWAY,
        );
      }

      this.logger.log(`   ✓ 성공 - Axios로 HTML 획득`);
      return response.data as string;
    } catch (err) {
      if (err instanceof HttpException) {
        throw err;
      }

      this.logger.warn(`   ⚠ Axios 실패, Playwright 시도...`);
      this.logger.log(`[2️⃣  STEP 2] Playwright 우회 시작...`);
      return await this.fetchWithBrowserAndCapture(url);
    }
  }

  // ⭐ Playwright: CF 우회 완료 후 바로 HTML 캡처
  private async fetchWithBrowserAndCapture(url: string): Promise<string> {
    try {
      const { chromium } = await import('playwright-core');

      this.logger.log(`   🌐 브라우저 실행...`);
      const browser = await chromium.launch({
        headless: true,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      });

      try {
        const userAgent = this.getRandomUserAgent();
        this.logger.log(`   🎲 User-Agent: ${userAgent.substring(0, 60)}...`);

        const context = await browser.newContext({
          userAgent,
          locale: 'ko-KR',
          timezoneId: 'Asia/Seoul',
          viewport: { width: 1920, height: 1080 },
          extraHTTPHeaders: {
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        });

        // ⭐ Stealth: Fingerprint 랜덤화 (방법 C)
        this.logger.log(`   🔒 Stealth 코드 주입 중...`);
        await context.addInitScript(() => {
          // 1. navigator.webdriver 패치
          Object.defineProperty(navigator, 'webdriver', {
            get: () => undefined,
          });
          delete (window as any).__playwright;
          delete (window as any).__pw_manual;

          // 2. navigator.plugins 채우기
          Object.defineProperty(navigator, 'plugins', {
            get: () => [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
              { name: 'Native Client', filename: 'internal-nacl-plugin' },
            ],
          });

          // 3. navigator.languages
          Object.defineProperty(navigator, 'languages', {
            get: () => ['ko-KR', 'ko', 'en-US', 'en'],
          });

          // 4. WebGL fingerprint 덮어쓰기
          const getParam = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function (p: number) {
            if (p === 37445) return 'Intel Inc.';
            if (p === 37446) return 'Intel Iris OpenGL Engine';
            return getParam.call(this, p);
          };

          // 5. screen 해상도
          Object.defineProperty(screen, 'width', { get: () => 1920 });
          Object.defineProperty(screen, 'height', { get: () => 1080 });
          Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
          Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
          Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
        });

        const page = await context.newPage();

        this.logger.log(`   🔄 페이지 로드 중...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });

        this.logger.log(`   ⏳ CF 딜레이 대기 (5초)...`);
        await page.waitForTimeout(5000);

        this.logger.log(`   🔍 네트워크 유휴 대기...`);
        try {
          await page.waitForLoadState('networkidle', { timeout: 30_000 });
        } catch {
          this.logger.log(`      ⚠ 타임아웃, 계속 진행...`);
        }

        this.logger.log(`   🎯 콘텐츠 요소 대기 중...`);
        try {
          await page.waitForSelector('#novel_content', { timeout: 30_000 });
          this.logger.log(`      ✓ 콘텐츠 요소 발견!`);
        } catch {
          this.logger.log(`      ⚠ 요소 미발견, 계속 진행...`);
        }

        // ⭐ 핵심: 여기서 바로 HTML 캡처 (쿠키와 함께!)
        this.logger.log(`   📥 HTML 캡처 중...`);
        const html = await page.content();

        // ⭐ 검증: 실제 페이지인지 텍스트 길이로 확인
        const isRealPage = await page.evaluate(() => document.body.innerText.length > 1000);
        this.logger.log(`   ${isRealPage ? '✓' : '⚠'} 실제 페이지: ${isRealPage ? '확인' : '텍스트 < 1000 chars'}`);

        const cookies = (await context.cookies()).find((c) => c.name === 'cf_clearance');
        this.logger.log(`   ${cookies ? '✓' : 'ℹ️'} CF 쿠키: ${cookies ? '발견' : '미발견'}`);

        await context.close();
        await browser.close();

        this.logger.log(`   ✓ 성공 - Playwright로 HTML 획득`);
        return html;
      } finally {
        await browser.close();
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`   ❌ 브라우저 실패: ${errorMsg}`);
      throw new HttpException('Failed to fetch', HttpStatus.BAD_GATEWAY);
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
