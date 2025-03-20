import { Controller, Post, Get } from '@nestjs/common';
import { DoorParserService } from './door-parser.service';

@Controller('parser/doors')
export class DoorParserController {
  constructor(private readonly doorParserService: DoorParserService) {}

  @Post('start')
  async startParsing() {
    await this.doorParserService.startParsing();
    return { message: 'Парсинг дверей запущен' };
  }

  @Get('status')
  async getParsingStatus() {
    // TODO: Добавить получение статуса парсинга
    return { message: 'Статус парсинга' };
  }
} 