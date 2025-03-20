export interface DoorData {
  name: string;
  description?: string;
  price: number;
  oldPrice?: number;
  images: string[];
  characteristics: Record<string, string>;
  manufacturer?: string;
  category?: string;
  inStock: boolean;
  sourceUrl: string;
}

export interface IDoorParser {
  /**
   * Парсит информацию о двери с указанной страницы
   * @param url URL страницы с дверью
   */
  parseDoorPage(url: string): Promise<DoorData>;

  /**
   * Получает список URL всех дверей с сайта
   * @returns Массив URL страниц с дверями
   */
  getAllDoorUrls(): Promise<string[]>;
} 