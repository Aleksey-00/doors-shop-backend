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
      const name = $('.h1').text().trim();

      // Цены
      const priceText = $('.price-current strong').text().trim();
      const price = parseFloat(priceText.replace(/[^\d]/g, ''));
      
      // Описание
      const description = $('.param-body.param_text p').text().trim();

      // Изображения
      const images = $('.product-image .slick-slide img')
        .map((_, el) => $(el).attr('src'))
        .get()
        .filter(src => src)
        .map(src => src.startsWith('http') ? src : `${this.baseUrl}${src}`);

      // Характеристики
      const characteristics: Record<string, string> = {};
      $('.shop2-product-params tr').each((_, row) => {
        const key = $(row).find('th').text().trim();
        const value = $(row).find('td').text().trim();
        if (key && value) {
          characteristics[key] = value;
        }
      });

      // Производитель
      const manufacturer = $('.product-options .option-body a').first().text().trim();

      // Категория
      const category = $('.widget-type-path a').last().text().trim();

      // Наличие
      const inStock = $('.product-options .option-body').last().text().trim().toLowerCase() === 'да';

      return {
        name,
        description,
        price,
        oldPrice: undefined, // На сайте нет старой цены
        images,
        characteristics,
        manufacturer,
        category,
        inStock,
        sourceUrl: url,
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