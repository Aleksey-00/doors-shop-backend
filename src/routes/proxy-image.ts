import { Controller, Get, Query, Res, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';
import axios from 'axios';

@Controller('api/proxy-image')
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
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.farniture.ru/'
        },
        timeout: 10000, // 10 second timeout
        validateStatus: (status) => status === 200 // Only accept 200 status
      });

      this.logger.log(`Successfully fetched image. Content-Type: ${response.headers['content-type']}`);
      
      res.setHeader('Content-Type', response.headers['content-type']);
      res.setHeader('Cache-Control', 'public, max-age=31536000');
      res.send(response.data);
    } catch (error) {
      this.logger.error(`Error proxying image: ${error.message}`);
      
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          this.logger.error(`Error response: ${error.response.status} ${error.response.statusText}`);
          throw new HttpException(
            `Failed to proxy image: ${error.response.statusText}`,
            error.response.status
          );
        } else if (error.request) {
          // The request was made but no response was received
          this.logger.error('No response received from server');
          throw new HttpException('No response received from server', HttpStatus.GATEWAY_TIMEOUT);
        } else {
          // Something happened in setting up the request that triggered an Error
          this.logger.error(`Error setting up request: ${error.message}`);
          throw new HttpException('Failed to set up request', HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        // Something else happened
        this.logger.error(`Unexpected error: ${error.message}`);
        throw new HttpException('Unexpected error occurred', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
  }
} 