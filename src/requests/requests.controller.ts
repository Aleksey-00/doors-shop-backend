import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { MeasurementRequest } from './entities/measurement-request.entity';
import { CallbackRequest } from './entities/callback-request.entity';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post('measurement')
  createMeasurementRequest(@Body() data: Omit<MeasurementRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    return this.requestsService.createMeasurementRequest(data);
  }

  @Post('callback')
  createCallbackRequest(@Body() data: Omit<CallbackRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    return this.requestsService.createCallbackRequest(data);
  }

  @Get('measurement')
  getMeasurementRequests() {
    return this.requestsService.getMeasurementRequests();
  }

  @Get('callback')
  getCallbackRequests() {
    return this.requestsService.getCallbackRequests();
  }

  @Patch('measurement/:id/status')
  updateMeasurementRequestStatus(
    @Param('id') id: string,
    @Body('status') status: 'pending' | 'completed' | 'cancelled'
  ) {
    return this.requestsService.updateMeasurementRequestStatus(id, status);
  }

  @Patch('callback/:id/status')
  updateCallbackRequestStatus(
    @Param('id') id: string,
    @Body('status') status: 'pending' | 'completed' | 'cancelled'
  ) {
    return this.requestsService.updateCallbackRequestStatus(id, status);
  }
} 