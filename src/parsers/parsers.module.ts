import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { Door } from '../doors/entities/door.entity';
import { ImageService } from '../utils/image.service';
import { FirstSiteParser } from './doors/first-site.parser';
import { SecondSiteParser } from './doors/second-site.parser';
import { DoorParserService } from './doors/door-parser.service';
import { DoorParserProcessor } from './doors/door-parser.processor';
import { DoorParserController } from './doors/door-parser.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Door]),
    BullModule.registerQueue({
      name: 'door-parsing',
    }),
  ],
  providers: [
    ImageService,
    FirstSiteParser,
    SecondSiteParser,
    DoorParserService,
    DoorParserProcessor,
  ],
  controllers: [DoorParserController],
  exports: [DoorParserService],
})
export class ParsersModule {} 