import { Controller, Get, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';

@Controller('proxy-image')
export class ProxyImageController {
  @Get()
  async proxyImage(@Query('url') url: string, @Res() res: Response) {
    if (!url) {
      throw new HttpException('URL parameter is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.farniture.ru/'
        }
      });

      res.setHeader('Content-Type', response.headers['content-type']);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(response.data);
    } catch (error) {
      console.error('Error proxying image:', error);
      throw new HttpException('Failed to proxy image', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
} 