export interface DoorData {
  title: string;
  description?: string;
  price: number;
  oldPrice?: number;
  imageUrl: string;
  specifications: Record<string, string>;
  category?: string;
  inStock: boolean;
  url: string;
  externalId: string;
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