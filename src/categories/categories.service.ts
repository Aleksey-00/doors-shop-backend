import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  private readonly logger = new Logger(CategoriesService.name);

  constructor(
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async findAll(): Promise<Category[]> {
    try {
      // Фильтруем категории, оставляя только "Премиум", "Стандарт" и "Эконом"
      const allowedCategories = ['Премиум', 'Стандарт', 'Эконом'];
      
      const categories = await this.categoryRepository.find({
        where: { name: In(allowedCategories) },
        order: {
          name: 'ASC'
        }
      });

      if (!categories || categories.length === 0) {
        this.logger.warn('No categories found in the database');
        // Если категории не найдены, создаем их
        return this.createDefaultCategories();
      }

      return categories;
    } catch (error) {
      this.logger.error(`Error in findAll categories: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch categories');
    }
  }

  private async createDefaultCategories(): Promise<Category[]> {
    try {
      const defaultCategories = [
        { name: 'Премиум', description: 'Премиальные входные двери высшего качества' },
        { name: 'Стандарт', description: 'Стандартные входные двери хорошего качества' },
        { name: 'Эконом', description: 'Экономичные входные двери' }
      ];

      const categories = await Promise.all(
        defaultCategories.map(category => this.categoryRepository.save(category))
      );

      this.logger.log('Default categories created successfully');
      return categories;
    } catch (error) {
      this.logger.error(`Error creating default categories: ${error.message}`);
      throw new InternalServerErrorException('Failed to create default categories');
    }
  }

  async findOne(id: number): Promise<Category | null> {
    return this.categoryRepository.findOne({ where: { id } });
  }

  async create(categoryData: Partial<Category>): Promise<Category> {
    const category = this.categoryRepository.create(categoryData);
    return this.categoryRepository.save(category);
  }

  async update(id: number, categoryData: Partial<Category>): Promise<Category | null> {
    await this.categoryRepository.update(id, categoryData);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.categoryRepository.delete(id);
  }
} 