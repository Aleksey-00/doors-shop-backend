import { Controller, Get, Post, Body, Patch, Param } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { MeasurementRequest } from './entities/measurement-request.entity';
import { CallbackRequest } from './entities/callback-request.entity';

@Controller()
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post('measurement-requests')
  createMeasurementRequest(@Body() data: Omit<MeasurementRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    return this.requestsService.createMeasurementRequest(data);
  }

  @Post('callback-requests')
  createCallbackRequest(@Body() data: Omit<CallbackRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    return this.requestsService.createCallbackRequest(data);
  }

  @Get('measurement-requests')
  getMeasurementRequests() {
    return this.requestsService.getMeasurementRequests();
  }

  @Get('callback-requests')
  getCallbackRequests() {
    return this.requestsService.getCallbackRequests();
  }

  @Patch('measurement-requests/:id/status')
  updateMeasurementRequestStatus(
    @Param('id') id: string,
    @Body('status') status: 'pending' | 'completed' | 'cancelled'
  ) {
    return this.requestsService.updateMeasurementRequestStatus(id, status);
  }

  @Patch('callback-requests/:id/status')
  updateCallbackRequestStatus(
    @Param('id') id: string,
    @Body('status') status: 'pending' | 'completed' | 'cancelled'
  ) {
    return this.requestsService.updateCallbackRequestStatus(id, status);
  }
} 