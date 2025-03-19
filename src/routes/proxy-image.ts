import { Controller, Get, Query, Res, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import fetch from 'node-fetch';

@Controller('proxy-image')
export class ProxyImageController {
  private readonly logger = new Logger(ProxyImageController.name);

  @Get()
  async proxyImage(@Query('url') url: string, @Res() res: Response) {
    this.logger.log(`Received proxy request for URL: ${url}`);

    if (!url) {
      this.logger.error('URL parameter is missing');
      throw new HttpException('URL parameter is required', HttpStatus.BAD_REQUEST);
    }

    try {
      this.logger.log(`Fetching image from: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.farniture.ru/',
          'Origin': 'https://www.farniture.ru',
          'Connection': 'keep-alive',
          'Sec-Fetch-Dest': 'image',
          'Sec-Fetch-Mode': 'no-cors',
          'Sec-Fetch-Site': 'same-origin',
          'Pragma': 'no-cache',
          'Cache-Control': 'no-cache',
          'DNT': '1',
          'Upgrade-Insecure-Requests': '1'
        },
        timeout: 10000,
        redirect: 'follow',
        follow: 5,
        compress: true,
        agent: new (require('https').Agent)({
          rejectUnauthorized: false,
          keepAlive: true,
          timeout: 10000
        })
      });

      if (!response.ok) {
        this.logger.error(`Error response: ${response.status} ${response.statusText}`);
        this.logger.error(`Response headers: ${JSON.stringify(Object.fromEntries(response.headers.entries()))}`);
        throw new HttpException(
          `Failed to proxy image: ${response.statusText}`,
          response.status
        );
      }

      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      this.logger.log(`Successfully fetched image. Content-Type: ${contentType}, Size: ${contentLength} bytes`);
      
      // Set CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      
      // Set content headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }
      
      // Get the image buffer and send it
      const buffer = await response.buffer();
      res.send(buffer);
    } catch (error) {
      this.logger.error(`Error proxying image: ${error.message}`);
      
      if (error.name === 'AbortError') {
        this.logger.error('Request timeout');
        throw new HttpException('Request timeout', HttpStatus.GATEWAY_TIMEOUT);
      } else if (error instanceof HttpException) {
        throw error;
      } else {
        this.logger.error(`Unexpected error: ${error.message}`);
        throw new HttpException('Unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }
} 