import { Injectable } from '@nestjs/common';
import { IDoorParser, DoorData } from '../interfaces/door-parser.interface';
import * as cheerio from 'cheerio';
import axios from 'axios';

@Injectable()
export class SecondSiteParser implements IDoorParser {
  private readonly baseUrl = 'https://asdoors.ru';
  private readonly catalogUrl = 'https://asdoors.ru/catalog';

  async parseDoorPage(url: string): Promise<DoorData> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Название двери
      const title = $('h1').text().trim();

      // Цены
      const priceText = $('.product-price__current').text().trim();
      const price = parseFloat(priceText.replace(/[^\d]/g, ''));
      
      const oldPriceText = $('.product-price__old').text().trim();
      const oldPrice = oldPriceText ? parseFloat(oldPriceText.replace(/[^\d]/g, '')) : undefined;

      // Описание
      const description = $('.product-description').text().trim();

      // Изображение
      const imageUrl = $('.product-gallery__main img').first().attr('src') || '';
      const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${this.baseUrl}${imageUrl}`;

      // Характеристики
      const specifications: Record<string, string> = {};
      $('.product-specifications tr').each((_, row) => {
        const key = $(row).find('th').text().trim();
        const value = $(row).find('td').text().trim();
        if (key && value) {
          specifications[key] = value;
        }
      });

      // Категория
      const category = $('.breadcrumbs .category').last().text().trim();

      // Наличие
      const inStock = !$('.stock-status').text().toLowerCase().includes('нет в наличии');

      // Внешний ID (используем URL как ID)
      const externalId = url.split('/').pop() || url;

      return {
        title,
        description,
        price,
        oldPrice,
        imageUrl: fullImageUrl,
        specifications,
        category,
        inStock,
        url,
        externalId,
      };
    } catch (error) {
      console.error(`Ошибка при парсинге страницы ${url}:`, error);
      throw new Error(`Не удалось спарсить страницу ${url}`);
    }
  }

  async getAllDoorUrls(): Promise<string[]> {
    try {
      const response = await axios.get(this.catalogUrl);
      const $ = cheerio.load(response.data);
      const urls: string[] = [];

      // Собираем все URL дверей со страницы каталога
      $('.catalog-item__link').each((_, el) => {
        const href = $(el).attr('href');
        if (href) {
          urls.push(href.startsWith('http') ? href : `${this.baseUrl}${href}`);
        }
      });

      return urls;
    } catch (error) {
      console.error('Ошибка при получении списка URL дверей:', error);
      throw new Error('Не удалось получить список URL дверей');
    }
  }
} 