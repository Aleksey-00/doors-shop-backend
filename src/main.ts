import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  app.enableCors({
    origin: ['http://localhost:3000', 'https://moos-doors.ru', 'https://www.moos-doors.ru'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  });
  
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 9090;
  await app.listen(port);
  console.log(`Application is running on port ${port}`);
}
bootstrap();
