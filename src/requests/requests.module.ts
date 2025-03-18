import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MeasurementRequest } from './entities/measurement-request.entity';
import { CallbackRequest } from './entities/callback-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MeasurementRequest, CallbackRequest])
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService]
})
export class RequestsModule {} 