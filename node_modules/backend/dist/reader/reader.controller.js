"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ReaderController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReaderController = void 0;
const common_1 = require("@nestjs/common");
const reader_service_1 = require("./reader.service");
const fetch_url_dto_1 = require("./dto/fetch-url.dto");
let ReaderController = ReaderController_1 = class ReaderController {
    readerService;
    logger = new common_1.Logger(ReaderController_1.name);
    constructor(readerService) {
        this.readerService = readerService;
    }
    async fetch(dto) {
        this.logger.log(`Received fetch request for URL: ${dto.url}`);
        return this.readerService.fetchAndParse(dto.url);
    }
};
exports.ReaderController = ReaderController;
__decorate([
    (0, common_1.Post)('fetch'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [fetch_url_dto_1.FetchUrlDto]),
    __metadata("design:returntype", Promise)
], ReaderController.prototype, "fetch", null);
exports.ReaderController = ReaderController = ReaderController_1 = __decorate([
    (0, common_1.Controller)('reader'),
    __metadata("design:paramtypes", [reader_service_1.ReaderService])
], ReaderController);
//# sourceMappingURL=reader.controller.js.map