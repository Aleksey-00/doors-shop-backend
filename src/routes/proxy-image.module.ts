import { Module } from '@nestjs/common';
import { ProxyImageController } from './proxy-image';

@Module({
  controllers: [ProxyImageController],
})
export class ProxyImageModule {} 