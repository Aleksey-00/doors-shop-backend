import { Controller, Post, Body, Get, Put, Param, UseGuards } from '@nestjs/common';
import { RequestsService, MeasurementRequest, CallbackRequest } from './requests.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post('measurement')
  async createMeasurementRequest(@Body() data: Omit<MeasurementRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    return this.requestsService.createMeasurementRequest(data);
  }

  @Post('callback')
  async createCallbackRequest(@Body() data: Omit<CallbackRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    return this.requestsService.createCallbackRequest(data);
  }

  @UseGuards(JwtAuthGuard)
  @Get('measurement')
  async getMeasurementRequests() {
    return this.requestsService.getMeasurementRequests();
  }

  @UseGuards(JwtAuthGuard)
  @Get('callback')
  async getCallbackRequests() {
    return this.requestsService.getCallbackRequests();
  }

  @UseGuards(JwtAuthGuard)
  @Put('measurement/:id/status')
  async updateMeasurementRequestStatus(
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    return this.requestsService.updateMeasurementRequestStatus(parseInt(id), status);
  }

  @UseGuards(JwtAuthGuard)
  @Put('callback/:id/status')
  async updateCallbackRequestStatus(
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    return this.requestsService.updateCallbackRequestStatus(parseInt(id), status);
  }
} 