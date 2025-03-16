import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Включаем доверие к прокси, чтобы работал HTTPS через Railway
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  
  // Настройка CORS для разрешения запросов с фронтенда
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://moos-doors.ru',
      'https://www.moos-doors.ru',
      'http://moos-doors.ru',
      'http://www.moos-doors.ru',
      'https://doors-shop-frontend-production.up.railway.app',
      'http://doors-shop-frontend-production.up.railway.app',
      'https://doors-shop-backend-production.up.railway.app',
      'http://doors-shop-backend-production.up.railway.app',
      'null',
      '*'
    ],
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
      'Cache-Control'
    ],
    exposedHeaders: ['Content-Disposition', 'X-RateLimit-Reset'],
    maxAge: 3600,
  });
  
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 9090;
  await app.listen(port, '0.0.0.0'); // Слушаем на всех интерфейсах
  console.log(`Application is running on port ${port}`);
}
bootstrap();
