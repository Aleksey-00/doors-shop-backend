import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ImageService {
  private readonly uploadPath = path.join(process.cwd(), 'uploads', 'doors', 'images');

  constructor() {
    // Создаем директорию, если она не существует
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  /**
   * Загружает изображение по URL и сохраняет его локально
   * @param imageUrl URL изображения
   * @returns Путь к сохраненному файлу
   */
  async downloadAndSaveImage(imageUrl: string): Promise<string> {
    try {
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      
      // Генерируем уникальное имя файла
      const fileName = `${uuidv4()}.webp`;
      const filePath = path.join(this.uploadPath, fileName);

      // Оптимизируем и сохраняем изображение
      await this.optimizeAndSaveImage(buffer, filePath);

      return fileName;
    } catch (error) {
      console.error('Ошибка при загрузке изображения:', error);
      throw new Error('Не удалось загрузить изображение');
    }
  }

  /**
   * Оптимизирует изображение и сохраняет его в формате WebP
   * @param buffer Буфер с изображением
   * @param outputPath Путь для сохранения
   */
  private async optimizeAndSaveImage(buffer: Buffer, outputPath: string): Promise<void> {
    try {
      await sharp(buffer)
        .webp({ quality: 80 }) // Конвертируем в WebP с хорошим качеством
        .resize(1200, 1200, { // Максимальный размер 1200x1200
          fit: 'inside',
          withoutEnlargement: true
        })
        .toFile(outputPath);
    } catch (error) {
      console.error('Ошибка при оптимизации изображения:', error);
      throw new Error('Не удалось оптимизировать изображение');
    }
  }

  /**
   * Удаляет изображение
   * @param fileName Имя файла для удаления
   */
  async deleteImage(fileName: string): Promise<void> {
    const filePath = path.join(this.uploadPath, fileName);
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
    }
  }

  /**
   * Проверяет существование файла
   * @param fileName Имя файла для проверки
   */
  async fileExists(fileName: string): Promise<boolean> {
    const filePath = path.join(this.uploadPath, fileName);
    return fs.existsSync(filePath);
  }
} 