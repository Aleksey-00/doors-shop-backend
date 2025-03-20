import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting application...');

  try {
    const app = await NestFactory.create(AppModule);
    
    // Включаем доверие к прокси, чтобы работал HTTPS через Railway
    app.getHttpAdapter().getInstance().set('trust proxy', true);
    
    // Настройка CORS для разрешения запросов с фронтенда
    app.enableCors({
      origin: true, // Разрешаем все origins
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
      allowedHeaders: [
        'Content-Type',
        'Accept',
        'Authorization',
        'Origin',
        'X-Requested-With',
        'Access-Control-Allow-Origin',
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Methods',
        'Access-Control-Allow-Credentials',
        'X-HTTP-Method-Override',
        'Accept-Language',
        'Access-Control-Expose-Headers',
        'Access-Control-Max-Age',
        'Referer',
        'Host',
        'X-Real-IP',
        'X-Forwarded-For',
        'Connection',
        'Pragma',
        'Cache-Control',
        'User-Agent'
      ],
      exposedHeaders: ['Content-Disposition', 'X-RateLimit-Reset'],
      maxAge: 3600,
    });
    
    // Добавляем обработчик для text/plain
    app.use(bodyParser.text({ type: 'text/plain' }));
    
    // Добавляем middleware для преобразования текстовых данных в JSON
    app.use((req, res, next) => {
      if (req.body && typeof req.body === 'string' && req.headers['content-type']?.includes('text/plain')) {
        try {
          req.body = JSON.parse(req.body);
        } catch (e) {
          console.error('Error parsing text/plain body:', e);
        }
      }
      next();
    });
    
    app.setGlobalPrefix('api');

    // Получаем порт из переменных окружения или используем 8080 по умолчанию
    const port = process.env.PORT || 8080;
    
    await app.listen(port, '0.0.0.0'); // Слушаем на всех интерфейсах
    logger.log(`Application is running on port ${port}`);
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
}

bootstrap();
