import { Module } from '@nestjs/common';
import { FarnitureModule } from './farniture/farniture.module';

@Module({
  imports: [FarnitureModule],
  exports: [FarnitureModule],
})
export class ParsersModule {} 