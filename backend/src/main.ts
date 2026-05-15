

import './instrument';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { NoCacheInterceptor } from './common/interceptors/no-cache.interceptor';

async function bootstrap() {

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  app.useLogger(app.get(Logger));

  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', ['loopback', '172.28.0.0/24', '172.29.0.0/24']);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaExceptionFilter());

  app.useGlobalInterceptors(
    new TransformInterceptor(),
    new NoCacheInterceptor(),
  );

  app.use(helmet());

  app.use(cookieParser());

  app.enableCors({
    origin: process.env.FRONTEND_URL || 'https://redfigure.vercel.app',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? process.env.BACKEND_PORT ?? 4000);
}
bootstrap();
