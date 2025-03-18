import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { FarnitureService } from '../parsers/farniture/farniture.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('ParseDoors');
  logger.log('Starting doors parsing...');

  const app = await NestFactory.createApplicationContext(AppModule);
  const farnitureService = app.get(FarnitureService);

  try {
    const result = await farnitureService.parseAndSaveDoors();
    logger.log('Parsing completed successfully:', result);
  } catch (error) {
    logger.error('Error during parsing:', error);
  } finally {
    await app.close();
  }
}

bootstrap(); 