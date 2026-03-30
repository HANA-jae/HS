import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: ['http://localhost:9000', 'http://127.0.0.1:9000', 'http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT || '0', 10);
  const server = await app.listen(port, '0.0.0.0');
  const addr = server.address();
  const actualPort = typeof addr === 'object' ? addr?.port : port;
  console.log(`Backend running on http://localhost:${actualPort || 9001}`);
}
bootstrap();
