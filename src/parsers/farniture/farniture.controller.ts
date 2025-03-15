import { Controller, Post, UseGuards } from '@nestjs/common';
import { FarnitureService } from './farniture.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@Controller('parsers/farniture')
export class FarnitureController {
  constructor(private readonly farnitureService: FarnitureService) {}

  @Post('parse')
  @UseGuards(JwtAuthGuard)
  async parseNow() {
    await this.farnitureService.parseAndSaveDoors();
    return { message: 'Parsing started' };
  }
} 