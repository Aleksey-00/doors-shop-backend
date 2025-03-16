import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { DoorsService } from './doors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Door } from '../parsers/farniture/entities/door.entity';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Controller('doors')
export class DoorsController {
  constructor(
    private readonly doorsService: DoorsService,
    @InjectRepository(Door)
    private readonly doorRepository: Repository<Door>,
  ) {}

  @Get()
  async findAll(
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('category') category?: string,
  ) {
    console.log('Received request for doors with params:', { page, limit, category });
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 10;
    console.log('Converted params:', { pageNumber, limitNumber, category });
    
    try {
      // Используем прямой доступ к репозиторию
      const skip = (pageNumber - 1) * limitNumber;
      
      const queryBuilder = this.doorRepository.createQueryBuilder('door');
      
      if (category) {
        queryBuilder.where('door.category ILIKE :category', { category: `%${category}%` });
      }
      
      queryBuilder
        .skip(skip)
        .take(limitNumber)
        .orderBy('door.id', 'DESC');
      
      const [doors, total] = await queryBuilder.getManyAndCount();
      console.log(`Found ${doors.length} doors, total: ${total}`);
      
      return {
        doors,
        total,
        totalPages: Math.ceil(total / limitNumber),
      };
    } catch (error) {
      console.error('Error in findAll:', error);
      return { doors: [], total: 0, totalPages: 0 };
    }
  }

  @Post('update-prices')
  @UseGuards(JwtAuthGuard)
  async updatePrices(
    @Body() updateData: { category?: string; increasePercent: number }
  ) {
    try {
      if (!updateData) {
        return { success: false, message: 'Не указаны данные для обновления цен' };
      }
      
      if (updateData.increasePercent === undefined) {
        return { success: false, message: 'Не указан процент увеличения цен' };
      }
      
      return this.doorsService.updatePrices(updateData.category, updateData.increasePercent);
    } catch (error) {
      console.error('Error in updatePrices:', error);
      return { success: false, message: `Ошибка при обновлении цен: ${error.message}` };
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() door: Partial<Door>) {
    return this.doorsService.create(door);
  }

  @Post('update-titles')
  @UseGuards(JwtAuthGuard)
  async updateTitles(
    @Body() updateData: { category: string; searchText: string; replaceText: string },
  ) {
    return this.doorsService.updateTitlesInCategory(
      updateData.category,
      updateData.searchText,
      updateData.replaceText,
    );
  }
} 