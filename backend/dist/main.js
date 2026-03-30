"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
const common_1 = require("@nestjs/common");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.enableCors({
        origin: ['http://localhost:9000', 'http://127.0.0.1:9000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
        methods: ['GET', 'POST', 'OPTIONS'],
        allowedHeaders: ['Content-Type'],
    });
    app.useGlobalPipes(new common_1.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
    }));
    const port = parseInt(process.env.PORT || '0', 10);
    const server = await app.listen(port, '0.0.0.0');
    const addr = server.address();
    const actualPort = typeof addr === 'object' ? addr?.port : port;
    console.log(`Backend running on http://localhost:${actualPort || 9001}`);
}
bootstrap();
//# sourceMappingURL=main.js.map