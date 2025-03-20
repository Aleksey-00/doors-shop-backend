import { Injectable } from '@nestjs/common';
import { IDoorParser, DoorData } from '../interfaces/door-parser.interface';
import * as cheerio from 'cheerio';
import axios from 'axios';

@Injectable()
export class FirstSiteParser implements IDoorParser {
  private readonly baseUrl = 'https://dveri-ratibor.ru';
  private readonly catalogUrl = 'https://dveri-ratibor.ru/magazin/folder/katalog-dveri';

  async parseDoorPage(url: string): Promise<DoorData> {
    try {
      const response = await axios.get(url);
      const $ = cheerio.load(response.data);

      // Название двери
      const title = $('.h1').text().trim();

      // Цены
      const priceText = $('.price-current strong').text().trim();
      const price = parseFloat(priceText.replace(/[^\d]/g, ''));
      
      // Описание
      const description = $('.param-body.param_text p').text().trim();

      // Изображение
      const imageUrl = $('.product-image .slick-slide img')
        .first()
        .attr('src') || '';
      const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `${this.baseUrl}${imageUrl}`;

      // Характеристики
      const specifications: Record<string, string> = {};
      $('.shop2-product-params tr').each((_, row) => {
        const key = $(row).find('th').text().trim();
        const value = $(row).find('td').text().trim();
        if (key && value) {
          specifications[key] = value;
        }
      });

      // Категория
      const category = $('.widget-type-path a').last().text().trim();

      // Наличие
      const inStock = $('.product-options .option-body').last().text().trim().toLowerCase() === 'да';

      // Внешний ID (используем URL как ID)
      const externalId = url.split('/').pop() || url;

      return {
        title,
        description,
        price,
        oldPrice: undefined, // На сайте нет старой цены
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

      // Собираем все ссылки на товары
      $('.product-item a').each((_, el) => {
        const href = $(el).attr('href');
        if (href && href.includes('/product/')) {
          const fullUrl = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (!urls.includes(fullUrl)) {
            urls.push(fullUrl);
          }
        }
      });

      return urls;
    } catch (error) {
      console.error('Ошибка при получении списка URL:', error);
      throw new Error('Не удалось получить список URL дверей');
    }
  }
} 