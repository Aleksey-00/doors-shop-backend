import { Controller, Get, Post, Body, Query, UseGuards, Param, Logger } from '@nestjs/common';
import { DoorsService } from './doors.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Door } from '../parsers/farniture/entities/door.entity';
import { ErrorHandler } from '../utils/error-handler';
import { FindAllFilters } from './interfaces/find-all-filters.interface';

interface UpdatePricesDto {
  category?: string;
  increasePercent: number;
}

interface UpdateTitlesDto {
  category: string;
  searchText: string;
  replaceText: string;
}

@Controller('doors')
export class DoorsController {
  private readonly logger = new Logger(DoorsController.name);
  private readonly errorHandler: ErrorHandler;

  constructor(
    private readonly doorsService: DoorsService,
  ) {
    this.errorHandler = new ErrorHandler(this.logger);
  }

  @Get()
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('priceMin') priceMin?: string,
    @Query('priceMax') priceMax?: string,
    @Query('inStock') inStock?: string,
    @Query('sort') sort?: 'popular' | 'price_asc' | 'price_desc' | 'new',
    @Query('search') search?: string,
  ) {
    this.logger.log(`Received request with query params: ${JSON.stringify({ page, limit, category, priceMin, priceMax, inStock, sort, search })}`);
    
    const filters: FindAllFilters = {
      category: category,
      priceMin: priceMin ? Number(priceMin) : undefined,
      priceMax: priceMax ? Number(priceMax) : undefined,
      inStock: inStock === 'true' ? true : inStock === 'false' ? false : undefined,
      sort: sort || 'popular',
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 12,
      search: search
    };

    return this.doorsService.findAll(filters);
  }

  @Get('similar/:id')
  async findSimilar(@Param('id') id: string) {
    this.logger.log(`Getting similar doors for id: ${id}`);
    return this.doorsService.findSimilar(id);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    this.logger.log(`Getting door with id: ${id}`);
    return this.doorsService.findOne(id);
  }

  @Post('update-prices')
  @UseGuards(JwtAuthGuard)
  async updatePrices(
    @Body() updateData: UpdatePricesDto | string
  ) {
    const result = await this.errorHandler.handleJsonParse<UpdatePricesDto>(
      updateData,
      ['increasePercent']
    );

    if (!result.success || !result.data) {
      return { success: false, message: result.error };
    }

    return this.doorsService.updatePrices(result.data.category, result.data.increasePercent);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() door: Partial<Door>) {
    return this.doorsService.create(door);
  }

  @Post('update-titles')
  @UseGuards(JwtAuthGuard)
  async updateTitles(
    @Body() updateData: UpdateTitlesDto | string
  ) {
    const result = await this.errorHandler.handleJsonParse<UpdateTitlesDto>(
      updateData,
      ['category', 'searchText', 'replaceText']
    );

    if (!result.success || !result.data) {
      return { success: false, message: result.error };
    }

    return this.doorsService.updateTitlesInCategory(
      result.data.category,
      result.data.searchText,
      result.data.replaceText
    );
  }
} 