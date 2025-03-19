import { Controller, Get, Post, Body, Patch, Param, Delete, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { Category } from './entities/category.entity';

@Controller('categories')
export class CategoriesController {
  private readonly logger = new Logger(CategoriesController.name);

  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  async findAll(): Promise<Category[]> {
    try {
      return await this.categoriesService.findAll();
    } catch (error) {
      this.logger.error(`Error in findAll categories: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch categories');
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Category> {
    try {
      const category = await this.categoriesService.findOne(+id);
      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      return category;
    } catch (error) {
      this.logger.error(`Error in findOne category: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to fetch category');
    }
  }

  @Post()
  async create(@Body() categoryData: Partial<Category>): Promise<Category> {
    try {
      return await this.categoriesService.create(categoryData);
    } catch (error) {
      this.logger.error(`Error in create category: ${error.message}`);
      throw new InternalServerErrorException('Failed to create category');
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() categoryData: Partial<Category>,
  ): Promise<Category> {
    try {
      const category = await this.categoriesService.update(+id, categoryData);
      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      return category;
    } catch (error) {
      this.logger.error(`Error in update category: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update category');
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<void> {
    try {
      const category = await this.categoriesService.findOne(+id);
      if (!category) {
        throw new NotFoundException(`Category with ID ${id} not found`);
      }
      await this.categoriesService.remove(+id);
    } catch (error) {
      this.logger.error(`Error in remove category: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to remove category');
    }
  }
} 