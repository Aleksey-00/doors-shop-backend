import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Включаем доверие к прокси, чтобы работал HTTPS через Railway
  app.getHttpAdapter().getInstance().set('trust proxy', true);
  
  // Настройка CORS для разрешения запросов с фронтенда
  app.enableCors({
    origin: ['http://localhost:3000', 'https://moos-doors.ru', 'https://www.moos-doors.ru', 'http://moos-doors.ru', 'http://www.moos-doors.ru'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'Origin', 'X-Requested-With'],
    exposedHeaders: ['Content-Disposition'],
  });
  
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 9090;
  await app.listen(port, '0.0.0.0'); // Слушаем на всех интерфейсах
  console.log(`Application is running on port ${port}`);
}
bootstrap();
