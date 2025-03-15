import { IsString, IsNumber, IsArray, IsOptional } from 'class-validator';
import { Door } from '../../parsers/farniture/entities/door.entity';

export class CreateOrderDto {
  @IsString()
  name: string;

  @IsString()
  phone: string;

  @IsString()
  address: string;

  @IsString()
  @IsOptional()
  comment?: string;

  @IsArray()
  items: Door[];

  @IsNumber()
  total: number;
} 