import { Logger } from '@nestjs/common';

export class ErrorHandler {
  constructor(private readonly logger: Logger) {}

  async handleCacheOperation<T>(
    operation: () => Promise<T>,
    errorMessage: string
  ): Promise<T | void> {
    try {
      return await operation();
    } catch (error) {
      this.logger.error(`${errorMessage}: ${error.message}`);
      // Продолжаем выполнение, даже если операция с кэшем не удалась
    }
  }

  async handleJsonParse<T>(
    data: string | T,
    requiredFields: string[] = []
  ): Promise<{ success: boolean; data?: T; error?: string }> {
    try {
      const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
      
      if (!parsedData) {
        return { success: false, error: 'Не указаны данные' };
      }

      const missingFields = requiredFields.filter(field => !parsedData[field]);
      if (missingFields.length > 0) {
        return {
          success: false,
          error: `Не указаны обязательные поля: ${missingFields.join(', ')}`
        };
      }

      return { success: true, data: parsedData };
    } catch (error) {
      this.logger.error(`Error parsing JSON data: ${error.message}`);
      return { success: false, error: 'Неверный формат данных' };
    }
  }
} 