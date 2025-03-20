import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Door } from '../../doors/entities/door.entity';
import { ImageService } from '../../utils/image.service';
import { FirstSiteParser } from './first-site.parser';
import { SecondSiteParser } from './second-site.parser';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

@Injectable()
export class DoorParserService {
  private readonly logger = new Logger(DoorParserService.name);

  constructor(
    @InjectRepository(Door)
    private readonly doorRepository: Repository<Door>,
    private readonly imageService: ImageService,
    private readonly firstSiteParser: FirstSiteParser,
    private readonly secondSiteParser: SecondSiteParser,
    @InjectQueue('door-parsing') private doorParsingQueue: Queue,
  ) {}

  /**
   * Запускает процесс парсинга дверей
   */
  async startParsing(): Promise<void> {
    try {
      // Получаем URL дверей с обоих сайтов
      const [firstSiteUrls, secondSiteUrls] = await Promise.all([
        this.firstSiteParser.getAllDoorUrls(),
        this.secondSiteParser.getAllDoorUrls(),
      ]);
      
      // Добавляем все URL в очередь на парсинг
      const allUrls = [...firstSiteUrls, ...secondSiteUrls];
      for (const url of allUrls) {
        await this.doorParsingQueue.add('parseDoor', { url });
      }

      this.logger.log(`Добавлено ${allUrls.length} дверей в очередь на парсинг`);
    } catch (error) {
      this.logger.error('Ошибка при запуске парсинга:', error);
      throw error;
    }
  }

  /**
   * Обрабатывает парсинг одной двери
   */
  async processDoorParsing(url: string): Promise<void> {
    try {
      // Проверяем, существует ли уже дверь с таким URL
      const existingDoor = await this.doorRepository.findOne({
        where: { sourceUrl: url }
      });

      if (existingDoor) {
        this.logger.log(`Дверь с URL ${url} уже существует, пропускаем`);
        return;
      }

      // Определяем, какой парсер использовать
      const parser = url.includes('dveri-ratibor.ru') 
        ? this.firstSiteParser 
        : this.secondSiteParser;

      // Парсим информацию о двери
      const doorData = await parser.parseDoorPage(url);

      // Скачиваем и сохраняем изображения
      const savedImages = await Promise.all(
        doorData.images.map(imageUrl => this.imageService.downloadAndSaveImage(imageUrl))
      );

      // Создаем новую дверь
      const door = this.doorRepository.create({
        ...doorData,
        images: savedImages,
      });

      // Сохраняем дверь в базу данных
      await this.doorRepository.save(door);

      this.logger.log(`Успешно спарсена и сохранена дверь: ${door.name}`);
    } catch (error) {
      this.logger.error(`Ошибка при парсинге двери ${url}:`, error);
      throw error;
    }
  }
} 