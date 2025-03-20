import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { DoorParserService } from './door-parser.service';

@Processor('door-parsing')
export class DoorParserProcessor {
  private readonly logger = new Logger(DoorParserProcessor.name);

  constructor(private readonly doorParserService: DoorParserService) {}

  @Process('parseDoor')
  async handleParseDoor(job: Job<{ url: string }>) {
    this.logger.debug(`Обработка задачи парсинга двери: ${job.data.url}`);
    
    try {
      await this.doorParserService.processDoorParsing(job.data.url);
      this.logger.debug(`Задача парсинга двери выполнена успешно: ${job.data.url}`);
    } catch (error) {
      this.logger.error(`Ошибка при обработке задачи парсинга двери: ${job.data.url}`, error);
      throw error;
    }
  }
} 