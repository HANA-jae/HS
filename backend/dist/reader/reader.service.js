"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var ReaderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const cheerio = __importStar(require("cheerio"));
const NOISE_TAGS = [
    'script', 'style', 'noscript', 'iframe', 'nav', 'footer',
    'header', 'aside', 'form', 'button', 'figure', 'figcaption',
    '[class*="ad-"]', '[class*="cookie"]',
    '[class*="popup"]', '[class*="banner"]', '[id*="sidebar"]',
].join(', ');
let ReaderService = ReaderService_1 = class ReaderService {
    logger = new common_1.Logger(ReaderService_1.name);
    async fetchAndParse(url) {
        let html;
        try {
            const response = await axios_1.default.get(url, {
                timeout: 10_000,
                maxRedirects: 5,
                responseType: 'text',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                        'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                        'Chrome/124.0.0.0 Safari/537.36',
                    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                },
                validateStatus: () => true,
            });
            let htmlContent;
            if ([403, 429, 503].includes(response.status)) {
                this.logger.warn(`HTTP ${response.status} from ${url}, retrying with browser...`);
                htmlContent = await this.fetchWithBrowser(url);
            }
            else if (response.status >= 400) {
                throw new common_1.HttpException(`Remote server returned HTTP ${response.status} for the requested URL.`, common_1.HttpStatus.BAD_GATEWAY);
            }
            else {
                htmlContent = response.data;
            }
            if (response.status < 400) {
                const contentType = response.headers['content-type'] ?? '';
                if (!contentType.includes('html')) {
                    throw new common_1.BadRequestException(`URL does not point to an HTML page (Content-Type: ${contentType}).`);
                }
            }
            html = htmlContent;
        }
        catch (err) {
            if (err instanceof common_1.HttpException || err instanceof common_1.BadRequestException) {
                throw err;
            }
            const axiosErr = err;
            if (axiosErr.code === 'ECONNABORTED' || axiosErr.code === 'ETIMEDOUT') {
                throw new common_1.HttpException('Request timed out. The site may be unreachable.', common_1.HttpStatus.GATEWAY_TIMEOUT);
            }
            if (axiosErr.code === 'ENOTFOUND' || axiosErr.code === 'ECONNREFUSED') {
                throw new common_1.BadRequestException('Could not connect to the URL. Check that the address is correct.');
            }
            this.logger.error(`Unexpected fetch error for ${url}`, axiosErr.message);
            throw new common_1.HttpException('An unexpected error occurred while fetching the URL.', common_1.HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return this.parseHtml(html, url);
    }
    async fetchWithBrowser(url) {
        try {
            const { chromium } = await import('playwright-core');
            this.logger.debug(`Launching Playwright browser for CF challenge at ${url}...`);
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
                const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                    'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                    'Chrome/124.0.0.0 Safari/537.36';
                const context = await browser.newContext({
                    userAgent,
                    locale: 'ko-KR',
                    extraHTTPHeaders: {
                        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    },
                });
                await context.addInitScript(() => {
                    Object.defineProperty(navigator, 'webdriver', {
                        get: () => undefined,
                    });
                    delete window.__playwright;
                    delete window.__pw_manual;
                    delete window.cdc_adoQpoasnfa;
                });
                const page = await context.newPage();
                this.logger.debug(`Navigating to ${url}...`);
                const navigationPromise = page
                    .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30_000 })
                    .catch(() => null);
                await page.goto(url, {
                    waitUntil: 'domcontentloaded',
                    timeout: 30_000,
                });
                this.logger.debug(`Waiting for Cloudflare challenge/redirect...`);
                await navigationPromise;
                this.logger.debug(`Navigation complete. Checking for cf_clearance cookie...`);
                const cookies = await context.cookies();
                const cfCookie = cookies.find((c) => c.name === 'cf_clearance') ?? null;
                if (!cfCookie) {
                    this.logger.warn(`No cf_clearance cookie found for ${url}. May not be CF protected or challenge not completed.`);
                }
                else {
                    this.logger.debug(`CF challenge completed successfully. cf_clearance obtained.`);
                }
                this.logger.debug(`CF challenge complete. cf_clearance: ${!!cfCookie}. Capturing rendered HTML...`);
                const html = await page.content();
                await context.close();
                this.logger.debug(`Successfully captured HTML from ${url} after CF challenge`);
                return html;
            }
            finally {
                await browser.close();
            }
        }
        catch (err) {
            if (err instanceof common_1.HttpException || err instanceof common_1.BadRequestException) {
                throw err;
            }
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Browser/axios fetch failed for ${url}: ${errorMsg} (Stack: ${err instanceof Error ? err.stack : 'unknown'})`);
            throw new common_1.HttpException('Failed to fetch the page with browser and cookie. The site may be blocking automated access.', common_1.HttpStatus.BAD_GATEWAY);
        }
    }
    parseHtml(html, originalUrl) {
        const $ = cheerio.load(html);
        const title = $('title').first().text().trim() ||
            $('h1').first().text().trim() ||
            'Untitled Page';
        $(NOISE_TAGS).remove();
        const contentRoot = $('article').first().length > 0
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
};
exports.ReaderService = ReaderService;
exports.ReaderService = ReaderService = ReaderService_1 = __decorate([
    (0, common_1.Injectable)()
], ReaderService);
//# sourceMappingURL=reader.service.js.map