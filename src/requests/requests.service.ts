import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeasurementRequest } from './entities/measurement-request.entity';
import { CallbackRequest } from './entities/callback-request.entity';

@Injectable()
export class RequestsService {
  constructor(
    @InjectRepository(MeasurementRequest)
    private measurementRepo: Repository<MeasurementRequest>,
    @InjectRepository(CallbackRequest)
    private callbackRepo: Repository<CallbackRequest>
  ) {}

  async createMeasurementRequest(data: Omit<MeasurementRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    const request = this.measurementRepo.create(data);
    return await this.measurementRepo.save(request);
  }

  async createCallbackRequest(data: Omit<CallbackRequest, 'id' | 'status' | 'createdAt' | 'updatedAt'>) {
    const request = this.callbackRepo.create(data);
    return await this.callbackRepo.save(request);
  }

  async getMeasurementRequests() {
    return await this.measurementRepo.find({
      order: { createdAt: 'DESC' }
    });
  }

  async getCallbackRequests() {
    return await this.callbackRepo.find({
      order: { createdAt: 'DESC' }
    });
  }

  async updateMeasurementRequestStatus(id: string, status: 'pending' | 'completed' | 'cancelled') {
    return await this.measurementRepo.update(id, { status });
  }

  async updateCallbackRequestStatus(id: string, status: 'pending' | 'completed' | 'cancelled') {
    return await this.callbackRepo.update(id, { status });
  }
} 